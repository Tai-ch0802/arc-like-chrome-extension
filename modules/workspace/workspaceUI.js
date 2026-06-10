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

/**
 * @param {{onWorkspacesChanged?: () => void}} [opts] - onWorkspacesChanged is
 *   invoked (debounced) whenever workspace state changes in storage — bindings,
 *   metadata, or snapshots — so the host page can refresh dependent views
 *   (e.g. the Other Windows section, whose titles show workspace names).
 */
export async function initWorkspaceUI({ onWorkspacesChanged } = {}) {
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
        // Schema v2 (ISSUE-162 WP1): per-workspace keys, matched by prefix.
        const keys = Object.keys(changes);
        const localTouched = area === 'local'
            && keys.some(k => k.startsWith('wsSnap_') || k === 'windowWorkspaceMap');
        const syncTouched = area === 'sync'
            && keys.some(k => k.startsWith('wsMeta_'));
        if (!localTouched && !syncTouched) return;
        clearTimeout(reloadTimer);
        reloadTimer = setTimeout(() => {
            wsManager.initWorkspaces()
                .then(() => {
                    renderSwitchButton();
                    // Bindings/names may have changed (e.g. the background
                    // lifecycle rebound a restored window) — let the host
                    // refresh views that display workspace names.
                    if (onWorkspacesChanged) onWorkspacesChanged();
                })
                .catch(err => console.warn('[workspace] sync reload failed:', err));
        }, 200);
    });

    // NOTE: auto-snapshot, window-close binding cleanup, and stale-binding
    // pruning all moved to modules/workspace/workspaceLifecycle.js (background
    // service worker) — they must run even when no sidepanel is open.
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
 * Arc 式切換:聚焦目標工作區既有視窗,或開新視窗還原快照。非破壞性——目前視窗
 * 的分頁完全不動,因此不需要確認對話框(舊版會關閉現有分頁,才需要 confirm)。
 * 回傳是否實際切換(供呼叫端決定是否關閉管理 dialog)。
 * 不在此重繪按鈕——切換成功後 storage.onChanged 訂閱會觸發 renderSwitchButton。
 * @param {string} targetId
 * @returns {Promise<boolean>}
 */
async function performSwitch(targetId) {
    const target = targetId ? wsManager.getWorkspace(targetId) : null;
    if (!target) return false;
    try {
        const result = await wsManager.switchWorkspace(targetId, currentWindowId);
        return Boolean(result);
    } catch (err) {
        console.error('[workspace] switch failed:', err);
        // Show the failure to the user so they know nothing was changed.
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

    // 本 dialog 專屬的關閉控制(於 showCustomDialog onOpen 設定):避免以 document-global
    // 查找 #closeButton 而可能命中其他 modal(見 nlSearch.js 對同模式的警示)。
    const dialogRef = { close: () => {} };

    const list = document.createElement('div');
    list.className = 'workspace-manage__list';
    if (all.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'workspace-manage__empty';
        empty.textContent = api.getMessage('workspaceManageEmpty') || 'No workspaces yet.';
        list.appendChild(empty);
    } else {
        for (const ws of all) {
            list.appendChild(buildManageRow(ws, ws.id === activeId, list, dialogRef));
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
            list.appendChild(buildManageRow(ws, true, list, dialogRef));
            renderSwitchButton();
        }
    });
    container.appendChild(createBtn);

    modal.showCustomDialog({
        title: api.getMessage('workspaceManageTitle') || 'Manage workspaces',
        content: container,
        onOpen: (modalContent) => {
            const closeBtn = modalContent.querySelector('#closeButton');
            if (closeBtn) dialogRef.close = () => closeBtn.click();
        },
    });
}

function buildManageRow(ws, isActive, listEl, dialogRef) {
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
        if (switched) dialogRef.close();
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
