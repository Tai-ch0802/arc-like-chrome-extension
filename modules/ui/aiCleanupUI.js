/**
 * AI Tab Cleanup Suggestion UI.
 *
 * Flow: button click → query tabs → call aiManager.generateCleanupSuggestions →
 * render inline checkbox list → user confirms → batch close selected tabs.
 *
 * Inline section (not modal) because the sidepanel is too narrow for a comfortable
 * modal with a scrollable checkbox list.
 */
import * as api from '../apiManager.js';
import * as aiManager from '../aiManager.js';
import * as state from '../stateManager.js';
import { GROUP_COLORS, resolveTabGroupBadge } from './groupColors.js';

/** @type {Array<{tabId: number, reason: string}>} Last AI suggestions, kept for confirm step. */
let currentSuggestions = [];

export function initAiCleanup() {
    const btn = document.getElementById('ai-cleanup-btn');
    const closeBtn = document.getElementById('ai-cleanup-close');
    const confirmBtn = document.getElementById('ai-cleanup-confirm');
    const selectAll = document.getElementById('ai-cleanup-select-all');

    if (!btn) return;

    // Initial visibility based on settings
    if (!state.isAiCleanupVisible()) {
        btn.style.display = 'none';
    }
    document.addEventListener('aiCleanupVisibilityChanged', (e) => {
        btn.style.display = e.detail.visible ? '' : 'none';
        if (!e.detail.visible) hideSection();
    });

    btn.addEventListener('click', handleCleanupAction);
    if (closeBtn) closeBtn.addEventListener('click', hideSection);
    if (confirmBtn) confirmBtn.addEventListener('click', handleConfirm);
    if (selectAll) selectAll.addEventListener('change', handleSelectAll);
}

async function handleCleanupAction() {
    const btn = document.getElementById('ai-cleanup-btn');
    if (btn.classList.contains('loading')) return;

    // Strict gate — same as background-driven naming. We don't implement a
    // download progress UI here (Smart Auto-Grouping already does), so if the
    // model isn't ready we surface a clear "needs download" hint instead of
    // silently freezing on "Analyzing..." for minutes.
    const availability = await aiManager.checkModelAvailability();
    if (availability !== 'available') {
        // 'downloadable'/'downloading' only ever come from builtin Nano; for
        // an unconfigured cloud provider, point at settings instead of Nano.
        let msgKey = 'aiCleanupNeedsDownload';
        if (availability === 'unavailable') {
            msgKey = (await aiManager.isCloudProviderActive()) ? 'aiProviderNotConfigured' : 'aiModelNotReady';
        }
        showStatus(api.getMessage(msgKey));
        showSection();
        return;
    }

    btn.classList.add('loading');
    showSection();
    showStatus(api.getMessage('aiCleanupAnalyzing'));
    clearList();
    hideFooter();

    try {
        const tabs = await api.getTabsInCurrentWindow();
        const now = Date.now();
        const tabsForAi = tabs
            .filter(t => !t.pinned && !t.active) // skip pinned and active tab
            .map(t => ({
                id: t.id,
                title: t.title,
                url: t.url,
                // Chrome 122+ exposes lastAccessed (ms). Fall back to 0 (treated as "just now").
                lastAccessedMinutesAgo: t.lastAccessed
                    ? Math.round((now - t.lastAccessed) / 60000)
                    : 0,
                groupId: t.groupId,
            }));

        if (tabsForAi.length === 0) {
            showStatus(api.getMessage('aiCleanupEmpty'));
            return;
        }

        let groupMap = new Map();
        try {
            const groups = await api.getTabGroupsInCurrentWindow();
            groupMap = new Map(groups.map(g => [g.id, g]));
        } catch { /* 無 group 或 API 不可用 → 無 badge */ }

        const suggestions = await aiManager.generateCleanupSuggestions(tabsForAi);
        // Filter: only keep suggestions for tabs that still exist.
        const liveIds = new Set(tabsForAi.map(t => t.id));
        const tabById = new Map(tabsForAi.map(t => [t.id, t]));
        currentSuggestions = suggestions.filter(s => liveIds.has(s.tabId));

        if (currentSuggestions.length === 0) {
            showStatus(api.getMessage('aiCleanupEmpty'));
            return;
        }

        showStatus(api.getMessage('aiCleanupFound').replace('{count}', currentSuggestions.length));
        renderList(currentSuggestions, tabById, groupMap);
        showFooter();
    } catch (err) {
        console.error('AI Cleanup error:', err);
        showStatus(api.getMessage('aiCleanupError'));
    } finally {
        btn.classList.remove('loading');
    }
}

