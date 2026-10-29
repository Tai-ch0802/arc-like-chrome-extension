/**
 * ISSUE-263 — groupMetaCache: remembers title/color of tab groups while they
 * are visible to chrome.tabGroups so the side panel can still label them once
 * Dia pins them (pinning removes the group from the tabGroups model while the
 * member tabs keep their groupId; unpinning re-registers it under the same id).
 *
 * Two tiers: storage.session by group id (same Dia session) and a
 * storage.local member-URL fingerprint (survives a Dia restart, where ids are
 * reassigned).
 */
import {
    createGroupMetaCache,
    normalizeUrl,
    jaccard,
    commonHost,
    SESSION_KEY,
    LOCAL_KEY,
    COLLAPSED_KEY,
    MAX_LOCAL_ENTRIES,
} from '../../modules/groupMetaCache.js';

function fakeArea() {
    const data = {};
    const writes = [];
    return {
        data,
        writes,
        get: async (k) => (k in data ? JSON.parse(JSON.stringify(data[k])) : undefined),
        set: async (k, v) => { data[k] = JSON.parse(JSON.stringify(v)); writes.push(k); },
    };
}

const tab = (id, groupId, url) => ({ id, groupId, url, title: `t${id}` });
const group = (id, title, color = 'blue') => ({ id, title, color, collapsed: false, windowId: 1 });

async function makeCache(opts = {}) {
    const session = fakeArea();
    const local = fakeArea();
    let t = 1000;
    const cache = createGroupMetaCache({ session, local, now: () => t++, ...opts });
    await cache.load();
    return { cache, session, local };
}

describe('helpers', () => {
    it('normalizeUrl keeps origin + pathname and drops query/hash', () => {
        expect(normalizeUrl('https://example.com/a/b?x=1#frag')).toBe('https://example.com/a/b');
        expect(normalizeUrl('https://Example.com')).toBe('https://example.com/');
        expect(normalizeUrl('chrome://extensions/')).toBe('chrome://extensions/');
        expect(normalizeUrl('not a url')).toBe('');
        expect(normalizeUrl(undefined)).toBe('');
    });

    it('jaccard', () => {
        expect(jaccard(new Set([1, 2]), new Set([2, 3]))).toBeCloseTo(1 / 3);
        expect(jaccard(new Set(), new Set())).toBe(0);
        expect(jaccard(new Set([1]), new Set([1]))).toBe(1);
    });

    it('commonHost strips www. and needs every url to share it', () => {
        expect(commonHost(['https://www.github.com/a', 'https://github.com/b'])).toBe('github.com');
        expect(commonHost(['https://a.com/', 'https://b.com/'])).toBeNull();
        expect(commonHost([])).toBeNull();
        expect(commonHost(['chrome://newtab/'])).toBeNull();
    });
});

describe('resolve by id (same session)', () => {
    it('returns the observed title/color for a group that later disappears from the query', async () => {
        const { cache } = await makeCache();
        const tabs = [tab(1, 6, 'https://a.com/x'), tab(2, 6, 'https://b.com/y'), tab(3, -1, 'https://c.com/')];
        await cache.observe([group(6, 'The Browser Company_TEST', 'grey')], tabs);

        // Dia pinned the group: query no longer returns it, tabs keep groupId 6.
        const hit = cache.resolve(6, tabs.filter(t => t.groupId === 6));
        expect(hit).toEqual({ title: 'The Browser Company_TEST', color: 'grey', source: 'session' });
    });

    it('returns null for a group never observed and with no fingerprint match', async () => {
        const { cache } = await makeCache();
        expect(cache.resolve(2, [tab(1, 2, 'https://a.com/')])).toBeNull();
    });

    it('persists the session map and survives a reload from storage.session', async () => {
        const { cache, session, local } = await makeCache();
        await cache.observe([group(4, 'capy-music_TEST', 'purple')], [tab(1, 4, 'https://m.com/')]);
        expect(session.data[SESSION_KEY]).toEqual({ 4: { title: 'capy-music_TEST', color: 'purple', urls: ['https://m.com/'] } });

        const reloaded = createGroupMetaCache({ session, local, now: () => 1 });
        await reloaded.load();
        expect(reloaded.resolve(4, [tab(1, 4, 'https://m.com/')])).toEqual({ title: 'capy-music_TEST', color: 'purple', source: 'session' });
    });

    it('prunes session entries whose id no longer appears on any tab or group (fingerprint tier stays)', async () => {
        const { cache, session } = await makeCache();
        await cache.observe([group(4, 'A')], [tab(1, 4, 'https://m.com/')]);
        expect(cache.resolve(4, [tab(1, 4, 'https://m.com/')]).source).toBe('session');
        await cache.observe([], [tab(1, -1, 'https://m.com/')]); // group closed / tab ungrouped
        expect(session.data[SESSION_KEY]).toEqual({});
        // The id is gone from the session tier; the same members are still recoverable by fingerprint.
        expect(cache.resolve(4, [tab(1, 4, 'https://m.com/')])).toEqual({ title: 'A', color: 'blue', source: 'fingerprint' });
        expect(cache.resolve(4, [tab(1, 4, 'https://other.com/')])).toBeNull();
    });
});

