/**
 * ISSUE-257 WP1 — apiManager tab-group wrappers are best-effort.
 *
 * In Dia every chrome.tabs.group() call throws `Error: No window`. The
 * wrappers must swallow that, return null, and record the per-device
 * `tabGroupsUnsupported` flag so callers (reading list open, workspace
 * restore, routing) finish their remaining steps and the UI hides grouping.
 * Chrome's transient errors must NOT set the flag.
 *
 * Module state (failure streak, flag cache) is reset per test via
 * jest.resetModules + require, the same technique as workspacePersistence.test.mjs.
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

function installChrome({ group, tabGroupsQuery = async () => [] }) {
    const local = createFakeArea();
    globalThis.chrome = {
        i18n: { getMessage: () => '' },
        runtime: { lastError: undefined },
        storage: { local, sync: createFakeArea(), session: createFakeArea(), onChanged: { addListener() {} } },
        windows: { WINDOW_ID_CURRENT: -2 },
        tabs: { group: jest.fn(group), ungroup: jest.fn(async () => {}) },
        tabGroups: { update: jest.fn(async () => {}), query: jest.fn(tabGroupsQuery), move: jest.fn(async () => {}) },
    };
    return { local };
}

async function load(brand) {
    jest.resetModules();
    // eslint-disable-next-line global-require
    const caps = require('../../modules/utils/browserCapabilities.js');
    caps.setBrowserInfoOverride(brand);
    // eslint-disable-next-line global-require
    const api = require('../../modules/apiManager.js');
    return { api, caps };
}

const DIA = { isGoogleChrome: false, brand: 'Chromium', majorVersion: 156 };
const CHROME = { isGoogleChrome: true, brand: 'Google Chrome', majorVersion: 156 };

describe('apiManager tab-group guard (ISSUE-257 WP1)', () => {
    afterEach(() => { delete globalThis.chrome; });

    it('addTabToNewGroup returns null and records the flag on "No window"', async () => {
        const { local } = installChrome({ group: async () => { throw new Error('No window'); } });
        const { api, caps } = await load(DIA);
        await expect(api.addTabToNewGroup([1], 'T', 'blue')).resolves.toBeNull();
        expect(local.data[caps.CAP_TAB_GROUPS]).toMatchObject({ unsupported: true, brand: 'Chromium', majorVersion: 156 });
        expect(await api.isTabGroupingAvailable()).toBe(false);
    });

    it('a Chrome transient error returns null but records no flag', async () => {
        const { local } = installChrome({ group: async () => { throw new Error('Tabs cannot be edited right now (user may be dragging a tab).'); } });
        const { api, caps } = await load(CHROME);
        await expect(api.groupTabs([1], 5)).resolves.toBeNull();
        expect(local.data[caps.CAP_TAB_GROUPS]).toBeUndefined();
        expect(await api.isTabGroupingAvailable()).toBe(true);
    });

    it('once the flag is set, addTabToNewGroup short-circuits without touching chrome.tabs.group', async () => {
        const { local } = installChrome({ group: async () => 42 });
        const { api, caps } = await load(DIA);
        local.data[caps.CAP_TAB_GROUPS] = { unsupported: true, brand: 'Chromium', majorVersion: 156, at: 1 };
        await expect(api.addTabToNewGroup([1], 'T', 'blue')).resolves.toBeNull();
        expect(chrome.tabs.group).not.toHaveBeenCalled();
    });

    it('a success between two generic non-Chrome failures resets the streak (no flag)', async () => {
        let calls = 0;
        const { local } = installChrome({ group: async () => { calls += 1; if (calls === 2) return 7; throw new Error('odd'); } });
        const { api, caps } = await load(DIA);
        await expect(api.groupTabs([1])).resolves.toBeNull();   // failure 1
        await expect(api.groupTabs([1])).resolves.toBe(7);      // success resets
        await expect(api.groupTabs([1])).resolves.toBeNull();   // failure 1 again
        expect(local.data[caps.CAP_TAB_GROUPS]).toBeUndefined();
    });

    it('two consecutive generic failures on a non-Chrome brand set the flag', async () => {
        const { local } = installChrome({ group: async () => { throw new Error('odd'); } });
        const { api, caps } = await load(DIA);
        await api.groupTabs([1]);
        await api.groupTabs([1]);
        expect(local.data[caps.CAP_TAB_GROUPS]).toMatchObject({ unsupported: true });
    });

    it('group queries degrade to an empty list when the API rejects', async () => {
        installChrome({ group: async () => 1, tabGroupsQuery: async () => { throw new Error('No window'); } });
        const { api } = await load(DIA);
        await expect(api.getTabGroupsInCurrentWindow()).resolves.toEqual([]);
        await expect(api.getAllTabGroups()).resolves.toEqual([]);
    });

    it('resetCapabilityFlagsIfBrowserChanged clears a flag recorded by an older major version', async () => {
        const { local } = installChrome({ group: async () => 1 });
        const { api, caps } = await load(DIA);
        local.data[caps.CAP_TAB_GROUPS] = { unsupported: true, brand: 'Chromium', majorVersion: 150, at: 1 };
        await expect(api.resetCapabilityFlagsIfBrowserChanged()).resolves.toEqual([caps.CAP_TAB_GROUPS]);
        expect(local.data[caps.CAP_TAB_GROUPS]).toBeUndefined();
        expect(await api.isTabGroupingAvailable()).toBe(true);
    });
});

describe('apiManager tab-group guard — review round 1', () => {
    afterEach(() => { delete globalThis.chrome; });

    it('addTabToNewGroup returns the group id when the group was created but titling failed', async () => {
        installChrome({ group: async () => 42 });
        chrome.tabGroups.update = jest.fn(async () => { throw new Error('No group with id: 42.'); });
        const { api } = await load(CHROME);
        await expect(api.addTabToNewGroup([1], 'T', 'blue')).resolves.toBe(42);
    });

    it('ungroup/move/update failures do not count toward the unsupported streak', async () => {
        const { local } = installChrome({ group: async () => 1 });
        chrome.tabs.ungroup = jest.fn(async () => { throw new Error('odd'); });
        chrome.tabGroups.move = jest.fn(async () => { throw new Error('odd'); });
        chrome.tabGroups.update = jest.fn(async () => { throw new Error('odd'); });
        const { api, caps } = await load(DIA);
        await api.ungroupTabs([1]);
        await api.moveTabGroup(1, 0);
        await api.updateTabGroup(1, { collapsed: true });
        await api.ungroupTabs([1]);
        expect(local.data[caps.CAP_TAB_GROUPS]).toBeUndefined();
    });

    it('two transient "No tab with id" failures on a non-Chrome brand set no flag', async () => {
        const { local } = installChrome({ group: async () => { throw new Error('No tab with id: 9.'); } });
        const { api, caps } = await load(DIA);
        await api.groupTabs([9]);
        await api.groupTabs([9]);
        expect(local.data[caps.CAP_TAB_GROUPS]).toBeUndefined();
        expect(await api.isTabGroupingAvailable()).toBe(true);
    });

    it('a flag written by another context is seen after storage.onChanged fires', async () => {
        const { local } = installChrome({ group: async () => 1 });
        const listeners = [];
        chrome.storage.onChanged.addListener = (fn) => listeners.push(fn);
        const { api, caps } = await load(DIA);
        expect(await api.isTabGroupingAvailable()).toBe(true); // cached as supported
        local.data[caps.CAP_TAB_GROUPS] = { unsupported: true, brand: 'Chromium', majorVersion: 156, at: 1 };
        listeners.forEach((fn) => fn({ [caps.CAP_TAB_GROUPS]: { newValue: local.data[caps.CAP_TAB_GROUPS] } }, 'local'));
        expect(await api.isTabGroupingAvailable()).toBe(false);
    });
});


describe('apiManager tab-group guard — final review', () => {
    afterEach(() => { delete globalThis.chrome; });
    it('"No window with id" (window closed mid-call) on Chrome sets no flag', async () => {
        const { local } = installChrome({ group: async () => { throw new Error('No window with id: 42.'); } });
        const { api, caps } = await load(CHROME);
        await expect(api.addTabToNewGroup([1], 'T', 'blue')).resolves.toBeNull();
        expect(local.data[caps.CAP_TAB_GROUPS]).toBeUndefined();
    });
    it('groupTabs (join) short-circuits once the flag is set, like addTabToNewGroup', async () => {
        const { local } = installChrome({ group: async () => 42 });
        const { api, caps } = await load(DIA);
        local.data[caps.CAP_TAB_GROUPS] = { unsupported: true, brand: 'Chromium', majorVersion: 156, at: 1 };
        await expect(api.groupTabs([1], 5)).resolves.toBeNull();
        expect(chrome.tabs.group).not.toHaveBeenCalled();
    });
});
