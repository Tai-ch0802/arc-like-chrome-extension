/**
 * Workspace Switcher UI
 *
 * Top-of-sidepanel select for active workspace + a manage button that opens
 * a list dialog (rename / delete + "create from current tabs"). v1 deliberately
 * skips inline color/icon editing — that's two more dialog layers for low value;
 * users can delete and recreate if they want a different look.
 */
import * as wsManager from './workspaceManager.js';
import * as modal from '../modalManager.js';
import * as api from '../apiManager.js';
import { renderIcon } from '../icons.js';

let currentWindowId = null;

export async function initWorkspaceUI() {
    try {
        const win = await chrome.windows.getCurrent();
        currentWindowId = win.id;
    } catch {
        currentWindowId = chrome.windows.WINDOW_ID_CURRENT;
    }

    const switchBtn = document.getElementById('workspace-switch-btn');
    if (!switchBtn) return;

    const manageLabel = api.getMessage('workspaceManageTitle') || 'Manage workspaces';
    switchBtn.title = manageLabel;
    switchBtn.setAttribute('aria-label', manageLabel);

    renderSwitchButton();

    switchBtn.addEventListener('click', openManageDialog);

    // Re-render switcher on:
    //   - local area: workspaceSnapshots / windowWorkspaceMap (this device's edits)
    //   - sync area:  workspaceMetadata (edits arriving from another device)
    // Phase 2 added cross-sidepanel sync; Phase 9 extends it to cross-device.
    //
    // Debounce: persistWorkspaces writes to BOTH areas on every mutation,
    // so each user action fires this listener twice (once per area). Without
    // debounce, initWorkspaces + renderSwitcher run twice back-to-back —
    // harmless but wasteful, and the second run can race with the first.
    let reloadTimer = null;
    chrome.storage.onChanged.addListener((changes, area) => {
        const localTouched = area === 'local'
            && (changes.workspaceSnapshots || changes.windowWorkspaceMap);
        const syncTouched = area === 'sync' && changes.workspaceMetadata;
        if (!localTouched && !syncTouched) return;
        clearTimeout(reloadTimer);
        reloadTimer = setTimeout(() => {
            wsManager.initWorkspaces()
                .then(renderSwitchButton)
                .catch(err => console.warn('[workspace] sync reload failed:', err));
        }, 200);
    });

    installAutoSnapshot();
    installWindowCleanup();

    // Prune entries for windows that no longer exist (id reuse across sessions
    // would otherwise let a new window inherit a stale workspace binding).
    wsManager.pruneWindowWorkspaceMap().catch(err =>
        console.warn('[workspace] prune failed:', err));
}

/**
 * Continuously snapshot the active workspace as the user opens/closes/navigates
 * tabs in the current window. Without this, the workspace snapshot would only
 * be updated at switch time — closing the window directly (or browser quit)
 * would lose all changes since the last switch.
 *
 * 1.5s debounce: aggressive enough that a quick window-close still catches
 * recent changes, gentle enough to avoid hammering chrome.storage on rapid
 * navigation. There's still a race against the last ~1.5s before window close,
 * but Chrome offers no "window about to close" hook, so this is the best we
 * can do without persisting on every event.
 */
function installAutoSnapshot() {
    let snapshotTimer = null;
    const trigger = () => {
        clearTimeout(snapshotTimer);
        snapshotTimer = setTimeout(async () => {
            const activeId = wsManager.getActiveWorkspaceId(currentWindowId);
            if (!activeId) return;
            try {
                await wsManager.snapshotIntoWorkspace(activeId, currentWindowId);
            } catch (err) {
                console.warn('[workspace] auto-snapshot failed:', err);
            }
        }, 1500);
    };
    chrome.tabs.onCreated.addListener(tab => {
        if (tab.windowId === currentWindowId) trigger();
    });
    chrome.tabs.onRemoved.addListener((_id, info) => {
        if (info.windowId === currentWindowId) trigger();
    });
    chrome.tabs.onUpdated.addListener((_id, changeInfo, tab) => {
        // Only URL changes matter for snapshot fidelity; title flicker and
        // favicon updates would otherwise debounce-spam storage.
        if (changeInfo.url && tab.windowId === currentWindowId) trigger();
    });
    chrome.tabs.onMoved.addListener((_id, info) => {
        if (info.windowId === currentWindowId) trigger();
    });
}

function installWindowCleanup() {
    chrome.windows.onRemoved.addListener(async (closedWindowId) => {
        // Clear that window's binding so the id (Chrome reuses them) can't
        // resurrect a stale active workspace on a future, unrelated window.
        try {
            await wsManager.setActiveWorkspace(closedWindowId, null);
        } catch (err) {
            console.warn('[workspace] cleanup on window close failed:', err);
        }
    });
}