describe('resolve by fingerprint (after restart, ids reassigned)', () => {
    it('matches a pinned group to the local entry whose member urls overlap ≥ 0.5', async () => {
        const { cache, session, local } = await makeCache();
        const before = [tab(1, 6, 'https://a.com/x?q=1'), tab(2, 6, 'https://b.com/y'), tab(3, 6, 'https://c.com/z')];
        await cache.observe([group(6, 'Work', 'red')], before);

        // Restart: new session store, same local store, group now id 2 and one tab navigated away.
        const fresh = createGroupMetaCache({ session: fakeArea(), local, now: () => 1 });
        await fresh.load();
        const after = [tab(10, 2, 'https://a.com/x#top'), tab(11, 2, 'https://b.com/y'), tab(12, 2, 'https://elsewhere.com/')];
        expect(fresh.resolve(2, after)).toEqual({ title: 'Work', color: 'red', source: 'fingerprint' });
        expect(session.data[SESSION_KEY]).toBeDefined(); // old session untouched by the fresh instance
    });

    it('does not match below the threshold', async () => {
        const { cache, local } = await makeCache();
        await cache.observe([group(6, 'Work', 'red')], [tab(1, 6, 'https://a.com/'), tab(2, 6, 'https://b.com/'), tab(3, 6, 'https://c.com/')]);
        const fresh = createGroupMetaCache({ session: fakeArea(), local, now: () => 1 });
        await fresh.load();
        expect(fresh.resolve(9, [tab(10, 9, 'https://a.com/'), tab(11, 9, 'https://x.com/'), tab(12, 9, 'https://y.com/')])).toBeNull();
    });

    it('picks the best-overlapping entry when several exist', async () => {
        const { cache, local } = await makeCache();
        await cache.observe(
            [group(1, 'Alpha', 'blue'), group(2, 'Beta', 'green')],
            [tab(1, 1, 'https://a.com/'), tab(2, 1, 'https://shared.com/'), tab(3, 2, 'https://shared.com/'), tab(4, 2, 'https://b.com/'), tab(5, 2, 'https://b2.com/')],
        );
        const fresh = createGroupMetaCache({ session: fakeArea(), local, now: () => 1 });
        await fresh.load();
        expect(fresh.resolve(7, [tab(9, 7, 'https://shared.com/'), tab(10, 7, 'https://b.com/'), tab(11, 7, 'https://b2.com/')]).title).toBe('Beta');
    });

    it('updates the matching local entry instead of appending a duplicate, and skips untitled groups', async () => {
        const { cache, local } = await makeCache();
        await cache.observe([group(6, 'Work', 'red')], [tab(1, 6, 'https://a.com/'), tab(2, 6, 'https://b.com/')]);
        await cache.observe([group(6, 'Work renamed', 'blue')], [tab(1, 6, 'https://a.com/'), tab(2, 6, 'https://b.com/')]);
        await cache.observe([group(7, '', 'grey')], [tab(3, 7, 'https://untitled.com/')]); // Chrome default: nothing to recover
        expect(local.data[LOCAL_KEY]).toHaveLength(1);
        expect(local.data[LOCAL_KEY][0]).toMatchObject({ title: 'Work renamed', color: 'blue', urls: ['https://a.com/', 'https://b.com/'] });
    });

    it('caps the local list at MAX_LOCAL_ENTRIES, dropping the least recently updated', async () => {
        const { cache, local } = await makeCache();
        for (let i = 0; i < MAX_LOCAL_ENTRIES + 5; i++) {
            await cache.observe([group(100 + i, `G${i}`)], [tab(1000 + i, 100 + i, `https://site${i}.com/`)]);
        }
        expect(local.data[LOCAL_KEY]).toHaveLength(MAX_LOCAL_ENTRIES);
        expect(local.data[LOCAL_KEY].some(e => e.title === 'G0')).toBe(false);
        expect(local.data[LOCAL_KEY].some(e => e.title === `G${MAX_LOCAL_ENTRIES + 4}`)).toBe(true);
    });

    it('writes storage only when something changed', async () => {
        const { cache, session, local } = await makeCache();
        const tabs = [tab(1, 6, 'https://a.com/')];
        await cache.observe([group(6, 'Work')], tabs);
        const s = session.writes.length, l = local.writes.length;
        await cache.observe([group(6, 'Work')], tabs);
        await cache.observe([group(6, 'Work')], tabs);
        expect(session.writes.length).toBe(s);
        expect(local.writes.length).toBe(l);
    });
});

