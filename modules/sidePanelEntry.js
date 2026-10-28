/**
 * @file sidePanelEntry.js
 * Side panel entry point for browsers that are not Google Chrome (ISSUE-257 WP0).
 *
 * On Chrome the `setPanelBehavior({openPanelOnActionClick:true})` route is
 * proven, so this module does nothing there — adding our own open/close on
 * top would make the panel impossible to close (double handling). On other
 * Chromium brands (Dia) the user reported "clicking the icon does nothing"
 * with no log at all, so we take over: disable the browser's automatic
 * behaviour, toggle the panel ourselves from `chrome.action.onClicked`,
 * confirm with `sidePanel.onOpened`, and when the panel demonstrably cannot
 * open, record the per-device flag (with the reason) and send the user to
 * the options page which explains it (PRD FR-0.02 — deliberately no
 * detached-window fallback).
 *
 * Two Chromium constraints shape the code:
 * - `sidePanel.open()` must be called inside the user gesture, i.e. before the
 *   click handler awaits anything. Decisions therefore use in-memory mirrors
 *   (open windows, the unavailable flag) that are loaded once in init().
 * - `onOpened`/`onClosed` listeners must exist whenever this SW instance is
 *   alive, so they are registered synchronously when the entry is created.
 *
 * Every effect is injected so the orchestration is unit-testable; background.js
 * wires the real chrome.* objects.
 *
 * @typedef {Object} SidePanelEntryDeps
 * @property {Object} sidePanel   chrome.sidePanel (open/close/setPanelBehavior/onOpened/onClosed)
 * @property {{openOptionsPage: () => Promise<void>|void}} runtime
 * @property {{get:(k:string)=>Promise<any>, set:(k:string,v:any)=>Promise<void>}} session  storage.session KV
 * @property {{isSidePanelUnavailable: () => Promise<boolean>, markSidePanelUnavailable: (reason:string) => Promise<void>}} caps
 * @property {() => {isGoogleChrome:boolean, brand:string, majorVersion:number}} getInfo
 * @property {(ms:number) => Promise<void>} [waitTimeout]  resolves when the open-confirmation window elapses
 * @property {{info: Function, warn: Function}} [log]
 */
import { decideActionClick } from './utils/browserCapabilities.js';

/** storage.session key: { [windowId]: true } for panels confirmed open. */
export const SESSION_OPEN_KEY = 'sidePanelOpenByWindow';
/** How long to wait for sidePanel.onOpened after open() resolved. */
export const OPEN_CONFIRM_TIMEOUT_MS = 3000;

const defaultWaitTimeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const GESTURE_RE = /user gesture/i;

/**
 * @param {SidePanelEntryDeps} deps
 */
