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
    const container = document.createElement('div');
    container.className = 'workspace-manage';

    // 本 dialog 專屬的關閉控制(於 showCustomDialog onOpen 設定):避免以 document-global
    // 查找 #closeButton 而可能命中其他 modal(見 nlSearch.js 對同模式的警示)。
    const dialogRef = { close: () => {} };

    const list = document.createElement('div');
    list.className = 'workspace-manage__list';
    renderRows(list, dialogRef);
    container.appendChild(list);

    const createBtn = document.createElement('button');
    createBtn.className = 'workspace-manage__create';
    createBtn.textContent = api.getMessage('workspaceCreateFromCurrent') || '+ New from current tabs';
    createBtn.addEventListener('click', async () => {
        const ws = await handleCreateFromCurrent();
        if (ws) {
            // 建立後會 setActiveWorkspace 綁定新工作區,原本 active 的那一列因此
            // 不再 active——必須整批重繪,只 append 新列會讓舊列殘留 .active。
            renderRows(list, dialogRef);
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

/**
 * 重繪整個工作區列表。
 *
 * 任何會改變「哪個工作區綁定目前視窗」的操作(覆蓋、建立)都必須整批重繪,不能
 * 只 patch 自己那一列:setActiveWorkspace 具單一綁定不變式——它在綁定新工作區的
 * 同時會解除**其他列**對目前視窗的綁定。只更新單列會讓畫面上的 .active 標記,
 * 以及「覆蓋按鈕依 !isActive 才 render」的條件,與 storage 的真實狀態不一致,
 * 直到使用者關閉再重開 dialog 為止。
 */
function renderRows(listEl, dialogRef) {
    listEl.textContent = '';
    const all = wsManager.getAllWorkspaces();
    const activeId = wsManager.getActiveWorkspaceId(currentWindowId);
    if (all.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'workspace-manage__empty';
        empty.textContent = api.getMessage('workspaceManageEmpty') || 'No workspaces yet.';
        listEl.appendChild(empty);
        return;
    }
    for (const ws of all) {
        listEl.appendChild(buildManageRow(ws, ws.id === activeId, listEl, dialogRef));
    }
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

    // 「以目前視窗覆蓋」:把此視窗的分頁配置寫進該工作區並接手綁定。只在該工作區
    // 未綁定到本視窗時才有意義(已綁定者由背景 auto-snapshot 持續更新,不需手動)。
    if (!isActive) {
        const overwriteBtn = document.createElement('button');
        overwriteBtn.className = 'workspace-manage__btn';
        overwriteBtn.title = api.getMessage('workspaceOverwrite') || 'Overwrite with current window';
        overwriteBtn.setAttribute('aria-label', overwriteBtn.title);
        overwriteBtn.innerHTML = renderIcon('download', { size: 16 });
        overwriteBtn.addEventListener('click', () => handleOverwrite(ws, listEl, dialogRef));
        row.appendChild(overwriteBtn);
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

/**
 * 以目前視窗的分頁配置覆蓋既有工作區,並讓本視窗接手該工作區的綁定。
 *
 * **順序不可調換**:必先 setActiveWorkspace 再 snapshotIntoWorkspace。若只寫快照而
 * 未綁定,`isWorkspaceBound()` 為 false → 下次 Drive pull 時 keepLocalSnapshot 保護
 * 不生效,遠端快照會把這次覆蓋整個蓋回去(見 background.js applyRemoteSnapshot dep)。
 *
 * 覆寫前先在 UI 端算一次快照:snapshotIntoWorkspace 對「空快照」與「內容相同」都
 * 靜默 return 既有 ws,無法從回傳值分辨是否真的寫入。預算可(a)給確認框準確的
 * 分頁數、(b)攔下全 chrome:// 視窗這種會靜默無效的情況。
 * @param {object} ws 目標工作區
 * @param {HTMLElement} listEl 工作區列表容器(成功後整批重繪,見 renderRows)
 * @param {object} dialogRef 本 dialog 的關閉控制(重繪時傳給新列)
 */
async function handleOverwrite(ws, listEl, dialogRef) {
    let preview = [];
    try {
        const tabs = await chrome.tabs.query({ windowId: currentWindowId });
        preview = wsManager.buildSnapshotFromTabs(tabs, null);
    } catch (err) {
        console.warn('[workspace] overwrite preview failed:', err);
    }

    // 全 chrome://(或無可快照分頁):寫入會被 guard 擋掉而毫無反應,先明講。
    if (preview.length === 0) {
        await modal.showConfirm({
            title: api.getMessage('workspaceOverwriteEmptyTitle') || 'Nothing to save',
            message: api.getMessage('workspaceOverwriteEmptyMessage')
                || 'This window has no saveable tabs (browser-internal pages are not stored). Open at least one page first.',
            confirmButtonText: api.getMessage('closeButton') || 'OK',
        });
        return;
    }

    const oldCount = (ws.tabSnapshot || []).length;
    const ok = await modal.showConfirm({
        title: api.getMessage('workspaceOverwriteConfirmTitle') || 'Overwrite workspace',
        message: (api.getMessage('workspaceOverwriteConfirmMessage')
            || 'Replace "{ws}" ({old} tab(s)) with this window\'s {new} tab(s)? The saved layout cannot be recovered, and any other window bound to "{ws}" will be unbound.')
            .replace(/\{ws\}/g, ws.name)
            .replace('{old}', String(oldCount))
            .replace('{new}', String(preview.length)),
        confirmButtonText: api.getMessage('workspaceOverwrite') || 'Overwrite',
        confirmButtonClass: 'danger',
    });
    if (!ok) return;

    try {
        // 綁定先行(見上方註解);同時解除其他視窗對此工作區的綁定(單一綁定不變式)。
        await wsManager.setActiveWorkspace(currentWindowId, ws.id);
        await wsManager.snapshotIntoWorkspace(ws.id, currentWindowId);
        // 整批重繪:綁定已轉移,本列與「原本綁定目前視窗的那一列」的 .active 標記
        // 與覆蓋按鈕顯示條件都變了(見 renderRows)。manager 的 in-memory mirror 於
        // setActiveWorkspace/writeSnapRecord 內已同步,重繪即可取到正確狀態。
        renderRows(listEl, dialogRef);
        renderSwitchButton();
    } catch (err) {
        console.error('[workspace] overwrite failed:', err);
        // 刻意不宣稱「什麼都沒改變」:綁定與快照是兩個獨立的寫入,若第二步失敗,
        // 第一步的綁定轉移已經生效(且其他視窗對此工作區的綁定已被解除,無法單純
        // 回滾)。這裡誠實描述不確定狀態,而非給出可能與事實相反的保證。
        // (實務上 setStorage 不 reject——見 apiManager——故此分支近乎不可觸發,
        // 屬防禦性程式碼;但訊息措辭不應與「先綁定再快照」的順序邏輯矛盾。)
        renderRows(listEl, dialogRef);
        renderSwitchButton();
        await modal.showConfirm({
            title: api.getMessage('workspaceOverwriteFailedTitle') || 'Overwrite failed',
            message: api.getMessage('workspaceOverwriteFailedMessage')
                || 'The overwrite did not complete. This window may already be bound to the workspace, but its tab layout might not have been saved — please check the workspace contents.',
            confirmButtonText: api.getMessage('closeButton') || 'OK',
        });
    }
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
