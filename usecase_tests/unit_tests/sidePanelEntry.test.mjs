/**
 * ISSUE-257 WP0 — side panel entry point on browsers that are not Google
 * Chrome. Chrome's `openPanelOnActionClick` is left untouched there; elsewhere
 * the extension toggles the panel itself from chrome.action.onClicked, waits
 * for sidePanel.onOpened, and on failure records `sidePanelUnavailable` and
 * opens the options page (no detached-window fallback, PRD FR-0.02).
 *
 * All effects are injected so this runs in Node with fakes.
 */
import { createSidePanelEntry } from '../../modules/sidePanelEntry.js';

const CHROME = { isGoogleChrome: true, brand: 'Google Chrome', majorVersion: 156 };
const DIA = { isGoogleChrome: false, brand: 'Chromium', majorVersion: 156 };

function makeFakes({ info = DIA, openImpl, withEvents = true, withClose = true, unavailable = false } = {}) {
    const calls = { open: [], close: [], behavior: [], options: 0, marked: 0, log: [] };
    const listeners = { opened: [], closed: [] };
    const sidePanel = {
        open: async (opts) => { calls.open.push(opts); if (openImpl) return openImpl(opts); },
        setPanelBehavior: async (b) => { calls.behavior.push(b); },
    };
    if (withClose) sidePanel.close = async (opts) => { calls.close.push(opts); };
    if (withEvents) {
        sidePanel.onOpened = { addListener: (fn) => listeners.opened.push(fn) };
        sidePanel.onClosed = { addListener: (fn) => listeners.closed.push(fn) };
    }
    const sessionData = {};
    let flag = unavailable;
    const deps = {
        sidePanel,
        runtime: { openOptionsPage: async () => { calls.options += 1; } },
        session: { get: async (k) => sessionData[k], set: async (k, v) => { sessionData[k] = v; } },
        caps: { isSidePanelUnavailable: async () => flag, markSidePanelUnavailable: async (reason) => { flag = true; calls.marked += 1; calls.reasons = (calls.reasons || []).concat([reason]); } },
        getInfo: () => info,
        // Resolves when the "timeout" elapses; tests decide whether it ever does.
        waitTimeout: () => new Promise(() => {}),
        log: { info: (...a) => calls.log.push(a.join(' ')), warn: (...a) => calls.log.push('WARN ' + a.join(' ')) },
    };
    const fireOpened = (windowId) => listeners.opened.forEach((fn) => fn({ windowId }));
    const fireClosed = (windowId) => listeners.closed.forEach((fn) => fn({ windowId }));
    return { deps, calls, sessionData, fireOpened, fireClosed };
}

describe('createSidePanelEntry — Google Chrome', () => {
    it('init leaves the browser behaviour alone and clicks are no-ops', async () => {
        const { deps, calls } = makeFakes({ info: CHROME });
        const entry = createSidePanelEntry(deps);
        await entry.init();
        expect(calls.behavior).toEqual([]);
        await entry.handleActionClick({ windowId: 1 });
        expect(calls.open).toEqual([]);
        expect(calls.options).toBe(0);
    });
});

describe('createSidePanelEntry — non-Chrome (Dia)', () => {
    it('init disables openPanelOnActionClick so the extension owns the toggle', async () => {
        const { deps, calls } = makeFakes();
        await createSidePanelEntry(deps).init();
        expect(calls.behavior).toEqual([{ openPanelOnActionClick: false }]);
    });

    it('first click opens the panel; once onOpened fires, the next click closes it', async () => {
        const { deps, calls, fireOpened } = makeFakes({ openImpl: async (opts) => { setTimeout(() => fireOpened(opts.windowId), 0); } });
        const entry = createSidePanelEntry(deps);
        await entry.init();
        await entry.handleActionClick({ windowId: 7 });
        expect(calls.open).toEqual([{ windowId: 7 }]);
        expect(await entry.isPanelOpen(7)).toBe(true);
        await entry.handleActionClick({ windowId: 7 });
        expect(calls.close).toEqual([{ windowId: 7 }]);
        expect(calls.marked).toBe(0);
    });

    it('onClosed from the browser resets the open state', async () => {
        const { deps, fireOpened, fireClosed } = makeFakes({ openImpl: async (o) => fireOpened(o.windowId) });
        const entry = createSidePanelEntry(deps);
        await entry.init();
        await entry.handleActionClick({ windowId: 3 });
        expect(await entry.isPanelOpen(3)).toBe(true);
        fireClosed(3);
        await new Promise((r) => setTimeout(r, 0));
        expect(await entry.isPanelOpen(3)).toBe(false);
    });

    it('when sidePanel.open rejects, records the flag and opens the options page', async () => {
        const { deps, calls } = makeFakes({ openImpl: async () => { throw new Error('No active side panel for windowId'); } });
        const entry = createSidePanelEntry(deps);
        await entry.init();
        await entry.handleActionClick({ windowId: 2 });
        expect(calls.marked).toBe(1);
        expect(calls.options).toBe(1);
    });

    it('when open resolves but onOpened never arrives before the timeout, records the flag', async () => {
        const { deps, calls } = makeFakes();
        deps.waitTimeout = () => Promise.resolve(); // timeout elapses immediately
        const entry = createSidePanelEntry(deps);
        await entry.init();
        await entry.handleActionClick({ windowId: 2 });
        expect(calls.open).toHaveLength(1);
        expect(calls.marked).toBe(1);
        expect(calls.options).toBe(1);
    });

    it('once the flag is set, clicks go straight to the options page without retrying open', async () => {
        const { deps, calls } = makeFakes({ unavailable: true });
        const entry = createSidePanelEntry(deps);
        await entry.init();
        await entry.handleActionClick({ windowId: 2 });
        expect(calls.open).toEqual([]);
        expect(calls.options).toBe(1);
    });

    it('treats a resolved open() as success when the browser lacks onOpened/onClosed events', async () => {
        const { deps, calls } = makeFakes({ withEvents: false });
        const entry = createSidePanelEntry(deps);
        await entry.init();
        await entry.handleActionClick({ windowId: 9 });
        expect(calls.open).toEqual([{ windowId: 9 }]);
        expect(calls.marked).toBe(0);
        expect(calls.options).toBe(0);
        // Without events we cannot track "open", so a second click opens again (no close).
        await entry.handleActionClick({ windowId: 9 });
        expect(calls.open).toHaveLength(2);
        expect(calls.close).toEqual([]);
    });

    it('closing without sidePanel.close support is a no-op (older engines)', async () => {
        const { deps, calls, fireOpened } = makeFakes({ withClose: false, openImpl: async (o) => fireOpened(o.windowId) });
        const entry = createSidePanelEntry(deps);
        await entry.init();
        await entry.handleActionClick({ windowId: 4 });
        await entry.handleActionClick({ windowId: 4 });
        expect(calls.close).toEqual([]);
        expect(calls.open).toHaveLength(1);
    });

    it('logs a diagnostic line for each decision so a user can report what happened', async () => {
        const { deps, calls, fireOpened } = makeFakes({ openImpl: async (o) => fireOpened(o.windowId) });
        const entry = createSidePanelEntry(deps);
        await entry.init();
        await entry.handleActionClick({ windowId: 5 });
        expect(calls.log.some((l) => /open/.test(l))).toBe(true);
    });
});


