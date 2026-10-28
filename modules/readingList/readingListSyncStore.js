/**
 * @file readingListSyncStore.js
 * Service-worker-side state for reading-list Drive sync (ISSUE-257 WP4).
 *
 * `chrome.readingList` stays the local source of truth on every device (Dia
 * implements it fully, SPIKE §2). What the browser cannot give us is a stable
 * cross-device ordering key: the receiving device's `addEntry` mints fresh
 * creationTime/lastUpdateTime, so using those would make every pull look like
 * a newer local edit and bounce back as a push. This store therefore keeps an
 * app-controlled Lamport `updatedAt` per url in a storage.local sidecar
 * (`readingListSyncMeta`) plus tombstones (`readingListTombstones`), and an
 * in-memory echo guard so entries written by the sync engine itself are not
 * mistaken for user edits.
 *
 * All sidecar mutations go through ONE promise chain: "delete all read" fires
 * N onEntryRemoved events at once and independent read-modify-writes of the
 * sidecar object would lose updates (the mutateWindowMap incident).
 *
 * Effects are injected (readingList API, storage KV, clock) so the whole
 * thing runs in Node; background.js wires chrome.readingList + storage.local.
 */
import { nextTimestamp } from '../utils/lamportClock.js';
import { tombstoneTimestamp, RL_SYNC_SCHEMA, RL_TOMBSTONE_GC_MS } from './readingListSyncLogic.js';

/** storage.local: { [url]: { updatedAt, title, hasBeenRead } } */
export const RL_META_KEY = 'readingListSyncMeta';
/** storage.local: { [url]: deletedAt } */
export const RL_TOMBSTONES_KEY = 'readingListTombstones';

/**
 * @param {Object} deps
 * @param {Object} deps.readingList  chrome.readingList-like (query/addEntry/updateEntry/removeEntry/onEntry*)
 * @param {{get:(k:string)=>Promise<any>, set:(k:string,v:any)=>Promise<void>}} deps.storage
 * @param {() => number} [deps.now]
 * @param {{warn: Function}} [deps.log]
 */