function renderSwitchButton() {
    const btn = document.getElementById('workspace-switch-btn');
    if (!btn) return;
    const label = btn.querySelector('.workspace-switch-label');
    if (!label) return;
    const activeId = wsManager.getActiveWorkspaceId(currentWindowId);
    const active = activeId ? wsManager.getWorkspace(activeId) : null;
    // 名稱置中、無前置 emoji(見 .workspace-switch-btn CSS)。
    label.textContent = active ? active.name : (api.getMessage('workspaceNoActive') || '— no workspace —');
}

/**
 * 切換到指定工作區(沿用確認流程)。回傳是否實際切換(供呼叫端決定是否關閉管理 dialog)。
 * 不在此重繪按鈕——切換成功後 storage.onChanged 訂閱會觸發 renderSwitchButton。
 * @param {string} targetId
 * @returns {Promise<boolean>}
 */
async function performSwitch(targetId) {
    const target = targetId ? wsManager.getWorkspace(targetId) : null;
    if (!target) return false;
    const currentTabs = await chrome.tabs.query({ windowId: currentWindowId });
    const isUnbound = !wsManager.getActiveWorkspaceId(currentWindowId);

    // Unbound windows would silently lose their tabs without an explicit hint.
    // We auto-save them as "Untitled <ts>" in workspaceManager, but the user
    // deserves to know that's happening before they confirm.
    const messageKey = isUnbound && currentTabs.length > 0
        ? 'workspaceSwitchConfirmMessageUnbound'
        : 'workspaceSwitchConfirmMessage';
    const fallback = isUnbound && currentTabs.length > 0
        ? 'Switching to "{ws}" — your current {n} tab(s) aren\'t in any workspace yet. They will be auto-saved to a new "Untitled" workspace before the switch.'
        : 'Switching to "{ws}" will close {n} tab(s) in this window and open the saved tabs.';

    const ok = await modal.showConfirm({
        title: api.getMessage('workspaceSwitchConfirmTitle') || 'Switch workspace',
        message: (api.getMessage(messageKey) || fallback)
            .replace('{ws}', target.name)
            .replace('{n}', String(currentTabs.length)),
        confirmButtonText: api.getMessage('workspaceSwitchConfirmBtn') || 'Switch',
    });
    if (!ok) return false;
    try {
        await wsManager.switchWorkspace(targetId, currentWindowId);
        return true;
    } catch (err) {
        console.error('[workspace] switch failed:', err);
        // Show the failure to the user so they know the window wasn't changed.
        await modal.showConfirm({
            title: api.getMessage('workspaceSwitchFailedTitle') || 'Switch failed',
            message: api.getMessage('workspaceSwitchFailedMessage')
                || 'Could not switch workspace. Your current tabs were not changed.',
            confirmButtonText: api.getMessage('closeButton') || 'OK',
        });
        return false;
    }
}

/**
 * Manage dialog: lists all workspaces with rename + delete, plus a button
 * to create a new one from the current window's tabs.
 */
function openManageDialog() {
    const all = wsManager.getAllWorkspaces();
    const activeId = wsManager.getActiveWorkspaceId(currentWindowId);

    const container = document.createElement('div');
    container.className = 'workspace-manage';

    const list = document.createElement('div');
    list.className = 'workspace-manage__list';
    if (all.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'workspace-manage__empty';
        empty.textContent = api.getMessage('workspaceManageEmpty') || 'No workspaces yet.';
        list.appendChild(empty);
    } else {
        for (const ws of all) {
            list.appendChild(buildManageRow(ws, ws.id === activeId, list));
        }
    }
    container.appendChild(list);

    const createBtn = document.createElement('button');
    createBtn.className = 'workspace-manage__create';
    createBtn.textContent = api.getMessage('workspaceCreateFromCurrent') || '+ New from current tabs';
    createBtn.addEventListener('click', async () => {
        const ws = await handleCreateFromCurrent();
        if (ws) {
            // Replace the "empty" placeholder if present, then append new row.
            const empty = list.querySelector('.workspace-manage__empty');
            if (empty) empty.remove();
            list.appendChild(buildManageRow(ws, true, list));
            renderSwitchButton();
        }
    });
    container.appendChild(createBtn);

    modal.showCustomDialog({
        title: api.getMessage('workspaceManageTitle') || 'Manage workspaces',
        content: container,
    });
}