describe('createSidePanelEntry — review round 1', () => {
    it('calls sidePanel.open synchronously inside the click handler (user gesture must not be lost to an await)', async () => {
        const { deps, calls, fireOpened } = makeFakes({ openImpl: async (o) => fireOpened(o.windowId) });
        const entry = createSidePanelEntry(deps);
        await entry.init();
        const p = entry.handleActionClick({ windowId: 1 });
        expect(calls.open).toEqual([{ windowId: 1 }]); // same tick, before any await resolved
        await p;
    });

    it('registers onOpened/onClosed listeners at construction time, before init()', () => {
        const { deps } = makeFakes();
        let registered = 0;
        deps.sidePanel.onOpened = { addListener: () => { registered += 1; } };
        deps.sidePanel.onClosed = { addListener: () => { registered += 1; } };
        createSidePanelEntry(deps);
        expect(registered).toBe(2);
    });

    it('does not register listeners on Google Chrome', () => {
        const { deps } = makeFakes({ info: CHROME });
        let registered = 0;
        deps.sidePanel.onOpened = { addListener: () => { registered += 1; } };
        deps.sidePanel.onClosed = { addListener: () => { registered += 1; } };
        createSidePanelEntry(deps);
        expect(registered).toBe(0);
    });

    it('a second click while the first open is still unconfirmed is ignored (no second open, no give-up)', async () => {
        let resolveOpen;
        const { deps, calls, fireOpened } = makeFakes({ openImpl: () => new Promise((r) => { resolveOpen = r; }) });
        const entry = createSidePanelEntry(deps);
        await entry.init();
        const p1 = entry.handleActionClick({ windowId: 1 });
        const p2 = entry.handleActionClick({ windowId: 1 });
        resolveOpen();
        fireOpened(1);
        await Promise.all([p1, p2]);
        expect(calls.open).toHaveLength(1);
        expect(calls.marked).toBe(0);
    });

    it('when close() fails, resets the open state so the NEXT click opens again (open must stay inside a fresh gesture)', async () => {
        const { deps, calls, fireOpened } = makeFakes({ openImpl: async (o) => fireOpened(o.windowId) });
        deps.sidePanel.close = async () => { throw new Error('No active side panel'); };
        const entry = createSidePanelEntry(deps);
        await entry.init();
        await entry.handleActionClick({ windowId: 1 }); // open
        await entry.handleActionClick({ windowId: 1 }); // close fails → state reset, no open in this (consumed) gesture
        expect(calls.open).toHaveLength(1);
        expect(await entry.isPanelOpen(1)).toBe(false);
        await entry.handleActionClick({ windowId: 1 }); // next click opens
        expect(calls.open).toHaveLength(2);
    });

    it('a user-gesture rejection does not mark the panel unavailable', async () => {
        const { deps, calls } = makeFakes({ openImpl: async () => { throw new Error('`sidePanel.open()` may only be called in response to a user gesture.'); } });
        const entry = createSidePanelEntry(deps);
        await entry.init();
        await entry.handleActionClick({ windowId: 1 });
        expect(calls.marked).toBe(0);
        expect(calls.options).toBe(0);
    });

    it('records WHY the panel was declared unavailable', async () => {
        const rejected = makeFakes({ openImpl: async () => { throw new Error('No active side panel for windowId'); } });
        const e1 = createSidePanelEntry(rejected.deps);
        await e1.init();
        await e1.handleActionClick({ windowId: 1 });
        expect(rejected.calls.reasons[0]).toMatch(/^open-rejected: No active side panel/);

        const silent = makeFakes();
        silent.deps.waitTimeout = () => Promise.resolve();
        const e2 = createSidePanelEntry(silent.deps);
        await e2.init();
        await e2.handleActionClick({ windowId: 1 });
        expect(silent.calls.reasons[0]).toBe('no-onOpened');
    });
});
