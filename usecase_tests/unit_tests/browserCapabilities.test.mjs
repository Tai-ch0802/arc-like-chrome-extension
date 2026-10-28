/**
 * ISSUE-257 WP1/WP0 — browser capability detection (pure parts + flag store).
 *
 * Dia (Chromium fork) throws `Error: No window` from chrome.tabs.group and has
 * no Google-account layer. These helpers decide when a failure means "this
 * browser cannot do tab groups", never set that flag on Chrome's transient
 * errors, and reset it when the browser brand/major version changes.
 */
import {
    parseBrowserInfo,
    classifyTabGroupFailure,
    decideActionClick,
    shouldResetCapabilityFlag,
    createCapabilityStore,
    CAP_TAB_GROUPS,
    CAP_SIDE_PANEL,
} from '../../modules/utils/browserCapabilities.js';

const DIA_BRANDS = [{ brand: 'Not:A-Brand', version: '8' }, { brand: 'Chromium', version: '156' }];
const CHROME_BRANDS = [{ brand: 'Google Chrome', version: '156' }, { brand: 'Chromium', version: '156' }, { brand: 'Not_A Brand', version: '99' }];
const EDGE_BRANDS = [{ brand: 'Microsoft Edge', version: '156' }, { brand: 'Chromium', version: '156' }];
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36';

describe('parseBrowserInfo', () => {
    it('recognises Google Chrome from userAgentData brands', () => {
        expect(parseBrowserInfo(CHROME_BRANDS, UA)).toEqual({ isGoogleChrome: true, brand: 'Google Chrome', majorVersion: 156 });
    });

    it('treats a brand list without Google Chrome (Dia) as non-Chrome, naming the Chromium brand', () => {
        expect(parseBrowserInfo(DIA_BRANDS, UA)).toEqual({ isGoogleChrome: false, brand: 'Chromium', majorVersion: 156 });
    });

    it('prefers a named vendor brand over the generic Chromium entry', () => {
        expect(parseBrowserInfo(EDGE_BRANDS, UA)).toEqual({ isGoogleChrome: false, brand: 'Microsoft Edge', majorVersion: 156 });
    });

    it('falls back to "assume Chrome" with the UA major version when brands are unavailable', () => {
        expect(parseBrowserInfo(undefined, UA)).toEqual({ isGoogleChrome: true, brand: 'unknown', majorVersion: 156 });
    });

    it('yields majorVersion 0 when nothing parses', () => {
        expect(parseBrowserInfo(undefined, 'Node.js/26')).toEqual({ isGoogleChrome: true, brand: 'unknown', majorVersion: 0 });
    });
});

describe('classifyTabGroupFailure', () => {
    const chrome = { isGoogleChrome: true, brand: 'Google Chrome', majorVersion: 156 };
    const dia = { isGoogleChrome: false, brand: 'Chromium', majorVersion: 156 };

    it('marks unsupported on the Dia-specific "No window" error regardless of brand or streak', () => {
        expect(classifyTabGroupFailure('No window', dia, 1)).toBe(true);
        expect(classifyTabGroupFailure('Error: No window', chrome, 1)).toBe(true);
    });

    it('never marks unsupported on a Chrome transient drag error', () => {
        const msg = 'Tabs cannot be edited right now (user may be dragging a tab).';
        expect(classifyTabGroupFailure(msg, chrome, 5)).toBe(false);
    });

    it('marks a non-Chrome brand unsupported only after two consecutive generic failures', () => {
        expect(classifyTabGroupFailure('something odd', dia, 1)).toBe(false);
        expect(classifyTabGroupFailure('something odd', dia, 2)).toBe(true);
    });

    it('never marks Chrome unsupported on generic failures, however many', () => {
        expect(classifyTabGroupFailure('something odd', chrome, 10)).toBe(false);
    });

    it('tolerates a missing message', () => {
        expect(classifyTabGroupFailure(undefined, dia, 2)).toBe(true);
        expect(classifyTabGroupFailure(undefined, chrome, 2)).toBe(false);
    });
});

