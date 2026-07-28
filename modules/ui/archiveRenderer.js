// --- Archive Section Renderer (BASE-024 P2) ---
// The sidebar「封存」section: snoozed items on top (wake-time badge, click =
// wake now, delete = cancel-to-archive), archived items below (relative time,
// click = restore, hover delete). Follows readingListRenderer's shape:
// container-level delegation, reconcileDOM diffing, collapse persisted to
// storage.sync. ALL store WRITES go through SW messages (SA v1.2
// single-writer); this module only reads.

import * as api from '../apiManager.js';
import { getArchived, getSnoozed } from '../lifecycle/archiveStore.js';
import { reconcileDOM } from '../utils/domUtils.js';
import { formatRelativeTime, formatWakeTime } from '../utils/timeUtils.js';
import { debounce } from '../utils/functionUtils.js';
import { escapeHtml } from '../utils/textUtils.js';
import * as modal from '../modalManager.js';
import { renderIcon, CLOCK_ICON_SVG } from '../icons.js';
import { showToast, hideToast, claimUndo } from './toast.js';
import { resolveSnoozeSlots } from '../lifecycle/lifecycleLogic.js';

let initialized = false;
let toggleInitialized = false;

const el = {
    section: () => document.getElementById('archive-section'),
    list: () => document.getElementById('archive-list'),
    toggle: () => document.getElementById('archive-toggle'),
    badge: () => document.getElementById('archive-count-badge'),
    clearBtn: () => document.getElementById('archive-clear-btn'),
};

function sendLifecycle(action, payload = {}) {
    return api.sendRuntimeMessage({ action, ...payload })
        .catch(err => console.warn('[archive] lifecycle op failed', err));
}

async function restoreArchived(item) {
    // Open first, remove after — the URL always exists somewhere.
    await api.createTab({ url: item.url, active: true });
    await sendLifecycle('lifecycle:removeArchived', { ids: [item.id] });
}

function faviconFor(item) {
    const img = document.createElement('img');
    img.className = 'archive-item-favicon';
    img.src = item.favIconUrl || `https://www.google.com/s2/favicons?domain=${encodeURIComponent(item.url)}&sz=16`;
    img.alt = '';
    img.addEventListener('error', () => { img.style.visibility = 'hidden'; }, { once: true });
    return img;
}

function buildItem(item, { snoozed }) {
    const row = document.createElement('div');
    row.className = `archive-item${snoozed ? ' archive-item--snoozed' : ''}`;
    row.dataset.itemId = item.id;
    row.dataset.kind = snoozed ? 'snoozed' : 'archived';
    // BASE-025: searchManager filters/highlights off these datasets.
    row.dataset.title = item.title || '';
    row.dataset.url = item.url || '';
    row.tabIndex = 0;
    row.setAttribute('role', 'button');
    row.title = item.url;

    row.appendChild(faviconFor(item));

    const content = document.createElement('div');
    content.className = 'archive-item-content';
    const titleEl = document.createElement('span');
    titleEl.className = 'archive-item-title';
    titleEl.textContent = item.title || item.url;
    content.appendChild(titleEl);

    const meta = document.createElement('span');
    meta.className = 'archive-item-meta';
    if (snoozed) {
        meta.innerHTML = `${CLOCK_ICON_SVG}<span>${escapeHtml(
            formatWakeTime(item.wakeAt, Date.now(), api.getMessage, api.getResolvedUILanguage())
        )}</span>`;
        meta.title = api.getMessage('archiveWakeNowTitle') || 'Click to wake now';
    } else {
        meta.textContent = formatRelativeTime(item.archivedAt, Date.now(), api.getMessage);
    }
    content.appendChild(meta);
    row.appendChild(content);

    const actions = document.createElement('div');
    actions.className = 'archive-item-actions';
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'archive-item-btn';
    deleteBtn.dataset.action = snoozed ? 'cancel-snooze' : 'delete';
    deleteBtn.tabIndex = -1;
    deleteBtn.innerHTML = renderIcon('delete', { size: 14 });
    deleteBtn.title = snoozed
        ? (api.getMessage('archiveCancelSnoozeTitle') || 'Cancel — keep in archive')
        : (api.getMessage('archiveDeleteTitle') || 'Remove from archive');
    deleteBtn.setAttribute('aria-label', deleteBtn.title);
    actions.appendChild(deleteBtn);
    row.appendChild(actions);

    return row;
}

/** Section-level visibility (SA D1): hidden only when there is nothing to
 *  show AND auto-archive is off. */
async function resolveHidden(archivedCount, snoozedCount) {
    if (archivedCount || snoozedCount) return false;
    const res = await api.getStorage('sync', { autoArchiveEnabled: false });
    return res.autoArchiveEnabled !== true;
}

export async function refreshArchiveSection() {
    const section = el.section();
    const list = el.list();
    if (!section || !list) return;

    const [archived, snoozed] = await Promise.all([getArchived(), getSnoozed()]);
    const total = archived.items.length + snoozed.items.length;

    section.classList.toggle('hidden', await resolveHidden(archived.items.length, snoozed.items.length));

    const badge = el.badge();
    if (badge) {
        badge.textContent = total > 99 ? '99+' : String(total);
        badge.classList.toggle('hidden', total === 0);
    }
    const clearBtn = el.clearBtn();
    if (clearBtn) clearBtn.classList.toggle('hidden', archived.items.length === 0);

    if (total === 0) {
        list.textContent = '';
        const empty = document.createElement('div');
        empty.className = 'archive-empty-state';
        empty.textContent = api.getMessage('archiveEmptyState')
            || 'Idle tabs will be tucked away here — restore them anytime.';
        list.appendChild(empty);
        return;
    }

    const children = [
        ...snoozed.items.map(i => buildItem(i, { snoozed: true })),
        ...archived.items.map(i => buildItem(i, { snoozed: false })),
    ];
    reconcileDOM(list, children);

    // BASE-025: fresh rows must respect an active search query.
    document.dispatchEvent(new CustomEvent('sectionContentRerendered', { detail: { section: 'archive' } }));
}

