/**
 * ISSUE-257 AC-1.01 — the real failure path: chrome.tabs.group throws
 * `Error: No window` (Dia) while a reading-list item is opened. The tab must
 * still be created and the entry marked read; the flag gets recorded.
 */
function createFakeArea() {
    const data = {};
    return {
        data,
        get(keys, cb) {
            const out = {};
            const arr = keys === null || keys === undefined ? Object.keys(data) : [].concat(keys);
            for (const k of arr) if (k in data) out[k] = JSON.parse(JSON.stringify(data[k]));
            cb(out);
        },
        set(items, cb) { Object.assign(data, JSON.parse(JSON.stringify(items))); if (cb) cb(); },
        remove(keys, cb) { for (const k of [].concat(keys)) delete data[k]; if (cb) cb(); },
    };
}

async function loadFresh() {
    jest.resetModules();
    // eslint-disable-next-line global-require
    const caps = require('../../modules/utils/browserCapabilities.js');
    caps.setBrowserInfoOverride({ isGoogleChrome: false, brand: 'Chromium', majorVersion: 156 });
    // eslint-disable-next-line global-require
    const manager = require('../../modules/readingListManager.js');
    return { manager, caps };
}

describe('readingListManager.openReadingListItem when tabs.group throws "No window"', () => {
    let local;
    beforeEach(() => {
        local = createFakeArea();
        globalThis.chrome = {
            i18n: { getMessage: () => '' },
            runtime: { lastError: undefined, sendMessage: async () => {} },
            storage: { local, sync: createFakeArea(), session: createFakeArea(), onChanged: { addListener() {} } },
            windows: { WINDOW_ID_CURRENT: -2 },
            tabs: {
                create: jest.fn(async (opts) => ({ id: 11, url: opts.url, active: true })),
                query: jest.fn(async () => []),
                group: jest.fn(async () => { throw new Error('No window'); }),
                ungroup: jest.fn(async () => {}),
            },
            tabGroups: { query: jest.fn(async () => []), update: jest.fn(async () => {}), TAB_GROUP_ID_NONE: -1 },
            readingList: { updateEntry: jest.fn(async () => {}), query: jest.fn(async () => []), addEntry: jest.fn(async () => {}), removeEntry: jest.fn(async () => {}) },
        };
    });
    afterEach(() => { delete globalThis.chrome; });

    it('opens the tab, marks the entry read, and records the capability flag', async () => {
        const { manager, caps } = await loadFresh();
        const tab = await manager.openReadingListItem({ url: 'https://example.com/a', title: 'A' });
        expect(tab.id).toBe(11);
        expect(chrome.tabs.create).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://example.com/a' }));
        expect(chrome.readingList.updateEntry).toHaveBeenCalledWith({ url: 'https://example.com/a', hasBeenRead: true });
        expect(local.data[caps.CAP_TAB_GROUPS]).toMatchObject({ unsupported: true });
    });

    it('on the second open the group call is skipped entirely (flag short-circuit)', async () => {
        const { manager } = await loadFresh();
        await manager.openReadingListItem({ url: 'https://example.com/a', title: 'A' });
        chrome.tabs.group.mockClear();
        await manager.openReadingListItem({ url: 'https://example.com/b', title: 'B' });
        expect(chrome.tabs.group).not.toHaveBeenCalled();
        expect(chrome.readingList.updateEntry).toHaveBeenLastCalledWith({ url: 'https://example.com/b', hasBeenRead: true });
    });
});