describe('decideActionClick', () => {
    it('is a no-op on Google Chrome (openPanelOnActionClick handles it)', () => {
        expect(decideActionClick({ isGoogleChrome: true, panelOpen: false, sidePanelUnavailable: false })).toBe('noop');
    });

    it('opens the panel on a non-Chrome browser when closed', () => {
        expect(decideActionClick({ isGoogleChrome: false, panelOpen: false, sidePanelUnavailable: false })).toBe('open');
    });

    it('closes the panel on a non-Chrome browser when open', () => {
        expect(decideActionClick({ isGoogleChrome: false, panelOpen: true, sidePanelUnavailable: false })).toBe('close');
    });

    it('routes to the options page once the side panel is known to be unavailable', () => {
        expect(decideActionClick({ isGoogleChrome: false, panelOpen: false, sidePanelUnavailable: true })).toBe('options');
    });
});

describe('shouldResetCapabilityFlag', () => {
    const info = { isGoogleChrome: false, brand: 'Chromium', majorVersion: 156 };

    it('keeps the flag while brand and major version match', () => {
        expect(shouldResetCapabilityFlag({ unsupported: true, brand: 'Chromium', majorVersion: 156 }, info)).toBe(false);
    });

    it('resets when the major version changed (browser upgrade may have fixed it)', () => {
        expect(shouldResetCapabilityFlag({ unsupported: true, brand: 'Chromium', majorVersion: 155 }, info)).toBe(true);
    });

    it('resets when the brand changed', () => {
        expect(shouldResetCapabilityFlag({ unsupported: true, brand: 'Microsoft Edge', majorVersion: 156 }, info)).toBe(true);
    });

    it('has nothing to reset when no flag is stored', () => {
        expect(shouldResetCapabilityFlag(undefined, info)).toBe(false);
    });
});

function fakeKv() {
    const data = {};
    return {
        data,
        get: async (k) => data[k],
        set: async (k, v) => { data[k] = JSON.parse(JSON.stringify(v)); },
        remove: async (k) => { delete data[k]; },
    };
}

describe('createCapabilityStore', () => {
    const dia = { isGoogleChrome: false, brand: 'Chromium', majorVersion: 156 };

    it('records an unsupported flag carrying brand, major version and a timestamp', async () => {
        const kv = fakeKv();
        const store = createCapabilityStore({ storage: kv, getInfo: () => dia, now: () => 1234 });
        await store.markUnsupported(CAP_TAB_GROUPS);
        expect(kv.data[CAP_TAB_GROUPS]).toEqual({ unsupported: true, brand: 'Chromium', majorVersion: 156, at: 1234 });
        expect(await store.isUnsupported(CAP_TAB_GROUPS)).toBe(true);
    });

    it('answers "supported" when no flag is stored', async () => {
        const store = createCapabilityStore({ storage: fakeKv(), getInfo: () => dia, now: () => 0 });
        expect(await store.isUnsupported(CAP_TAB_GROUPS)).toBe(false);
        expect(await store.isUnsupported(CAP_SIDE_PANEL)).toBe(false);
    });

    it('resets stale flags when the browser changed, keeps matching ones', async () => {
        const kv = fakeKv();
        kv.data[CAP_TAB_GROUPS] = { unsupported: true, brand: 'Chromium', majorVersion: 150, at: 1 };
        kv.data[CAP_SIDE_PANEL] = { unsupported: true, brand: 'Chromium', majorVersion: 156, at: 1 };
        const store = createCapabilityStore({ storage: kv, getInfo: () => dia, now: () => 0 });
        const reset = await store.resetIfBrowserChanged();
        expect(reset).toEqual([CAP_TAB_GROUPS]);
        expect(kv.data[CAP_TAB_GROUPS]).toBeUndefined();
        expect(kv.data[CAP_SIDE_PANEL]).toBeDefined();
    });

    it('invalidates its cache when told a flag changed externally', async () => {
        const kv = fakeKv();
        const store = createCapabilityStore({ storage: kv, getInfo: () => dia, now: () => 0 });
        expect(await store.isUnsupported(CAP_TAB_GROUPS)).toBe(false);
        kv.data[CAP_TAB_GROUPS] = { unsupported: true, brand: 'Chromium', majorVersion: 156, at: 1 };
        expect(await store.isUnsupported(CAP_TAB_GROUPS)).toBe(false); // cached
        store.invalidate(CAP_TAB_GROUPS);
        expect(await store.isUnsupported(CAP_TAB_GROUPS)).toBe(true);
    });
});

