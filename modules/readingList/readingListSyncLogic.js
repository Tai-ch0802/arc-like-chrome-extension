/**
 * @file readingListSyncLogic.js
 * PURE merge logic for mirroring the browser reading list (`chrome.readingList`)
 * across devices via the Google Drive file `reading-list-sync.json`. Every
 * function is a pure function of its arguments: NO chrome, NO fetch, NO Date,
 * NO module state. Time enters only through the `now` argument.
 *
 * State shape:
 *   { schema: 1,
 *     entries:    { [url]: { title, hasBeenRead, createdAt, updatedAt } },
 *     tombstones: { [url]: deletedAt } }
 *
 * `updatedAt` is an app-controlled Lamport-style timestamp (NOT the browser's
 * own times). Merge is COMMUTATIVE and IDEMPOTENT for a fixed `now`, which the
 * background no-op-write guard relies on to settle. Modelled on
 * modules/rss/rssSyncLogic.js.
 *
 * @module modules/readingList/readingListSyncLogic
 */

/** Current `reading-list-sync.json` schema version this client writes/understands. */
export const RL_SYNC_SCHEMA = 1;

/** Tombstone grace window: 180 days (same as RSS sync). */
export const RL_TOMBSTONE_GC_MS = 180 * 24 * 60 * 60 * 1000;

const isNonNegFinite = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0;
const isPlainObject = (o) => o !== null && typeof o === 'object' && !Array.isArray(o);
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);

/**
 * Normalize a possibly-partial / dirty state into the canonical shape: invalid
 * entries and tombstones are dropped, fields coerced, keys sorted. Never
 * mutates its input; tolerates null / undefined / non-objects.
 *
 * @param {object|null|undefined} state
 * @returns {{schema:number, entries:Object<string,{title:string,hasBeenRead:boolean,createdAt:number,updatedAt:number}>, tombstones:Object<string,number>}}
 */
export function canonicalizeReadingListState(state) {
    const s = isPlainObject(state) ? state : {};
    const rawEntries = isPlainObject(s.entries) ? s.entries : {};
    const rawTombs = isPlainObject(s.tombstones) ? s.tombstones : {};

    const entries = {};
    for (const url of Object.keys(rawEntries).sort()) {
        const e = rawEntries[url];
        if (typeof url !== 'string' || url === '' || UNSAFE_KEYS.has(url) || !isPlainObject(e) || !isNonNegFinite(e.updatedAt)) continue;
        entries[url] = {
            title: typeof e.title === 'string' ? e.title : (e.title == null ? '' : String(e.title)),
            hasBeenRead: !!e.hasBeenRead,
            createdAt: (typeof e.createdAt === 'number' && Number.isFinite(e.createdAt)) ? e.createdAt : e.updatedAt,
            updatedAt: e.updatedAt,
        };
    }

    const tombstones = {};
    for (const url of Object.keys(rawTombs).sort()) {
        if (!UNSAFE_KEYS.has(url) && isNonNegFinite(rawTombs[url])) tombstones[url] = rawTombs[url];
    }

    return { schema: RL_SYNC_SCHEMA, entries, tombstones };
}

/**
 * Pick the winning entry from two candidates for the same url. Larger
 * `updatedAt` wins; on a tie `hasBeenRead === true` wins, then the greater
 * `JSON.stringify(title)`. The winner keeps its fields except `createdAt`,
 * which is the minimum of both.
 */
function pickEntry(a, b) {
    let winner;
    if (a.updatedAt !== b.updatedAt) {
        winner = a.updatedAt > b.updatedAt ? a : b;
    } else if (a.hasBeenRead !== b.hasBeenRead) {
        winner = a.hasBeenRead ? a : b;
    } else {
        winner = JSON.stringify(a.title) >= JSON.stringify(b.title) ? a : b;
    }
    return { ...winner, createdAt: Math.min(a.createdAt, b.createdAt) };
}

/**
 * Merge two reading-list states. Pure; COMMUTATIVE and IDEMPOTENT for a fixed
 * `now`.
 *
 * Entries are keyed by the EXACT url string — no URL normalization is applied
 * (trailing slash, fragment, case etc. produce distinct entries).
 *
 * Tombstones are unioned (max `deletedAt`) and garbage-collected when
 * `deletedAt < now - gcMs`. GC happens BEFORE the exclusion check so a
 * collected tombstone can never half-apply (which would break idempotence).
 * A tombstone hides an entry iff `deletedAt >= entry.updatedAt`; a later edit
 * (`updatedAt > deletedAt`) resurrects the entry and the tombstone is dropped.
 *
 * @param {object} local
 * @param {object} remote
 * @param {{now:number, gcMs?:number}} opts - `now` must be a finite number (TypeError otherwise).
 * @returns {{schema:number, entries:object, tombstones:Object<string,number>}}
 */
