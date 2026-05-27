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

let currentWindowId = null;

export async function initWorkspaceUI() {
    try {
        const win = await chrome.windows.getCurrent();
        currentWindowId = win.id;
    } catch {
        currentWindowId = chrome.windows.WINDOW_ID_CURRENT;
    }

    const switcher = document.getElementById('workspace-switcher');
    const manageBtn = document.getElementById('workspace-manage-btn');
    if (!switcher) return;

    switcher.setAttribute('aria-label', api.getMessage('workspaceSwitcherAriaLabel') || 'Active workspace');
    if (manageBtn) {
        const manageLabel = api.getMessage('workspaceManageTitle') || 'Manage workspaces';
        manageBtn.title = manageLabel;
        manageBtn.setAttribute('aria-label', manageLabel);
    }

    renderSwitcher();

    switcher.addEventListener('change', handleSwitch);
    manageBtn?.addEventListener('click', openManageDialog);

    // Re-render switcher when another sidepanel mutates the workspace list
    // (Phase 2 cross-sidepanel sync uses chrome.storage.onChanged).
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        if (changes.workspaces || changes.windowWorkspaceMap) {
            // Re-init the in-memory cache before re-render, otherwise we'd
            // render against stale data.
            wsManager.initWorkspaces().then(renderSwitcher);
        }
    });
}

function renderSwitcher() {
    const switcher = document.getElementById('workspace-switcher');
    if (!switcher) return;
    const activeId = wsManager.getActiveWorkspaceId(currentWindowId);
    const all = wsManager.getAllWorkspaces();

    switcher.innerHTML = '';

    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = api.getMessage('workspaceNoActive') || '— no workspace —';
    if (!activeId) blank.selected = true;
    switcher.appendChild(blank);

    for (const ws of all) {
        const opt = document.createElement('option');
        opt.value = ws.id;
        opt.textContent = `${ws.icon} ${ws.name}`;
        if (ws.id === activeId) opt.selected = true;
        switcher.appendChild(opt);
    }
}

async function handleSwitch(e) {
    const targetId = e.target.value;
    if (!targetId) {
        renderSwitcher();
        return;
    }
    const target = wsManager.getWorkspace(targetId);
    if (!target) {
        renderSwitcher();
        return;
    }
    const currentTabs = await chrome.tabs.query({ windowId: currentWindowId });

    const ok = await modal.showConfirm({
        title: api.getMessage('workspaceSwitchConfirmTitle') || 'Switch workspace',
        message: (api.getMessage('workspaceSwitchConfirmMessage')
            || 'Switching to "{ws}" will close {n} tab(s) in this window and open the saved tabs.')
            .replace('{ws}', target.name)
            .replace('{n}', String(currentTabs.length)),
        confirmButtonText: api.getMessage('workspaceSwitchConfirmBtn') || 'Switch',
    });
    if (!ok) {
        renderSwitcher();
        return;
    }
    try {
        await wsManager.switchWorkspace(targetId, currentWindowId);
        // tabs are about to be replaced; renderSwitcher will run from the
        // storage.onChanged subscriber once setActiveWorkspace persists.
    } catch (err) {
        console.error('[workspace] switch failed:', err);
        renderSwitcher();
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
            renderSwitcher();
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

    const label = document.createElement('span');
    label.className = 'workspace-manage__label';
    const updateLabel = () => {
        const tabCount = ws.tabSnapshot ? ws.tabSnapshot.length : 0;
        label.textContent = `${ws.icon} ${ws.name} — ${tabCount} tab(s)`;
    };
    updateLabel();
    if (isActive) label.classList.add('active');
    row.appendChild(label);

    const renameBtn = document.createElement('button');
    renameBtn.className = 'workspace-manage__btn';
    renameBtn.title = api.getMessage('workspaceRename') || 'Rename';
    renameBtn.textContent = '✏️';
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
            renderSwitcher();
        }
    });
    row.appendChild(renameBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'workspace-manage__btn';
    deleteBtn.title = api.getMessage('workspaceDelete') || 'Delete';
    deleteBtn.textContent = '🗑️';
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
            renderSwitcher();
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
    const switcher = document.getElementById('workspace-switcher');
    if (!switcher) return;
    switcher.value = workspaceId;
    handleSwitch({ target: switcher });
}
