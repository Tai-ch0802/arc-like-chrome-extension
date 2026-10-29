/**
 * @file groupMetaCache.js
 * Remembers tab-group title/color while a group is visible to chrome.tabGroups
 * so the side panel can still label it once the browser hides it (ISSUE-263).
 *
 * Why: Dia keeps an unpinned Tab Group in Chromium's TabGroupModel (query/get
 * work), but pinning the group into its sidebar removes it from that model —
 * tabGroups.get throws, every query omits it — while the member tabs keep
 * their groupId. Unpinning re-registers the group under the same id with its
 * Dia title/color. Dia emits no tabGroups events, so the only moment the
 * metadata is observable is a render while the group is unpinned.
 *
 * Two tiers:
 * - storage.session, by group id: same browser session (ids are stable across
 *   pin/unpin within a session).
 * - storage.local, by member-URL fingerprint: survives a Dia restart, where
 *   group ids are reassigned; a pinned group is matched to the entry whose
 *   member URLs overlap most (Jaccard ≥ MATCH_THRESHOLD).
 *
 * Pure module (dependency-injected storage + clock) so it runs in Node tests;
 * `getGroupMetaCache()` wires the default instance to chrome.storage. Every
 * storage failure degrades to memory-only (older Chromium without
 * storage.session, quota errors).
 */

import { getBrowserInfo } from './utils/browserCapabilities.js';

/** storage.session: { [groupId]: { title, color, urls } } */
export const SESSION_KEY = 'groupMetaSession';
/** storage.local: [{ title, color, urls, updatedAt }] — most recent first */
export const LOCAL_KEY = 'groupMetaByFingerprint';
/** storage.session: { [groupId]: true } for synthetic headers the user collapsed */
export const COLLAPSED_KEY = 'syntheticGroupCollapsed';
export const MAX_LOCAL_ENTRIES = 100;
export const MAX_URLS_PER_ENTRY = 50;
export const MATCH_THRESHOLD = 0.5;

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * origin + pathname for http(s) URLs (query/hash dropped: pinned tabs drift
 * there without changing identity), other schemes as-is, invalid → ''.
 * @param {string|undefined} url
 * @returns {string}
 */
export function normalizeUrl(url) {
    if (typeof url !== 'string' || !url) return '';
    try {
        const u = new URL(url);
        if (u.protocol === 'http:' || u.protocol === 'https:') return u.origin + u.pathname;
        return url;
    } catch {
        return '';
    }
}

/**
 * @param {Set<string>} a
 * @param {Set<string>} b
 * @returns {number} |a∩b| / |a∪b|, 0 when both are empty
 */
export function jaccard(a, b) {
    if (!a.size && !b.size) return 0;
    let inter = 0;
    for (const x of a) if (b.has(x)) inter++;
    return inter / (a.size + b.size - inter);
}

/**
 * Hostname (without a leading "www.") shared by every http(s) URL, else null.
 * Used as the fallback title of a synthetic group.
 * @param {string[]} urls
 * @returns {string|null}
 */
export function commonHost(urls) {
    if (!Array.isArray(urls) || urls.length === 0) return null;
    let host = null;
    for (const url of urls) {
        let h;
        try {
            const u = new URL(url);
            if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
            h = u.hostname.replace(/^www\./, '');
        } catch {
            return null;
        }
        if (!h) return null;
        if (host === null) host = h;
        else if (host !== h) return null;
    }
    return host;
}

const validEntry = (e) => isPlainObject(e) && typeof e.title === 'string' && typeof e.color === 'string'
    && Array.isArray(e.urls) && Number.isFinite(e.updatedAt);
const validSessionEntry = (e) => isPlainObject(e) && typeof e.title === 'string' && typeof e.color === 'string'
    && Array.isArray(e.urls);
const sameUrls = (a, b) => a.length === b.length && a.every((u, i) => u === b[i]);
const sameSessionEntry = (a, b) => a.title === b.title && a.color === b.color && sameUrls(a.urls, b.urls);

function bestMatch(entries, urlSet) {
    let best = null;
    let bestScore = 0;
    for (const e of entries) {
        const score = jaccard(urlSet, new Set(e.urls));
        if (score > bestScore) { best = e; bestScore = score; }
    }
    return bestScore >= MATCH_THRESHOLD ? best : null;
}