// Review round 1: Chromium's recoverable errors (stale ids, mid-drag) must never
// count on ANY brand — Edge/Brave/Chrome-for-Testing all report a non-Chrome brand.
import { isTransientTabGroupError } from '../../modules/utils/browserCapabilities.js';

describe('isTransientTabGroupError / classify on non-Chrome', () => {
    const dia = { isGoogleChrome: false, brand: 'Chromium', majorVersion: 156 };
    it('recognises the recoverable Chromium messages', () => {
        expect(isTransientTabGroupError('No tab with id: 42.')).toBe(true);
        expect(isTransientTabGroupError('No group with id: 7.')).toBe(true);
        expect(isTransientTabGroupError('Tabs cannot be edited right now (user may be dragging a tab).')).toBe(true);
        expect(isTransientTabGroupError('No window')).toBe(false);
        expect(isTransientTabGroupError(undefined)).toBe(false);
    });
    it('never marks unsupported on a transient error, even past the streak on a non-Chrome brand', () => {
        expect(classifyTabGroupFailure('No tab with id: 42.', dia, 5)).toBe(false);
        expect(classifyTabGroupFailure('No group with id: 7.', dia, 5)).toBe(false);
    });
});

describe('createCapabilityStore — diagnostic extras (review round 1)', () => {
    const dia = { isGoogleChrome: false, brand: 'Chromium', majorVersion: 156 };
    it('keeps a reason alongside the flag and exposes it via getFlag', async () => {
        const kv = fakeKv();
        const store = createCapabilityStore({ storage: kv, getInfo: () => dia, now: () => 5 });
        await store.markUnsupported(CAP_SIDE_PANEL, { reason: 'no-onOpened' });
        expect(kv.data[CAP_SIDE_PANEL]).toEqual({ reason: 'no-onOpened', unsupported: true, brand: 'Chromium', majorVersion: 156, at: 5 });
        expect((await store.getFlag(CAP_SIDE_PANEL)).reason).toBe('no-onOpened');
    });
});


// Final review C1: Chromium's own "No window with id: N." (window closed mid-call)
// must never be mistaken for Dia's bare "No window".
describe('classifyTabGroupFailure — Dia "No window" vs Chromium "No window with id"', () => {
    const chrome = { isGoogleChrome: true, brand: 'Google Chrome', majorVersion: 156 };
    const dia = { isGoogleChrome: false, brand: 'Chromium', majorVersion: 156 };
    it('treats "No window with id: N." as transient on every brand', () => {
        expect(isTransientTabGroupError('No window with id: 123.')).toBe(true);
        expect(classifyTabGroupFailure('No window with id: 123.', chrome, 1)).toBe(false);
        expect(classifyTabGroupFailure('No window with id: 123.', dia, 5)).toBe(false);
    });
    it('still recognises the bare Dia message in its observed spellings', () => {
        expect(classifyTabGroupFailure('No window', dia, 1)).toBe(true);
        expect(classifyTabGroupFailure('Error: No window', chrome, 1)).toBe(true);
        expect(classifyTabGroupFailure('No window.', chrome, 1)).toBe(true);
        expect(classifyTabGroupFailure(' no window ', chrome, 1)).toBe(true);
    });
});
