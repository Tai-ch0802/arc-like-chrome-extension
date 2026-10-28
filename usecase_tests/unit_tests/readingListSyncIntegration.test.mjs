/**
 * ISSUE-257 WP4 — reading list ↔ Drive two-way sync, end-to-end in Node.
 *
 * Pieces under test: createReadingListSyncStore (SW-side sidecar + echo guard
 * over a chrome.readingList-like API), runReadingListSync (one cycle against a
 * SyncProvider) and the pure merge in readingListSyncLogic. Two "devices" each
 * get their own fake reading list + fake storage; both share the in-memory
 * fake SyncProvider.
 */
import { createReadingListSyncStore } from '../../modules/readingList/readingListSyncStore.js';
import { runReadingListSync, READING_LIST_SYNC_FILE } from '../../modules/readingList/readingListSync.js';
import { createFakeSyncProvider } from '../../modules/sync/syncProvider.js';

/** Minimal chrome.readingList fake that also fires the three events. */
function fakeReadingList() {
    const entries = new Map();
    const listeners = { added: [], removed: [], updated: [] };
    const fire = (kind, entry) => listeners[kind].forEach((fn) => fn({ ...entry }));
    const now = () => Date.now();
    return {
        entries,
        api: {
            query: async ({ url } = {}) => {
                const all = [...entries.values()].map((e) => ({ ...e }));
                return url === undefined ? all : all.filter((e) => e.url === url);
            },
            addEntry: async ({ url, title, hasBeenRead }) => {
                if (entries.has(url)) throw new Error('Duplicate URL.');
                const e = { url, title, hasBeenRead: Boolean(hasBeenRead), creationTime: now(), lastUpdateTime: now() };
                entries.set(url, e);
                fire('added', e);
            },
            updateEntry: async ({ url, title, hasBeenRead }) => {
                const e = entries.get(url);
                if (!e) throw new Error('Not found.');
                if (title !== undefined) e.title = title;
                if (hasBeenRead !== undefined) e.hasBeenRead = hasBeenRead;
                e.lastUpdateTime = now();
                fire('updated', e);
            },
            removeEntry: async ({ url }) => {
                const e = entries.get(url);
                if (!e) throw new Error('Not found.');
                entries.delete(url);
                fire('removed', e);
            },
            onEntryAdded: { addListener: (fn) => listeners.added.push(fn) },
            onEntryRemoved: { addListener: (fn) => listeners.removed.push(fn) },
            onEntryUpdated: { addListener: (fn) => listeners.updated.push(fn) },
        },
    };
}

function fakeKv() {
    const data = {};
    const clone = (v) => JSON.parse(JSON.stringify(v));
    return {
        data,
        get: async (k) => (k in data ? clone(data[k]) : undefined),
        set: async (k, v) => { data[k] = clone(v); },
        remove: async (k) => { delete data[k]; },
    };
}

function device(clock0 = 1_000_000) {
    const rl = fakeReadingList();
    const kv = fakeKv();
    let clock = clock0;
    const store = createReadingListSyncStore({ readingList: rl.api, storage: kv, now: () => clock });
    store.attach(); // registers the event listeners
    const sync = (provider) => runReadingListSync({ provider, store, now: () => clock });
    return { rl, kv, store, sync, tick: (n) => { clock += n; } };
}

// Let the fake events' async handlers settle.
const settle = () => new Promise((r) => setTimeout(r, 0));