/**
 * @param {{
 *   session: { get:(k:string)=>Promise<any>, set:(k:string,v:any)=>Promise<void> },
 *   local:   { get:(k:string)=>Promise<any>, set:(k:string,v:any)=>Promise<void> },
 *   now?: () => number,
 *   persistFingerprints?: boolean,
 *   localWriteDelayMs?: number,
 * }} deps
 *   persistFingerprints: false skips the storage.local tier entirely (Google
 *     Chrome never hides a group, so the tier would only cost writes there).
 *   localWriteDelayMs: trailing delay that coalesces storage.local writes —
 *     observe() runs on every render and a grouped tab navigating changes its
 *     fingerprint each time; the in-memory list is always current, the write is
 *     deferred. 0 = write before observe() resolves (tests).
 */
export function createGroupMetaCache({ session, local, now = () => Date.now(), persistFingerprints = true, localWriteDelayMs = 0 }) {
    /** @type {Record<string, {title:string, color:string, urls:string[]}>} */
    let sessionMap = {};
    /** @type {Array<{title:string, color:string, urls:string[], updatedAt:number}>} */
    let localList = [];
    /** @type {Record<string, true>} */
    let collapsed = {};
    let loaded = false;
    let localWriteTimer = null;

    const safeGet = async (area, key) => { try { return await area.get(key); } catch { return undefined; } };
    const safeSet = async (area, key, value) => { try { await area.set(key, value); } catch { /* memory only */ } };

    const flushLocal = () => {
        localWriteTimer = null;
        return safeSet(local, LOCAL_KEY, localList);
    };
    const scheduleLocalWrite = () => {
        if (localWriteDelayMs <= 0) return flushLocal();
        if (localWriteTimer === null) localWriteTimer = setTimeout(() => { flushLocal(); }, localWriteDelayMs);
        return Promise.resolve();
    };

    async function load() {
        if (loaded) return;
        loaded = true;
        const s = await safeGet(session, SESSION_KEY);
        sessionMap = {};
        if (isPlainObject(s)) for (const [id, e] of Object.entries(s)) if (validSessionEntry(e)) sessionMap[id] = e;
        const l = persistFingerprints ? await safeGet(local, LOCAL_KEY) : undefined;
        localList = Array.isArray(l) ? l.filter(validEntry) : [];
        const c = await safeGet(session, COLLAPSED_KEY);
        collapsed = {};
        if (isPlainObject(c)) for (const [id, v] of Object.entries(c)) if (v === true) collapsed[id] = true;
    }

    /**
     * Record every group the browser currently reports. `tabs` should cover
     * all windows so member URLs (the fingerprint) are complete and so entries
     * of groups no tab references any more can be dropped.
     * @param {Array<{id:number, title?:string, color?:string}>} groups
     * @param {Array<{groupId?:number, url?:string}>} tabs
     */
    async function observe(groups, tabs) {
        const members = new Map();
        for (const t of tabs || []) {
            if (!t || !(t.groupId > 0)) continue;
            if (!members.has(t.groupId)) members.set(t.groupId, new Set());
            const n = normalizeUrl(t.url);
            if (n) members.get(t.groupId).add(n);
        }

        const next = {};
        for (const g of groups || []) {
            if (!g || !(g.id > 0)) continue;
            const urls = [...(members.get(g.id) || [])].slice(0, MAX_URLS_PER_ENTRY);
            next[g.id] = { title: g.title || '', color: g.color || 'grey', urls };
        }
        // Hidden (pinned) groups keep their entry while any tab still carries the id.
        for (const [id, entry] of Object.entries(sessionMap)) {
            if (!(id in next) && members.has(Number(id))) next[id] = entry;
        }
        const sessionChanged = Object.keys(next).length !== Object.keys(sessionMap).length
            || Object.entries(next).some(([id, e]) => !sessionMap[id] || !sameSessionEntry(sessionMap[id], e));
        if (sessionChanged) {
            sessionMap = next;
            await safeSet(session, SESSION_KEY, sessionMap);
        }

        if (!persistFingerprints) return;

        let localChanged = false;
        for (const g of groups || []) {
            const entry = g && next[g.id];
            if (!entry || !entry.title || entry.urls.length === 0) continue; // nothing recoverable
            const match = bestMatch(localList, new Set(entry.urls));
            if (match) {
                if (match.title !== entry.title || match.color !== entry.color || !sameUrls(match.urls, entry.urls)) {
                    match.title = entry.title;
                    match.color = entry.color;
                    match.urls = [...entry.urls];
                    match.updatedAt = now();
                    localChanged = true;
                }
            } else {
                localList.push({ title: entry.title, color: entry.color, urls: [...entry.urls], updatedAt: now() });
                localChanged = true;
            }
        }
        if (localChanged) {
            localList.sort((a, b) => b.updatedAt - a.updatedAt);
            if (localList.length > MAX_LOCAL_ENTRIES) localList.length = MAX_LOCAL_ENTRIES;
            await scheduleLocalWrite();
        }
    }

    /**
     * @param {number} groupId
     * @param {Array<{url?:string}>} memberTabs tabs currently carrying this groupId
     * @returns {{title:string, color:string, source:'session'|'fingerprint'}|null}
     */
    function resolve(groupId, memberTabs) {
        const byId = sessionMap[groupId];
        if (byId) return { title: byId.title, color: byId.color, source: 'session' };
        const urlSet = new Set((memberTabs || []).map(t => normalizeUrl(t && t.url)).filter(Boolean));
        if (!urlSet.size) return null;
        const match = bestMatch(localList, urlSet);
        return match ? { title: match.title, color: match.color, source: 'fingerprint' } : null;
    }

    const isCollapsed = (groupId) => collapsed[groupId] === true;

    async function setCollapsed(groupId, value) {
        if (value) collapsed[groupId] = true;
        else delete collapsed[groupId];
        await safeSet(session, COLLAPSED_KEY, collapsed);
    }

    return { load, observe, resolve, isCollapsed, setCollapsed };
}

