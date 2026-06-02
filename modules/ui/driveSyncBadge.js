/**
 * Drive-sync status badge for the sidepanel.
 *
 * A tiny, non-intrusive indicator next to the workspace switcher. The
 * background service worker owns the authoritative status (chrome.storage.local
 * .driveSyncStatus); this module only renders it:
 *   - on init, it reads the current status once for the initial paint;
 *   - thereafter it reacts to the `driveSyncStatusChanged` DOM event that
 *     settingsBridge dispatches when that storage key changes.
 *
 * The badge is intentionally read-only — the authoritative connect/opt-in
 * controls live in the options page Sync section.
 */
import * as api from '../apiManager.js';
import { renderIcon } from '../icons.js';
import { escapeHtml } from '../utils/textUtils.js';

/**
 * Pure: map a SyncStatus object to a compact badge view-model. No DOM, no I/O.
 * @param {{state?: string, message?: string, lastSyncedAt?: number}|null|undefined} status
 * @returns {{ hidden: boolean, iconId?: string, text?: string, title?: string, stateClass?: string }}
 */
export function resolveBadgeView(status) {
    const state = status && status.state;
    // No status, or states that mean "not actively syncing this device" → hide.
    // (needs-auth / not connected surface in options, not as a sidepanel nag.)
    if (!state || state === 'needs-auth') {
        return { hidden: true };
    }
    switch (state) {
        case 'syncing':
            return {
                hidden: false,
                iconId: 'sync',
                text: api.getMessage('syncStatusSyncing') || 'Syncing…',
                stateClass: 'is-syncing',
            };
        case 'idle':
            return {
                hidden: false,
                iconId: 'cloud',
                text: '',
                title: api.getMessage('syncStatusIdleTitle') || api.getMessage('syncStatusIdle') || 'Synced to Google Drive',
                stateClass: 'is-idle',
            };
        case 'error':
        case 'conflict':
        case 'drive-full':
        case 'offline':
        case 'needs-update': {
            const titleByState = {
                error: api.getMessage('syncStatusError') || 'Sync error',
                conflict: api.getMessage('syncStatusConflict') || 'Sync conflict detected',
                'drive-full': api.getMessage('syncStatusDriveFull') || 'Google Drive is full',
                offline: api.getMessage('syncStatusOffline') || 'Offline',
                'needs-update': api.getMessage('syncStatusNeedsUpdate') || 'Update required to sync',
            };
            let title = titleByState[state];
            if (status && status.message) title += `: ${status.message}`;
            return {
                hidden: false,
                iconId: 'warning',
                text: '',
                title,
                stateClass: 'is-warning',
            };
        }
        default:
            return { hidden: true };
    }
}

/** Render a view-model onto the badge element: Material Symbols SVG + optional label. */
function renderBadge(el, view) {
    if (!el) return;
    el.classList.remove('is-syncing', 'is-idle', 'is-warning');
    if (view.hidden) {
        el.hidden = true;
        el.removeAttribute('title');
        el.textContent = '';
        return;
    }
    el.hidden = false;
    if (view.stateClass) el.classList.add(view.stateClass);
    // SVG icon + optional label. text 來自 i18n(可信),仍 escapeHtml 求安全。
    const icon = renderIcon(view.iconId, { size: 12 });
    el.innerHTML = view.text ? `${icon} ${escapeHtml(view.text)}` : icon;
    if (view.title) el.title = view.title;
    else el.removeAttribute('title');
}

/**
 * Wire the badge: initial paint from storage + live updates from the bridge event.
 * Best-effort and non-blocking — never throws into the startup path.
 */
export async function initDriveSyncBadge() {
    const el = document.getElementById('drive-sync-badge');
    if (!el) return;

    document.addEventListener('driveSyncStatusChanged', (e) => {
        renderBadge(el, resolveBadgeView(e.detail));
    });

    // Initial state from storage (does not block; failures hide the badge).
    try {
        const { driveSyncStatus } = await api.getStorage('local', { driveSyncStatus: null });
        renderBadge(el, resolveBadgeView(driveSyncStatus));
    } catch {
        renderBadge(el, { hidden: true });
    }
}