function buildManageRow(ws, isActive, listEl) {
    const row = document.createElement('div');
    row.className = 'workspace-manage__row';

    // 主區為切換按鈕:點擊即切換工作區(沿用確認流程),成功後關閉管理 dialog。
    // rename/delete 為同層獨立按鈕(非巢狀),點擊不會冒泡到切換按鈕。
    const switchEl = document.createElement('button');
    switchEl.className = 'workspace-manage__switch';
    if (isActive) switchEl.classList.add('active');
    switchEl.title = api.getMessage('workspaceSwitchConfirmBtn') || 'Switch';

    const iconEl = document.createElement('span');
    iconEl.className = 'workspace-manage__icon';
    iconEl.innerHTML = wsManager.resolveWorkspaceIcon(ws.icon, { size: 18 });
    switchEl.appendChild(iconEl);

    const label = document.createElement('span');
    label.className = 'workspace-manage__label';
    const updateLabel = () => {
        const tabCount = ws.tabSnapshot ? ws.tabSnapshot.length : 0;
        label.textContent = `${ws.name} — ${tabCount} tab(s)`;
    };
    updateLabel();
    switchEl.appendChild(label);

    switchEl.addEventListener('click', async () => {
        const switched = await performSwitch(ws.id);
        if (switched) document.getElementById('closeButton')?.click();
    });
    row.appendChild(switchEl);

    // Read-only Drive-sync indicator. The authoritative opt-in toggle lives in
    // the options Sync section; this is purely a visual cue that the workspace
    // participates in cross-device sync.
    if (ws.syncEnabled === true) {
        const cloud = document.createElement('span');
        cloud.className = 'workspace-manage__sync-glyph';
        cloud.innerHTML = renderIcon('cloud', { size: 14 });
        cloud.title = api.getMessage('workspaceSyncedTitle') || 'Synced to Google Drive';
        cloud.setAttribute('aria-label', cloud.title);
        row.appendChild(cloud);
    }

    const renameBtn = document.createElement('button');
    renameBtn.className = 'workspace-manage__btn';
    renameBtn.title = api.getMessage('workspaceRename') || 'Rename';
    renameBtn.setAttribute('aria-label', renameBtn.title);
    renameBtn.innerHTML = renderIcon('edit', { size: 16 });
    renameBtn.addEventListener('click', async () => {
        const newName = await modal.showPrompt({
            title: api.getMessage('workspaceRename') || 'Rename workspace',
            defaultValue: ws.name,
        });
        if (newName && newName.trim()) {
            await wsManager.updateWorkspace(ws.id, { name: newName.trim() });
            // Mutate the in-place snapshot used by closures and refresh just this row.
            ws.name = newName.trim();
            updateLabel();
            renderSwitchButton();
        }
    });
    row.appendChild(renameBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'workspace-manage__btn';
    deleteBtn.title = api.getMessage('workspaceDelete') || 'Delete';
    deleteBtn.setAttribute('aria-label', deleteBtn.title);
    deleteBtn.innerHTML = renderIcon('delete', { size: 16 });
    deleteBtn.addEventListener('click', async () => {
        const ok = await modal.showConfirm({
            title: api.getMessage('workspaceDeleteConfirmTitle') || 'Delete workspace',
            message: (api.getMessage('workspaceDeleteConfirmMessage') || 'Delete "{ws}"? This cannot be undone.')
                .replace('{ws}', ws.name),
            confirmButtonText: api.getMessage('workspaceDelete') || 'Delete',
            confirmButtonClass: 'danger',
        });
        if (ok) {
            await wsManager.deleteWorkspace(ws.id);
            row.remove();
            // If we just removed the last row, show the empty hint again.
            if (listEl && listEl.querySelectorAll('.workspace-manage__row').length === 0) {
                const empty = document.createElement('div');
                empty.className = 'workspace-manage__empty';
                empty.textContent = api.getMessage('workspaceManageEmpty') || 'No workspaces yet.';
                listEl.appendChild(empty);
            }
            renderSwitchButton();
        }
    });
    row.appendChild(deleteBtn);

    return row;
}

async function handleCreateFromCurrent() {
    const name = await modal.showPrompt({
        title: api.getMessage('workspaceCreatePromptTitle') || 'Name this workspace',
        defaultValue: '',
    });
    if (!name || !name.trim()) return null;
    const ws = await wsManager.createWorkspace({
        name: name.trim(),
        snapshotWindowId: currentWindowId,
    });
    await wsManager.setActiveWorkspace(currentWindowId, ws.id);
    return ws;
}

/** Exposed so the Command Palette can trigger creation without going through the manage dialog. */
export async function createWorkspaceFromCurrent() {
    return handleCreateFromCurrent();
}

/** Exposed so the Command Palette can prompt switch to a workspace by id. */
export async function requestSwitchTo(workspaceId) {
    await performSwitch(workspaceId);
}