/**
 * Builds what a renderer needs to draw a synthetic (browser-hidden) group:
 * cached title/color when known, else the members' common host, else the
 * localized "Pinned group" with a hint on how to recover the name.
 * @param {number} groupId
 * @param {Array<{url?:string}>} members
 * @param {{ resolve: Function, isCollapsed: Function }} cache
 * @param {(key:string)=>string} getMessage i18n lookup ('' when missing)
 * @returns {{id:number, title:string, color:string, collapsed:boolean, synthetic:true, tooltip:string}}
 */
export function buildSyntheticGroupView(groupId, members, cache, getMessage) {
    const meta = cache.resolve(groupId, members);
    const hasTitle = !!(meta && meta.title);
    const fallbackTitle = commonHost(members.map(t => t.url)) || getMessage('pinnedGroupFallbackTitle') || 'Pinned group';
    const title = hasTitle ? meta.title : fallbackTitle;
    const hint = getMessage('pinnedGroupFallbackHint') || 'Name unavailable: unpin and pin this group again once to show it.';
    return {
        id: groupId,
        title,
        color: (meta && meta.color) || 'grey',
        collapsed: cache.isCollapsed(groupId),
        synthetic: true,
        tooltip: hasTitle ? title : `${title}\n${hint}`,
    };
}

let defaultInstance = null;

function chromeArea(name) {
    return {
        get: async (key) => {
            const area = globalThis.chrome && chrome.storage && chrome.storage[name];
            if (!area) throw new Error(`storage.${name} unavailable`);
            const res = await area.get(key);
            return res ? res[key] : undefined;
        },
        set: async (key, value) => {
            const area = globalThis.chrome && chrome.storage && chrome.storage[name];
            if (!area) throw new Error(`storage.${name} unavailable`);
            await area.set({ [key]: value });
        },
    };
}

/** Coalesce storage.local fingerprint writes from navigation bursts in grouped tabs. */
export const LOCAL_WRITE_DELAY_MS = 2000;

/**
 * Default instance backed by chrome.storage.session / chrome.storage.local.
 * The fingerprint tier is only kept on browsers that can hide a group
 * (anything but Google Chrome): Chrome always reports its groups, so the tier
 * would be pure storage churn there.
 */
export function getGroupMetaCache() {
    if (!defaultInstance) {
        defaultInstance = createGroupMetaCache({
            session: chromeArea('session'),
            local: chromeArea('local'),
            persistFingerprints: !getBrowserInfo().isGoogleChrome,
            localWriteDelayMs: LOCAL_WRITE_DELAY_MS,
        });
    }
    return defaultInstance;
}

/** Tests only: drop the default instance so the next getGroupMetaCache() starts clean. */
export function resetGroupMetaCacheForTests() {
    defaultInstance = null;
}