describe('reading list sync — cross-device', () => {
    it('an entry added on A appears on B, and B pushes nothing back (echo guard)', async () => {
        const provider = createFakeSyncProvider();
        const A = device(); const B = device(2_000_000);
        await A.rl.api.addEntry({ url: 'https://x/1', title: 'One', hasBeenRead: false });
        await settle();
        await A.sync(provider);
        const v1 = (await provider.read(READING_LIST_SYNC_FILE)).version;

        await B.sync(provider);
        await settle();
        expect(B.rl.entries.get('https://x/1')).toMatchObject({ title: 'One', hasBeenRead: false });
        // The addEntry on B fired onEntryAdded — the echo guard must not treat it
        // as a local edit, so a second cycle writes nothing.
        await B.sync(provider);
        expect((await provider.read(READING_LIST_SYNC_FILE)).version).toBe(v1);
    });

    it('marking read on B propagates to A', async () => {
        const provider = createFakeSyncProvider();
        const A = device(); const B = device();
        await A.rl.api.addEntry({ url: 'https://x/2', title: 'Two', hasBeenRead: false });
        await settle();
        await A.sync(provider); await B.sync(provider); await settle();
        B.tick(10);
        await B.rl.api.updateEntry({ url: 'https://x/2', hasBeenRead: true });
        await settle();
        await B.sync(provider); await A.sync(provider); await settle();
        expect(A.rl.entries.get('https://x/2').hasBeenRead).toBe(true);
    });

    it('AC-4.02: a delete on A beats a later-pulled read-toggle on B; nothing resurrects', async () => {
        const provider = createFakeSyncProvider();
        const A = device(); const B = device();
        await A.rl.api.addEntry({ url: 'https://x/3', title: 'Three', hasBeenRead: false });
        await settle();
        await A.sync(provider); await B.sync(provider); await settle();
        // B toggles read BEFORE A's delete, but only syncs after it.
        B.tick(5);
        await B.rl.api.updateEntry({ url: 'https://x/3', hasBeenRead: true });
        await settle();
        A.tick(50);
        await A.rl.api.removeEntry({ url: 'https://x/3' });
        await settle();
        await A.sync(provider);
        await B.sync(provider); await settle();
        await A.sync(provider); await B.sync(provider); await settle();
        expect(A.rl.entries.has('https://x/3')).toBe(false);
        expect(B.rl.entries.has('https://x/3')).toBe(false);
    });

    it('a deletion made while the clock lags still wins over the entry (tombstone > updatedAt)', async () => {
        const provider = createFakeSyncProvider();
        const A = device(5_000_000); const B = device(1_000_000); // B's clock is far behind
        await A.rl.api.addEntry({ url: 'https://x/4', title: 'Four', hasBeenRead: false });
        await settle();
        await A.sync(provider); await B.sync(provider); await settle();
        await B.rl.api.removeEntry({ url: 'https://x/4' }); // B deletes with now < entry.updatedAt
        await settle();
        await B.sync(provider); await A.sync(provider); await settle();
        expect(A.rl.entries.has('https://x/4')).toBe(false);
    });

    it('re-adding a previously deleted url resurrects it everywhere', async () => {
        const provider = createFakeSyncProvider();
        const A = device(); const B = device();
        await A.rl.api.addEntry({ url: 'https://x/5', title: 'Five', hasBeenRead: false });
        await settle();
        await A.sync(provider); await B.sync(provider); await settle();
        A.tick(10);
        await A.rl.api.removeEntry({ url: 'https://x/5' });
        await settle();
        await A.sync(provider); await B.sync(provider); await settle();
        expect(B.rl.entries.has('https://x/5')).toBe(false);
        A.tick(10);
        await A.rl.api.addEntry({ url: 'https://x/5', title: 'Five again', hasBeenRead: false });
        await settle();
        await A.sync(provider); await B.sync(provider); await settle();
        expect(B.rl.entries.get('https://x/5')).toMatchObject({ title: 'Five again' });
    });

    it('twenty near-simultaneous deletions all produce tombstones (serialised sidecar writes)', async () => {
        const provider = createFakeSyncProvider();
        const A = device();
        for (let i = 0; i < 20; i++) await A.rl.api.addEntry({ url: `https://x/bulk/${i}`, title: `b${i}`, hasBeenRead: true });
        await settle();
        await A.sync(provider);
        await Promise.all([...Array(20).keys()].map((i) => A.rl.api.removeEntry({ url: `https://x/bulk/${i}` })));
        await settle();
        await A.store.idle(); // wait for the serialised sidecar chain
        const tombstones = await A.store.getTombstones();
        expect(Object.keys(tombstones)).toHaveLength(20);
    });

    it('entries that pre-date the sync layer are exported with updatedAt 0 (never dropped as removals)', async () => {
        const provider = createFakeSyncProvider();
        const A = device();
        A.rl.entries.set('https://x/legacy', { url: 'https://x/legacy', title: 'Legacy', hasBeenRead: false, creationTime: 1, lastUpdateTime: 1 });
        await A.sync(provider);
        const file = (await provider.read(READING_LIST_SYNC_FILE)).json;
        expect(file.entries['https://x/legacy']).toMatchObject({ title: 'Legacy', updatedAt: 0 });
        expect(A.rl.entries.has('https://x/legacy')).toBe(true);
    });

    it('does nothing when the provider is not connected', async () => {
        const provider = createFakeSyncProvider({ connected: false });
        const A = device();
        await A.rl.api.addEntry({ url: 'https://x/6', title: 'Six', hasBeenRead: false });
        await settle();
        await A.sync(provider);
        expect(await provider.read(READING_LIST_SYNC_FILE)).toBeNull();
    });
});