function renderList(suggestions, tabById, groupMap = new Map()) {
    const list = document.getElementById('ai-cleanup-list');
    if (!list) return;
    list.innerHTML = '';

    const frag = document.createDocumentFragment();
    for (const s of suggestions) {
        const tab = tabById.get(s.tabId);
        if (!tab) continue;
        const row = document.createElement('label');
        row.className = 'ai-cleanup-row';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'ai-cleanup-row__cb';
        cb.dataset.tabId = String(s.tabId);
        cb.checked = true;
        cb.addEventListener('change', syncSelectAllState);

        const meta = document.createElement('div');
        meta.className = 'ai-cleanup-row__meta';

        const title = document.createElement('div');
        title.className = 'ai-cleanup-row__title';
        title.textContent = tab.title || tab.url || '(untitled)';

        const reason = document.createElement('div');
        reason.className = 'ai-cleanup-row__reason';
        reason.textContent = s.reason;

        const badge = resolveTabGroupBadge(tab, groupMap);
        if (badge) {
            const groupEl = document.createElement('span');
            groupEl.className = 'ai-cleanup-row__group';
            const dot = document.createElement('span');
            dot.className = 'ai-cleanup-row__group-dot';
            dot.style.background = GROUP_COLORS[badge.color] || GROUP_COLORS.grey;
            groupEl.appendChild(dot);
            if (badge.title) {
                const name = document.createElement('span');
                name.className = 'ai-cleanup-row__group-name';
                name.textContent = badge.title;
                groupEl.appendChild(name);
            }
            title.appendChild(groupEl);
        }
        meta.appendChild(title);
        meta.appendChild(reason);
        row.appendChild(cb);
        row.appendChild(meta);
        frag.appendChild(row);
    }
    list.appendChild(frag);
}

function handleSelectAll(e) {
    const checked = e.target.checked;
    document.querySelectorAll('#ai-cleanup-list .ai-cleanup-row__cb').forEach(cb => {
        cb.checked = checked;
    });
}

// Keep the "Select all" checkbox in sync with row checkboxes:
// fully checked, fully unchecked, or mixed (indeterminate).
function syncSelectAllState() {
    const rowBoxes = Array.from(document.querySelectorAll('#ai-cleanup-list .ai-cleanup-row__cb'));
    const selectAll = document.getElementById('ai-cleanup-select-all');
    if (!selectAll || rowBoxes.length === 0) return;
    const checkedCount = rowBoxes.filter(cb => cb.checked).length;
    if (checkedCount === 0) {
        selectAll.checked = false;
        selectAll.indeterminate = false;
    } else if (checkedCount === rowBoxes.length) {
        selectAll.checked = true;
        selectAll.indeterminate = false;
    } else {
        selectAll.checked = false;
        selectAll.indeterminate = true;
    }
}

async function handleConfirm() {
    const checked = Array.from(document.querySelectorAll('#ai-cleanup-list .ai-cleanup-row__cb:checked'));
    const targetIds = checked.map(cb => parseInt(cb.dataset.tabId, 10)).filter(Boolean);
    if (targetIds.length === 0) {
        hideSection();
        return;
    }
    try {
        // chrome.tabs.remove on an array is atomic — one missing ID aborts the
        // whole batch. Filter against currently-live tabs so a tab the user
        // manually closed during the AI delay doesn't sink the entire confirm.
        const liveTabs = await api.getTabsInCurrentWindow();
        const liveIds = new Set(liveTabs.map(t => t.id));
        const validIds = targetIds.filter(id => liveIds.has(id));

        if (validIds.length > 0) {
            await chrome.tabs.remove(validIds);
        }
        hideSection();
    } catch (err) {
        console.error('AI Cleanup close failed:', err);
        showStatus(api.getMessage('aiCleanupError'));
    }
}

function showSection() {
    document.getElementById('ai-cleanup-section')?.classList.remove('hidden');
}

function hideSection() {
    const section = document.getElementById('ai-cleanup-section');
    if (section) section.classList.add('hidden');
    currentSuggestions = [];
    clearList();
    hideFooter();
}

function showStatus(msg) {
    const el = document.getElementById('ai-cleanup-status');
    if (el) el.textContent = msg;
}

function clearList() {
    const list = document.getElementById('ai-cleanup-list');
    if (list) list.innerHTML = '';
}

function showFooter() {
    document.querySelector('#ai-cleanup-section .ai-cleanup-footer')?.classList.remove('hidden');
    const selectAll = document.getElementById('ai-cleanup-select-all');
    if (selectAll) {
        selectAll.checked = true;
        selectAll.indeterminate = false;
    }
}

function hideFooter() {
    document.querySelector('#ai-cleanup-section .ai-cleanup-footer')?.classList.add('hidden');
}