export function mergeReadingListState(local, remote, { now, gcMs = RL_TOMBSTONE_GC_MS } = {}) {
    if (typeof now !== 'number' || !Number.isFinite(now)) {
        throw new TypeError('mergeReadingListState: `now` must be a finite number');
    }
    const l = canonicalizeReadingListState(local);
    const r = canonicalizeReadingListState(remote);

    const tombs = {};
    for (const src of [l.tombstones, r.tombstones]) {
        for (const [url, ts] of Object.entries(src)) {
            tombs[url] = Math.max(tombs[url] ?? 0, ts);
        }
    }
    for (const url of Object.keys(tombs)) {
        if (tombs[url] < now - gcMs) delete tombs[url];
    }

    const merged = {};
    for (const src of [l.entries, r.entries]) {
        for (const [url, e] of Object.entries(src)) {
            merged[url] = merged[url] ? pickEntry(merged[url], e) : { ...e };
        }
    }

    const entries = {};
    for (const url of Object.keys(merged)) {
        const e = merged[url];
        const deletedAt = tombs[url];
        if (deletedAt !== undefined) {
            if (deletedAt >= e.updatedAt) continue; // stays deleted
            delete tombs[url]; // resurrected by a later edit
        }
        entries[url] = e;
    }

    return canonicalizeReadingListState({ schema: RL_SYNC_SCHEMA, entries, tombstones: tombs });
}

/**
 * Timestamp to record as a tombstone's `deletedAt` when the user deletes an
 * entry. Always strictly greater than the entry's own Lamport `updatedAt`, so
 * the deletion wins even when that clock ran ahead of the wall clock after
 * remote bumps. When RE-ADDING a previously deleted url, callers must stamp the
 * new entry with `nextTimestamp(deletedAt, now)` (rssSyncLogic) so that
 * `updatedAt > deletedAt` and the entry resurrects.
 *
 * @param {number} [prevUpdatedAt] - the deleted entry's last known updatedAt (0 if none).
 * @param {number} now - wall-clock ms supplied by the caller.
 * @returns {number}
 */
export function tombstoneTimestamp(prevUpdatedAt, now) {
    return Math.max(now || 0, (prevUpdatedAt || 0) + 1);
}

/**
 * Compute what to apply to the browser's reading list so it matches `merged`.
 * Arrays are sorted by url for determinism.
 *
 * SAFETY: `remove` contains a url only if it is in `currentByUrl`, absent from
 * `merged.entries` AND present in `merged.tombstones`. A url merely missing from
 * the merged entries (e.g. dropped by canonicalization) is never removed.
 *
 * @param {Object<string,{title:string,hasBeenRead:boolean}>|null} currentByUrl
 *   what the browser currently holds on this device.
 * @param {object} merged - a merged state.
 * @returns {{add:Array<{url:string,title:string,hasBeenRead:boolean}>, update:Array<{url:string,title:string,hasBeenRead:boolean}>, remove:string[]}}
 */
export function diffReadingList(currentByUrl, merged) {
    const cur = isPlainObject(currentByUrl) ? currentByUrl : {};
    const canon = canonicalizeReadingListState(merged);
    const target = canon.entries;
    const tombs = canon.tombstones;
    const add = [];
    const update = [];
    const remove = [];

    for (const url of Object.keys(target)) {
        const { title, hasBeenRead } = target[url];
        const c = hasOwn(cur, url) ? cur[url] : undefined;
        if (!c) {
            add.push({ url, title, hasBeenRead });
        } else if (c.title !== title || !!c.hasBeenRead !== hasBeenRead) {
            update.push({ url, title, hasBeenRead });
        }
    }
    for (const url of Object.keys(cur)) {
        if (UNSAFE_KEYS.has(url)) continue;
        if (!hasOwn(target, url) && hasOwn(tombs, url)) remove.push(url);
    }

    add.sort((x, y) => cmp(x.url, y.url));
    update.sort((x, y) => cmp(x.url, y.url));
    remove.sort(cmp);
    return { add, update, remove };
}

/**
 * True iff two states are equivalent after canonicalization.
 * @param {object} a
 * @param {object} b
 * @returns {boolean}
 */
export function readingListStateEqual(a, b) {
    return JSON.stringify(canonicalizeReadingListState(a)) === JSON.stringify(canonicalizeReadingListState(b));
}

/**
 * True when the remote file was written by a newer client schema than this one
 * understands (caller should refuse to overwrite it).
 * @param {object|null} remote
 * @returns {boolean}
 */
export function isReadingListSchemaTooNew(remote) {
    return !!remote && typeof remote.schema === 'number' && remote.schema > RL_SYNC_SCHEMA;
}