export function createSidePanelEntry({ sidePanel, runtime, session, caps, getInfo, waitTimeout = defaultWaitTimeout, log = console }) {
    const tag = '[sidePanelEntry]';
    const info = getInfo();
    const manual = !info.isGoogleChrome;
    const hasEvents = manual && Boolean(sidePanel && sidePanel.onOpened && sidePanel.onClosed);
    // Dia-style "symbol exists but never fires" protection: once open() resolved
    // but no onOpened arrived, stop trusting the events for this SW lifetime and
    // fall back to "open on every click" (no toggle) instead of declaring the
    // panel unavailable — only a REJECTED open() is evidence of that.
    let eventsTrusted = hasEvents;

    // In-memory mirrors — consulted synchronously inside the click handler.
    const openWindows = new Set();
    let unavailable = false;
    /** @type {Map<number, Function>} windowId → resolver awaiting onOpened */
    const pendingOpen = new Map();
    /** Serialises session writes (two window events may land together). */
    let persistChain = Promise.resolve();

    function persistOpenWindows() {
        persistChain = persistChain
            .then(() => session.set(SESSION_OPEN_KEY, Object.fromEntries([...openWindows].map((id) => [id, true]))))
            .catch((err) => log.warn(`${tag} session write failed:`, err && err.message));
        return persistChain;
    }

    function setOpen(windowId, open) {
        if (open) openWindows.add(windowId); else openWindows.delete(windowId);
        return persistOpenWindows();
    }

    if (hasEvents) {
        // Synchronous registration: must exist whenever this SW instance runs.
        sidePanel.onOpened.addListener((e) => {
            const windowId = e && e.windowId;
            log.info(`${tag} onOpened window=${windowId}`);
            const resolve = pendingOpen.get(windowId);
            if (resolve) { pendingOpen.delete(windowId); resolve(true); }
            setOpen(windowId, true);
        });
        sidePanel.onClosed.addListener((e) => {
            const windowId = e && e.windowId;
            log.info(`${tag} onClosed window=${windowId}`);
            setOpen(windowId, false);
        });
    }

    /** Load mirrors + switch the browser to manual mode. Chrome: no-op. */
    async function init() {
        if (!manual) return;
        try {
            const map = await session.get(SESSION_OPEN_KEY);
            if (map && typeof map === 'object') Object.keys(map).forEach((k) => openWindows.add(Number(k)));
        } catch { /* fresh SW session */ }
        try { unavailable = await caps.isSidePanelUnavailable(); } catch { unavailable = false; }
        try {
            await sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
        } catch (err) {
            log.warn(`${tag} setPanelBehavior failed:`, err && err.message);
        }
        log.info(`${tag} manual toggle mode (brand=${info.brand} v${info.majorVersion}, events=${hasEvents}, unavailable=${unavailable})`);
    }

    async function giveUp(reason) {
        unavailable = true;
        log.warn(`${tag} declaring the side panel unavailable: ${reason}`);
        try { await caps.markSidePanelUnavailable(reason); } catch { /* best-effort */ }
        await runtime.openOptionsPage();
    }

    /**
     * chrome.action.onClicked handler (also reached by the _execute_action
     * command). `sidePanel.open()` is issued before the first await.
     */
    async function handleActionClick(tab) {
        const windowId = tab && tab.windowId;
        const decision = decideActionClick({
            isGoogleChrome: !manual,
            panelOpen: eventsTrusted && openWindows.has(windowId),
            sidePanelUnavailable: unavailable,
        });
        log.info(`${tag} action click window=${windowId} → ${decision}`);
        if (decision === 'noop') return;
        if (decision === 'options') { await runtime.openOptionsPage(); return; }
        if (decision === 'close') {
            if (typeof sidePanel.close !== 'function') { await setOpen(windowId, false); return; }
            try {
                await sidePanel.close({ windowId });
            } catch (err) {
                // Stale "open" state (e.g. the panel went away without onClosed):
                // reset so the next click opens instead of closing forever.
                log.warn(`${tag} close() failed, resetting state:`, err && err.message);
                await setOpen(windowId, false);
            }
            return;
        }
        if (pendingOpen.has(windowId)) { log.info(`${tag} open already pending for window=${windowId}`); return; }

        const confirmed = eventsTrusted
            ? new Promise((resolve) => { pendingOpen.set(windowId, resolve); })
            : null;
        let openPromise;
        try {
            openPromise = Promise.resolve(sidePanel.open({ windowId })); // inside the gesture
        } catch (err) {
            openPromise = Promise.reject(err);
        }
        try {
            await openPromise;
        } catch (err) {
            pendingOpen.delete(windowId);
            const message = (err && err.message) || String(err);
            if (GESTURE_RE.test(message)) {
                // Our own timing problem, not the browser's capability.
                log.warn(`${tag} open() rejected (gesture):`, message);
                return;
            }
            log.warn(`${tag} open() rejected:`, message);
            await giveUp(`open-rejected: ${message}`);
            return;
        }
        if (!confirmed) return; // no (trusted) events on this engine: trust open()
        const ok = await Promise.race([
            confirmed,
            waitTimeout(OPEN_CONFIRM_TIMEOUT_MS).then(() => false),
        ]);
        if (!ok) {
            pendingOpen.delete(windowId);
            eventsTrusted = false;
            log.warn(`${tag} open() resolved but onOpened never fired within ${OPEN_CONFIRM_TIMEOUT_MS}ms — assuming the panel is open and ignoring open/close events from now on`);
        }
    }

    async function isPanelOpen(windowId) {
        return openWindows.has(windowId);
    }

    return { init, handleActionClick, isPanelOpen };
}