describe('storage.local tier knobs', () => {
    it('persistFingerprints:false never reads or writes storage.local and resolves by id only', async () => {
        const session = fakeArea();
        const local = fakeArea();
        local.data[LOCAL_KEY] = [{ title: 'Old', color: 'red', urls: ['https://a.com/'], updatedAt: 1 }];
        const cache = createGroupMetaCache({ session, local, now: () => 1, persistFingerprints: false });
        await cache.load();
        const tabs = [tab(1, 6, 'https://a.com/')];
        await cache.observe([group(6, 'Work')], tabs);
        expect(local.writes).toEqual([]);
        expect(cache.resolve(6, tabs)).toEqual({ title: 'Work', color: 'blue', source: 'session' });
        expect(cache.resolve(9, [tab(2, 9, 'https://a.com/')])).toBeNull(); // no fingerprint tier
    });

    it('localWriteDelayMs coalesces a burst of fingerprint changes into one trailing write', async () => {
        const session = fakeArea();
        const local = fakeArea();
        const cache = createGroupMetaCache({ session, local, now: () => 1, localWriteDelayMs: 30 });
        await cache.load();
        const members = (first) => [tab(1, 6, first), tab(2, 6, 'https://b.com/y'), tab(3, 6, 'https://c.com/z')];
        await cache.observe([group(6, 'Work')], members('https://a.com/1'));
        await cache.observe([group(6, 'Work')], members('https://a.com/2')); // one tab navigated
        await cache.observe([group(6, 'Work')], members('https://a.com/3'));
        expect(local.writes.length).toBe(0); // deferred
        // In-memory list is already current (one entry, latest urls).
        expect(local.data[LOCAL_KEY]).toBeUndefined();
        expect(cache.resolve(9, [tab(5, 9, 'https://a.com/3'), tab(6, 9, 'https://b.com/y'), tab(7, 9, 'https://c.com/z')]).title).toBe('Work');
        await new Promise(r => setTimeout(r, 60));
        expect(local.writes.length).toBe(1);
        expect(local.data[LOCAL_KEY]).toHaveLength(1);
        expect(local.data[LOCAL_KEY][0].urls).toEqual(['https://a.com/3', 'https://b.com/y', 'https://c.com/z']);
    });
});

describe('collapsed state for synthetic groups', () => {
    it('defaults to expanded, persists to storage.session, and reloads', async () => {
        const { cache, session, local } = await makeCache();
        expect(cache.isCollapsed(5)).toBe(false);
        await cache.setCollapsed(5, true);
        expect(cache.isCollapsed(5)).toBe(true);
        expect(session.data[COLLAPSED_KEY]).toEqual({ 5: true });
        await cache.setCollapsed(5, false);
        expect(session.data[COLLAPSED_KEY]).toEqual({});

        await cache.setCollapsed(8, true);
        const reloaded = createGroupMetaCache({ session, local, now: () => 1 });
        await reloaded.load();
        expect(reloaded.isCollapsed(8)).toBe(true);
    });
});

describe('degradation', () => {
    it('works in memory when storage areas throw (no storage.session on old Chromium)', async () => {
        const broken = { get: async () => { throw new Error('nope'); }, set: async () => { throw new Error('nope'); } };
        const cache = createGroupMetaCache({ session: broken, local: broken, now: () => 1 });
        await expect(cache.load()).resolves.toBeUndefined();
        const tabs = [tab(1, 6, 'https://a.com/')];
        await expect(cache.observe([group(6, 'Work')], tabs)).resolves.toBeUndefined();
        expect(cache.resolve(6, tabs)).toEqual({ title: 'Work', color: 'blue', source: 'session' });
        await expect(cache.setCollapsed(6, true)).resolves.toBeUndefined();
        expect(cache.isCollapsed(6)).toBe(true);
    });

    it('tolerates malformed stored values', async () => {
        const session = fakeArea(); session.data[SESSION_KEY] = 'garbage'; session.data[COLLAPSED_KEY] = 42;
        const local = fakeArea(); local.data[LOCAL_KEY] = { not: 'an array' };
        const cache = createGroupMetaCache({ session, local, now: () => 1 });
        await cache.load();
        expect(cache.resolve(1, [tab(1, 1, 'https://a.com/')])).toBeNull();
        expect(cache.isCollapsed(1)).toBe(false);
    });
});