function initToggle() {
    if (toggleInitialized) return;
    const toggleBtn = el.toggle();
    if (!toggleBtn) return;
    toggleInitialized = true;

    const setCollapsed = (collapsed) => {
        toggleBtn.setAttribute('aria-expanded', (!collapsed).toString());
        const list = el.list();
        if (list) list.classList.toggle('collapsed', collapsed);
    };
    api.getStorage('sync', ['archiveCollapsed'])
        .then(r => setCollapsed(r.archiveCollapsed === true))
        .catch(() => {});
    toggleBtn.addEventListener('click', (e) => {
        if (e.target.closest('#archive-count-badge')) return;
        const collapsed = toggleBtn.getAttribute('aria-expanded') === 'true';
        setCollapsed(collapsed);
        api.setStorage('sync', { archiveCollapsed: collapsed });
    });
}

async function handleListClick(e) {
    const btn = e.target.closest('button[data-action]');
    const row = e.target.closest('.archive-item');
    if (!row) return;
    const id = row.dataset.itemId;
    const snoozedRow = row.dataset.kind === 'snoozed';

    if (btn && btn.dataset.action === 'delete') {
        await sendLifecycle('lifecycle:removeArchived', { ids: [id] });
        return;
    }
    if (btn && btn.dataset.action === 'cancel-snooze') {
        await sendLifecycle('lifecycle:cancelSnooze', { id });
        return;
    }
    if (snoozedRow) {
        await sendLifecycle('lifecycle:wakeNow', { id }); // FR-3.04 early wake
        return;
    }
    const state = await getArchived();
    const item = state.items.find(i => i.id === id);
    if (item) await restoreArchived(item); // FR-2.02
}

/**
 * "Snooze this tab…" flow from the tab context menu (BASE-024 P3,
 * FR-4.01/4.02): slot dialog → persist via the SW single-writer (ack gates
 * the close — fail-CLOSED, unlike routing claims: an unpersisted close is
 * exactly the data loss this feature exists to prevent).
 * @param {{id:number, url:string, title?:string, favIconUrl?:string}} tab
 */
export async function promptSnoozeTab(tab) {
    const slot = await modal.showSnoozeDialog(resolveSnoozeSlots(Date.now()));
    if (!slot) return;
    const item = {
        id: crypto.randomUUID(),
        url: tab.url,
        title: tab.title || tab.url,
        favIconUrl: tab.favIconUrl || '',
        snoozedAt: Date.now(),
        wakeAt: slot.at,
    };
    const ack = await api.sendRuntimeMessage({ action: 'lifecycle:snooze', item }).catch(() => null);
    if (!ack || ack.ok !== true) {
        showToast(api.getMessage('snoozeFailedToast') || 'Could not snooze this tab — it stays open.');
        return;
    }
    await api.removeTab(tab.id);
}

/** Toast for a completed auto-archive round (FR-3.05): whole-round undo. */
function initArchivedToast() {
    api.addRuntimeMessageListener((message) => {
        if (!message || message.type !== 'lifecycle:archived') return;
        const items = message.items || [];
        if (!items.length) return;
        showToast(api.getMessage('archivedToast', [String(items.length)])
            || `Archived ${items.length} idle tab(s).`, true);
        claimUndo(async () => {
            for (const item of items) {
                try { await api.createTab({ url: item.url, active: false }); } catch { /* keep going */ }
            }
            await sendLifecycle('lifecycle:removeArchived', { ids: items.map(i => i.id) });
            hideToast();
        });
    });
}

export function initArchiveSection() {
    if (initialized) return;
    const list = el.list();
    if (!list) return;
    initialized = true;

    initToggle();
    initArchivedToast();

    list.addEventListener('click', (e) => {
        handleListClick(e).catch(err => console.warn('[archive] action failed', err));
    });
    list.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        const row = e.target.closest('.archive-item');
        if (!row) return;
        e.preventDefault();
        handleListClick(e).catch(err => console.warn('[archive] action failed', err));
    });

    const clearBtn = el.clearBtn();
    if (clearBtn) {
        clearBtn.addEventListener('click', async () => {
            const ok = await modal.showConfirm({
                title: api.getMessage('archiveClearAll') || 'Clear archive',
                message: api.getMessage('archiveClearConfirm')
                    || 'Clear all archived tabs? This cannot be undone.',
            });
            if (ok) await sendLifecycle('lifecycle:clearArchived');
        });
    }

    const refresh = debounce(() => {
        refreshArchiveSection().catch(err => console.warn('[archive] refresh failed', err));
    }, 150);
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && (changes.archivedTabs || changes.snoozedTabs)) refresh();
        if (area === 'sync' && changes.autoArchiveEnabled) refresh();
    });

    refreshArchiveSection().catch(err => console.warn('[archive] initial render failed', err));
}