export function createReadingListSyncStore({ readingList, storage, now = () => Date.now(), log = console }) {
    /** @type {Map<string, {op:'add'|'update'|'remove', hasBeenRead?:boolean, at:number}>} */
    const echo = new Map();
    /** An engine write whose event never arrived must not swallow a later real edit. */
    const ECHO_TTL_MS = 5000;
    let chain = Promise.resolve();

    function serialize(fn) {
        chain = chain.then(fn).catch((err) => log.warn('[rl-sync] sidecar op failed:', err && err.message));
        return chain;
    }

    async function readMeta() { return (await storage.get(RL_META_KEY)) || {}; }
    async function readTombstones() { return (await storage.get(RL_TOMBSTONES_KEY)) || {}; }

    function matchesEcho(url, op, entry) {
        const e = echo.get(url);
        if (!e) return false;
        if (now() - e.at > ECHO_TTL_MS) { echo.delete(url); return false; }
        if (e.op !== op) return false;
        if (op === 'update' && entry && e.hasBeenRead !== undefined && e.hasBeenRead !== Boolean(entry.hasBeenRead)) return false;
        echo.delete(url);
        return true;
    }
    const setEcho = (url, fields) => echo.set(url, { ...fields, at: now() });

    /** User (or native-sync) edit observed → bump the url's Lamport stamp. */
    function recordLocalChange(entry) {
        return serialize(async () => {
            const [meta, tombs] = await Promise.all([readMeta(), readTombstones()]);
            const prev = meta[entry.url];
            // A re-add after a delete must land strictly after the tombstone to resurrect.
            const known = Math.max(prev ? prev.updatedAt : 0, tombs[entry.url] || 0);
            meta[entry.url] = { updatedAt: nextTimestamp(known, now()), title: entry.title || '', hasBeenRead: Boolean(entry.hasBeenRead) };
            if (tombs[entry.url] !== undefined) {
                delete tombs[entry.url];
                await storage.set(RL_TOMBSTONES_KEY, tombs);
            }
            await storage.set(RL_META_KEY, meta);
        });
    }

    function recordLocalRemoval(entry) {
        return serialize(async () => {
            const [meta, tombs] = await Promise.all([readMeta(), readTombstones()]);
            const prev = meta[entry.url];
            const at = now();
            tombs[entry.url] = tombstoneTimestamp(prev ? prev.updatedAt : 0, at);
            delete meta[entry.url];
            // Local GC too: a device that never connects Drive would otherwise
            // grow this object forever (merge-time GC only runs while syncing).
            for (const [url, deletedAt] of Object.entries(tombs)) {
                if (deletedAt < at - RL_TOMBSTONE_GC_MS) delete tombs[url];
            }
            await Promise.all([storage.set(RL_TOMBSTONES_KEY, tombs), storage.set(RL_META_KEY, meta)]);
        });
    }

    /** Register chrome.readingList listeners (call synchronously at SW top level). */
    function attach() {
        if (!readingList || !readingList.onEntryAdded) return false;
        readingList.onEntryAdded.addListener((entry) => {
            if (matchesEcho(entry.url, 'add')) return;
            recordLocalChange(entry);
        });
        readingList.onEntryUpdated.addListener((entry) => {
            if (matchesEcho(entry.url, 'update', entry)) return;
            recordLocalChange(entry);
        });
        readingList.onEntryRemoved.addListener((entry) => {
            if (matchesEcho(entry.url, 'remove')) return;
            recordLocalRemoval(entry);
        });
        return true;
    }

    /**
     * Local state in Drive-file shape. Entries the sidecar has never seen
     * (pre-existing, or synced in natively) are seeded with updatedAt 0 so any
     * real edit or a remote tombstone wins — and so they are never mistaken
     * for removals by diffReadingList.
     */
    async function exportState() {
        await chain; // include sidecar writes still in flight
        const [live, meta, tombstones] = await Promise.all([readingList.query({}), readMeta(), readTombstones()]);
        const entries = {};
        for (const e of live) {
            const m = meta[e.url];
            entries[e.url] = {
                title: e.title || '',
                hasBeenRead: Boolean(e.hasBeenRead),
                createdAt: m ? m.createdAt || e.creationTime || 0 : e.creationTime || 0,
                updatedAt: m ? m.updatedAt : 0,
            };
        }
        return { schema: RL_SYNC_SCHEMA, entries, tombstones };
    }

    /** @returns {Promise<Object>} { [url]: { title, hasBeenRead } } */
    async function currentByUrl() {
        const live = await readingList.query({});
        const out = {};
        for (const e of live) out[e.url] = { title: e.title || '', hasBeenRead: Boolean(e.hasBeenRead) };
        return out;
    }

    /**
     * Apply a merged state: write the differences into chrome.readingList
     * (each guarded by the echo map so the resulting event is not re-recorded)
     * and adopt the merged timestamps into the sidecar verbatim (no bump).
     * @param {{add:Array, update:Array, remove:string[]}} diff from diffReadingList
     * @param {Object} merged the merged state (entries + tombstones)
     */
    async function applyMerged(diff, merged) {
        const failed = new Set();
        for (const a of diff.add) {
            setEcho(a.url, { op: 'add' });
            try { await readingList.addEntry({ url: a.url, title: a.title, hasBeenRead: a.hasBeenRead }); }
            catch (err) { echo.delete(a.url); failed.add(a.url); log.warn('[rl-sync] addEntry failed:', err && err.message); }
        }
        for (const u of diff.update) {
            setEcho(u.url, { op: 'update', hasBeenRead: u.hasBeenRead });
            try { await readingList.updateEntry({ url: u.url, title: u.title, hasBeenRead: u.hasBeenRead }); }
            catch (err) { echo.delete(u.url); failed.add(u.url); log.warn('[rl-sync] updateEntry failed:', err && err.message); }
        }
        for (const url of diff.remove) {
            setEcho(url, { op: 'remove' });
            try { await readingList.removeEntry({ url }); }
            catch (err) { echo.delete(url); failed.add(url); log.warn('[rl-sync] removeEntry failed:', err && err.message); }
        }
        // Adopt the merged stamps into the sidecar — but the cycle started from a
        // snapshot taken in exportState(), and the user may have edited or
        // deleted entries since (those edits are already queued ahead of us on
        // the chain). Re-read and keep every local record that is NEWER than
        // what the merge knew, and skip urls whose API call failed (chrome still
        // holds the old content; the next export must not claim the new stamp).
        await serialize(async () => {
            const [meta, tombs] = await Promise.all([readMeta(), readTombstones()]);
            for (const [url, e] of Object.entries(merged.entries)) {
                if (failed.has(url)) continue;
                const cur = meta[url];
                if (cur && cur.updatedAt > e.updatedAt) continue;          // edited locally after the snapshot
                if (tombs[url] !== undefined && tombs[url] > e.updatedAt) continue; // deleted locally after the snapshot
                meta[url] = { updatedAt: e.updatedAt, title: e.title, hasBeenRead: e.hasBeenRead, createdAt: e.createdAt };
            }
            for (const [url, deletedAt] of Object.entries(merged.tombstones)) {
                if (failed.has(url)) continue;
                const cur = meta[url];
                if (cur && cur.updatedAt > deletedAt) continue;              // re-added locally after the snapshot
                tombs[url] = Math.max(tombs[url] || 0, deletedAt);
                if (cur && cur.updatedAt <= deletedAt) delete meta[url];
            }
            await Promise.all([storage.set(RL_META_KEY, meta), storage.set(RL_TOMBSTONES_KEY, tombs)]);
        });
    }

    /** Wait for queued sidecar writes (tests / shutdown). */
    const idle = () => chain;

    return { attach, exportState, currentByUrl, applyMerged, idle, getTombstones: readTombstones, getMeta: readMeta };
}
