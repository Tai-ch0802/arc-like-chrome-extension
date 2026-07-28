// Unit tests for modules/lifecycle/archiveStore.js (BASE-024).
// chrome.storage.local stubbed in-memory (rulesStore.test.mjs convention).
import { ARCHIVE_MAX_ITEMS } from '../../modules/lifecycle/lifecycleLogic.js';
import * as archiveStore from '../../modules/lifecycle/archiveStore.js';

let store;
let failNextSet;

beforeEach(() => {
    store = {};
    failNextSet = false;
    globalThis.chrome = {
        ...globalThis.chrome,
        runtime: { ...(globalThis.chrome?.runtime || {}), lastError: undefined },
        storage: {
            ...(globalThis.chrome?.storage || {}),
            local: {
                get: (keys, cb) => {
                    const out = {};
                    for (const k of Object.keys(keys)) out[k] = k in store ? store[k] : keys[k];
                    cb(out);
                },
                set: (items, cb) => {
                    if (failNextSet) {
                        failNextSet = false;
                        globalThis.chrome.runtime.lastError = { message: 'quota boom' };
                        cb();
                        globalThis.chrome.runtime.lastError = undefined;
                        return;
                    }
                    Object.assign(store, items);
                    cb();
                },
            },
            onChanged: { addListener: () => {} },
        },
    };
});

const item = (id, over = {}) => ({
    id, url: `https://example.com/${id}`, title: id,
    favIconUrl: '', archivedAt: 1000, source: 'auto', ...over,
});

describe('archived list', () => {
    test('addArchived prepends newest-first and persists', async () => {
        await archiveStore.addArchived([item('a')]);
        await archiveStore.addArchived([item('b')]);
        const state = await archiveStore.getArchived();
        expect(state.items.map(i => i.id)).toEqual(['b', 'a']);
        expect(state.schemaVersion).toBe(1);
    });

    test(`FIFO cap at ${ARCHIVE_MAX_ITEMS}: oldest dropped (FR-2.01)`, async () => {
        const bulk = Array.from({ length: ARCHIVE_MAX_ITEMS }, (_, i) => item(`x${i}`));
        await archiveStore.addArchived(bulk);
        await archiveStore.addArchived([item('newest')]);
        const state = await archiveStore.getArchived();
        expect(state.items).toHaveLength(ARCHIVE_MAX_ITEMS);
        expect(state.items[0].id).toBe('newest');
        expect(state.items.find(i => i.id === `x${ARCHIVE_MAX_ITEMS - 1}`)).toBeUndefined();
    });

    test('removeArchived / clearArchived', async () => {
        await archiveStore.addArchived([item('a'), item('b'), item('c')]);
        await archiveStore.removeArchived(['b']);
        expect((await archiveStore.getArchived()).items.map(i => i.id)).toEqual(['a', 'c']);
        await archiveStore.clearArchived();
        expect((await archiveStore.getArchived()).items).toEqual([]);
    });

    test('addArchived REJECTS on storage failure — the FR-1.04 gate', async () => {
        failNextSet = true;
        await expect(archiveStore.addArchived([item('a')])).rejects.toThrow();
        expect((await archiveStore.getArchived()).items).toEqual([]);
    });
});

describe('snoozed list', () => {
    const snooze = (id, wakeAt) => ({ id, url: `https://example.com/${id}`, title: id, favIconUrl: '', snoozedAt: 1, wakeAt });

    test('addSnoozed / getSnoozed / removeSnoozed round-trip', async () => {
        await archiveStore.addSnoozed(snooze('s1', 100));
        await archiveStore.addSnoozed(snooze('s2', 200));
        expect((await archiveStore.getSnoozed()).items.map(i => i.id)).toEqual(['s2', 's1']);
        await archiveStore.removeSnoozed('s1');
        expect((await archiveStore.getSnoozed()).items.map(i => i.id)).toEqual(['s2']);
    });

    test('addSnoozed REJECTS on storage failure — the FR-4.02 gate', async () => {
        failNextSet = true;
        await expect(archiveStore.addSnoozed(snooze('s1', 100))).rejects.toThrow();
        expect((await archiveStore.getSnoozed()).items).toEqual([]);
    });
});
