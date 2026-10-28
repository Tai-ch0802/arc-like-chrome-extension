/**
 * @file sidePanelEntry.js
 * Side panel entry point for browsers that are not Google Chrome (ISSUE-257 WP0).
 *
 * On Chrome the manifest/`setPanelBehavior({openPanelOnActionClick:true})`
 * route is proven, so this module does nothing there — adding our own
 * open/close on top would make the panel impossible to close (double
 * handling). On other Chromium brands (Dia) the user reported "clicking the
 * icon does nothing" with no log at all, so we take over: disable the
 * browser's automatic behaviour, toggle the panel ourselves from
 * `chrome.action.onClicked`, confirm with `sidePanel.onOpened`, and when the
 * panel demonstrably cannot open, record the per-device flag and send the
 * user to the options page which explains the situation (PRD FR-0.02 —
 * deliberately no detached-window fallback).
 *
 * Every effect is injected so the orchestration is unit-testable; background.js
 * wires the real chrome.* objects.
 *
 * @typedef {Object} SidePanelEntryDeps
 * @property {Object} sidePanel   chrome.sidePanel (open/close/setPanelBehavior/onOpened/onClosed)
 * @property {{openOptionsPage: () => Promise<void>|void}} runtime
 * @property {{get:(k:string)=>Promise<any>, set:(k:string,v:any)=>Promise<void>}} session  storage.session KV
 * @property {{isSidePanelUnavailable: () => Promise<boolean>, markSidePanelUnavailable: () => Promise<void>}} caps
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

/**
 * @param {SidePanelEntryDeps} deps
 */
export function createSidePanelEntry({ sidePanel, runtime, session, caps, getInfo, waitTimeout = defaultWaitTimeout, log = console }) {
    const hasEvents = Boolean(sidePanel && sidePanel.onOpened && sidePanel.onClosed);
    /** @type {Map<number, Function>} windowId → resolver awaiting onOpened */
    const pendingOpen = new Map();
    const tag = '[sidePanelEntry]';

    async function readOpenMap() {
        const map = await session.get(SESSION_OPEN_KEY);
        return map && typeof map === 'object' ? map : {};
    }

    async function setOpen(windowId, open) {
        const map = await readOpenMap();
        if (open) map[windowId] = true; else delete map[windowId];
        await session.set(SESSION_OPEN_KEY, map);
    }

    async function isPanelOpen(windowId) {
        const map = await readOpenMap();
        return Boolean(map[windowId]);
    }

    /**
     * Call at every service-worker start (top level). Chrome: intentionally a
     * no-op. Event listeners are registered synchronously, before the first
     * await, so they are in place whenever this SW instance is alive.
     */
    async function init() {
        const info = getInfo();
        if (info.isGoogleChrome) return;
        if (hasEvents) {
            sidePanel.onOpened.addListener((e) => {
                const windowId = e && e.windowId;
                log.info(`${tag} onOpened window=${windowId}`);
                const resolve = pendingOpen.get(windowId);
                if (resolve) { pendingOpen.delete(windowId); resolve(true); }
                setOpen(windowId, true).catch(() => {});
            });
            sidePanel.onClosed.addListener((e) => {
                const windowId = e && e.windowId;
                log.info(`${tag} onClosed window=${windowId}`);
                setOpen(windowId, false).catch(() => {});
            });
        }
        try {
            await sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
        } catch (err) {
            log.warn(`${tag} setPanelBehavior failed:`, err && err.message);
        }
        log.info(`${tag} manual toggle mode (brand=${info.brand} v${info.majorVersion}, events=${hasEvents})`);
    }

    /** Open and confirm; returns true on confirmed open. */
    async function openConfirmed(windowId) {
        const confirmed = hasEvents
            ? new Promise((resolve) => { pendingOpen.set(windowId, resolve); })
            : null;
        try {
            await sidePanel.open({ windowId });
        } catch (err) {
            pendingOpen.delete(windowId);
            log.warn(`${tag} open() rejected:`, err && err.message);
            return false;
        }
        if (!confirmed) return true; // no events on this engine: trust open()
        const result = await Promise.race([
            confirmed,
            waitTimeout(OPEN_CONFIRM_TIMEOUT_MS).then(() => false),
        ]);
        if (!result) {
            pendingOpen.delete(windowId);
            log.warn(`${tag} open() resolved but onOpened never fired within ${OPEN_CONFIRM_TIMEOUT_MS}ms`);
        }
        return result;
    }

    async function giveUp() {
        await caps.markSidePanelUnavailable();
        await runtime.openOptionsPage();
    }

    /** chrome.action.onClicked handler (also reached by the _execute_action command). */
    async function handleActionClick(tab) {
        const windowId = tab && tab.windowId;
        const info = getInfo();
        const decision = decideActionClick({
            isGoogleChrome: info.isGoogleChrome,
            panelOpen: hasEvents ? await isPanelOpen(windowId) : false,
            sidePanelUnavailable: await caps.isSidePanelUnavailable(),
        });
        log.info(`${tag} action click window=${windowId} → ${decision}`);
        if (decision === 'noop') return;
        if (decision === 'options') { await runtime.openOptionsPage(); return; }
        if (decision === 'close') {
            if (typeof sidePanel.close === 'function') {
                try { await sidePanel.close({ windowId }); } catch (err) { log.warn(`${tag} close() failed:`, err && err.message); }
            }
            return;
        }
        const ok = await openConfirmed(windowId);
        if (!ok) await giveUp();
    }

    return { init, handleActionClick, isPanelOpen };
}
