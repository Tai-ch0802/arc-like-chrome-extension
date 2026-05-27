/**
 * Bookmark Tools UI
 *
 * Single modal with three tab views — Tags / Duplicates / Dead Links. Each
 * tab lazy-renders its data so we don't pay the dedupe scan or dead-link
 * fetch cost just to look at the tag list.
 *
 * UI choice: tabs (one panel visible at a time) rather than three stacked
 * sections, because the sidepanel modal is narrow and three panels would
 * force the user to scroll past tools they don't care about.
 */
import * as modal from '../modalManager.js';
import * as api from '../apiManager.js';
import * as state from '../stateManager.js';
import * as tagManager from './tagManager.js';
import * as dedupe from './dedupe.js';
import * as deadLink from './deadLinkChecker.js';
import { bulkRemove } from './bookmarkUtils.js';

const TABS = ['tags', 'duplicates', 'deadLinks'];

export function openBookmarkToolsDialog(initialTab = 'tags') {
    const container = document.createElement('div');
    container.className = 'bm-tools';

    const tabBar = document.createElement('div');
    tabBar.className = 'bm-tools__tabs';
    const tabButtons = {};
    for (const tab of TABS) {
        const btn = document.createElement('button');
        btn.className = 'bm-tools__tab-btn';
        btn.dataset.tab = tab;
        btn.textContent = api.getMessage('bmTools' + capitalize(tab) + 'Tab') || tab;
        btn.addEventListener('click', () => activateTab(tab));
        tabBar.appendChild(btn);
        tabButtons[tab] = btn;
    }
    container.appendChild(tabBar);

    const content = document.createElement('div');
    content.className = 'bm-tools__content';
    container.appendChild(content);

    function activateTab(tab) {
        for (const t of TABS) {
            tabButtons[t].classList.toggle('active', t === tab);
        }
        content.innerHTML = '';
        if (tab === 'tags') renderTagsView(content);
        else if (tab === 'duplicates') renderDuplicatesView(content);
        else if (tab === 'deadLinks') renderDeadLinksView(content);
    }

    modal.showCustomDialog({
        title: api.getMessage('bmToolsTitle') || 'Bookmark Tools',
        content: container,
    });
    activateTab(TABS.includes(initialTab) ? initialTab : 'tags');
}

// === Tags tab ===

function renderTagsView(root) {
    const list = document.createElement('div');
    list.className = 'bm-tools__list';
    const all = tagManager.getAllTags();
    if (all.length === 0) {
        list.appendChild(makeEmpty(api.getMessage('bmToolsTagsEmpty') || 'No tags yet.'));
    } else {
        for (const tag of all) list.appendChild(buildTagRow(tag, list));
    }
    root.appendChild(list);

    const createBtn = document.createElement('button');
    createBtn.className = 'bm-tools__create';
    createBtn.textContent = api.getMessage('bmToolsCreateTag') || '+ New tag';
    createBtn.addEventListener('click', async () => {
        const name = await modal.showPrompt({
            title: api.getMessage('bmToolsCreateTagPrompt') || 'New tag name',
            defaultValue: '',
        });
        if (!name || !name.trim()) return;
        const tag = await tagManager.createTag({ name: name.trim() });
        const empty = list.querySelector('.bm-tools__empty');
        if (empty) empty.remove();
        list.appendChild(buildTagRow(tag, list));
    });
    root.appendChild(createBtn);
}

function buildTagRow(tag, listEl) {
    const row = document.createElement('div');
    row.className = 'bm-tools__row';

    const chip = document.createElement('span');
    chip.className = 'bm-tools__tag-chip';
    chip.dataset.color = tag.color;
    chip.textContent = tag.name;
    row.appendChild(chip);

    const count = document.createElement('span');
    count.className = 'bm-tools__count';
    const bookmarkCount = tagManager.getBookmarkIdsForTag(tag.id).length;
    count.textContent = `${bookmarkCount} bookmark(s)`;
    row.appendChild(count);

    const renameBtn = iconBtn('✏️', api.getMessage('workspaceRename') || 'Rename', async () => {
        const newName = await modal.showPrompt({
            title: api.getMessage('workspaceRename') || 'Rename',
            defaultValue: tag.name,
        });
        if (newName && newName.trim()) {
            await tagManager.updateTag(tag.id, { name: newName.trim() });
            tag.name = newName.trim();
            chip.textContent = tag.name;
        }
    });
    row.appendChild(renameBtn);

    const deleteBtn = iconBtn('🗑️', api.getMessage('workspaceDelete') || 'Delete', async () => {
        const ok = await modal.showConfirm({
            title: api.getMessage('bmToolsDeleteTagTitle') || 'Delete tag',
            message: (api.getMessage('bmToolsDeleteTagMessage') || 'Delete tag "{t}"? Bookmarks will not be deleted, only the tag binding.')
                .replace('{t}', tag.name),
            confirmButtonText: api.getMessage('workspaceDelete') || 'Delete',
            confirmButtonClass: 'danger',
        });
        if (ok) {
            await tagManager.deleteTag(tag.id);
            row.remove();
            if (listEl.querySelectorAll('.bm-tools__row').length === 0) {
                listEl.appendChild(makeEmpty(api.getMessage('bmToolsTagsEmpty') || 'No tags yet.'));
            }
        }
    });
    row.appendChild(deleteBtn);

    return row;
}

// === Duplicates tab ===

function renderDuplicatesView(root) {
    const groups = dedupe.findDuplicates();
    if (groups.length === 0) {
        root.appendChild(makeEmpty(api.getMessage('bmToolsDuplicatesEmpty') || 'No duplicate bookmarks. 🎉'));
        return;
    }

    const intro = document.createElement('p');
    intro.className = 'bm-tools__intro';
    intro.textContent = (api.getMessage('bmToolsDuplicatesIntro') || 'Found {n} duplicate group(s). Uncheck the copy you want to keep in each group.')
        .replace('{n}', String(groups.length));
    root.appendChild(intro);

    const list = document.createElement('div');
    list.className = 'bm-tools__list';
    /** @type {Map<string, HTMLInputElement[]>} groupKey → checkboxes (one per copy) */
    const groupCheckboxes = new Map();

    for (const group of groups) {
        const groupEl = document.createElement('div');
        groupEl.className = 'bm-tools__dup-group';

        const header = document.createElement('div');
        header.className = 'bm-tools__dup-header';
        header.textContent = group.normalizedUrl;
        groupEl.appendChild(header);

        const checkboxes = [];
        // First copy is unchecked by default (keep); others checked (delete).
        group.bookmarks.forEach((b, idx) => {
            const row = document.createElement('label');
            row.className = 'bm-tools__dup-row';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.dataset.bookmarkId = b.id;
            cb.checked = idx > 0;
            row.appendChild(cb);
            const label = document.createElement('span');
            label.className = 'bm-tools__dup-label';
            label.textContent = b.title || '(untitled)';
            if (b.path && b.path.length) {
                const path = document.createElement('span');
                path.className = 'bm-tools__dup-path';
                path.textContent = ` — ${b.path.join(' / ')}`;
                label.appendChild(path);
            }
            row.appendChild(label);
            groupEl.appendChild(row);
            checkboxes.push(cb);
        });
        groupCheckboxes.set(group.normalizedUrl, checkboxes);
        list.appendChild(groupEl);
    }
    root.appendChild(list);

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'bm-tools__confirm';
    confirmBtn.textContent = api.getMessage('bmToolsConfirmRemove') || 'Remove selected';
    confirmBtn.addEventListener('click', async () => {
        const idsToRemove = [];
        for (const cbList of groupCheckboxes.values()) {
            // Don't let the user remove every copy in a group; require at least one survivor.
            const checked = cbList.filter(cb => cb.checked);
            const allChecked = checked.length === cbList.length;
            const safe = allChecked ? checked.slice(1) : checked;
            for (const cb of safe) idsToRemove.push(cb.dataset.bookmarkId);
        }
        if (idsToRemove.length === 0) return;
        // Surface the "auto-keep first when all checked" safety rail in the
        // confirm message so the user knows why a fully-checked group still
        // leaves one copy behind.
        const anyAllChecked = Array.from(groupCheckboxes.values())
            .some(cbList => cbList.every(cb => cb.checked));
        const baseMessage = api.getMessage('bmToolsConfirmRemoveMessage')
            || 'Remove {n} bookmark(s)? This cannot be undone.';
        let message = baseMessage.replace('{n}', String(idsToRemove.length));
        if (anyAllChecked) {
            message += '\n\n' + (api.getMessage('bmToolsKeepFirstNote')
                || 'Note: in groups where every copy is checked, the first one is automatically kept.');
        }
        const ok = await modal.showConfirm({
            title: api.getMessage('bmToolsConfirmRemoveTitle') || 'Remove duplicates',
            message,
            confirmButtonText: api.getMessage('workspaceDelete') || 'Delete',
            confirmButtonClass: 'danger',
        });
        if (!ok) return;
        await bulkRemove(idsToRemove);
        document.dispatchEvent(new CustomEvent('refreshBookmarksRequired'));
        // Re-render the duplicates view to show the leftover (possibly none).
        root.innerHTML = '';
        renderDuplicatesView(root);
    });
    root.appendChild(confirmBtn);
}

// === Dead links tab ===

function renderDeadLinksView(root) {
    const intro = document.createElement('p');
    intro.className = 'bm-tools__intro';
    intro.textContent = api.getMessage('bmToolsDeadLinksIntro')
        || 'Scan tries to reach every http(s) bookmark via HEAD. Only network-unreachable links are flagged (not HTTP 404 — see notes).';
    root.appendChild(intro);

    const privacy = document.createElement('p');
    privacy.className = 'bm-tools__intro';
    privacy.textContent = api.getMessage('bmToolsPrivacyNote')
        || 'Note: scanning sends a HEAD request to each bookmark\'s host.';
    root.appendChild(privacy);

    const status = document.createElement('div');
    status.className = 'bm-tools__status';
    root.appendChild(status);

    const warning = document.createElement('div');
    warning.className = 'bm-tools__status bm-tools__warning';
    warning.style.display = 'none';
    root.appendChild(warning);

    const list = document.createElement('div');
    list.className = 'bm-tools__list';
    root.appendChild(list);

    const scanBtn = document.createElement('button');
    scanBtn.className = 'bm-tools__create';
    scanBtn.textContent = api.getMessage('bmToolsStartScan') || 'Start scan';
    root.appendChild(scanBtn);

    scanBtn.addEventListener('click', async () => {
        scanBtn.disabled = true;
        list.innerHTML = '';
        warning.style.display = 'none';
        warning.textContent = '';
        const cache = state.getBookmarkCache() || [];
        const bookmarks = cache.filter(b => b.type === 'bookmark').map(b => ({
            id: String(b.id),
            url: b.url,
            title: b.title || '',
        }));
        if (bookmarks.length === 0) {
            status.textContent = api.getMessage('bmToolsNoBookmarks') || 'No bookmarks to scan.';
            scanBtn.disabled = false;
            return;
        }

        const results = await deadLink.scanDeadLinks(bookmarks, (done, total) => {
            status.textContent = (api.getMessage('bmToolsScanProgress')
                || 'Checking… {done}/{total}')
                .replace('{done}', String(done)).replace('{total}', String(total));
        });
        // Offline pre-check fired — refuse to render anything that looks like
        // "delete all your bookmarks" when the network is down.
        if (results && results.offline) {
            status.textContent = '';
            warning.style.display = '';
            warning.textContent = api.getMessage('bmToolsOfflineWarning')
                || 'You appear to be offline. Connect to the internet and try again — without a network the scan would falsely flag every bookmark as unreachable.';
            scanBtn.disabled = false;
            return;
        }
        const unreachable = results.filter(r => r.status === 'unreachable');
        const totalScanned = results.filter(r => r.status !== 'skipped').length;
        status.textContent = (api.getMessage('bmToolsScanDone')
            || 'Scan complete: {n} unreachable link(s).')
            .replace('{n}', String(unreachable.length));

        if (unreachable.length === 0) {
            scanBtn.disabled = false;
            return;
        }

        // If a suspiciously high ratio of bookmarks failed, the most likely
        // explanation is "user's network is degraded" rather than "user's
        // bookmarks all happen to be dead". Surface that hypothesis instead of
        // silently encouraging deletion.
        const failRatio = totalScanned > 0 ? unreachable.length / totalScanned : 0;
        const suspiciousRatio = failRatio >= 0.5 && totalScanned >= 5;
        if (suspiciousRatio) {
            warning.style.display = '';
            warning.textContent = (api.getMessage('bmToolsNetworkRatioWarning')
                || '{n} of {total} failed ({pct}%) — this is unusually high and looks more like a network issue than dead links. Review carefully.')
                .replace('{n}', String(unreachable.length))
                .replace('{total}', String(totalScanned))
                .replace('{pct}', String(Math.round(failRatio * 100)));
        }

        for (const r of unreachable) {
            const row = document.createElement('label');
            row.className = 'bm-tools__row';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            // Default UNchecked — make the user opt into each deletion. Previous
            // "checked-by-default" made a single confirm wipe the whole library
            // if any transient network issue happened during scan.
            cb.checked = false;
            cb.dataset.bookmarkId = r.bookmarkId;
            row.appendChild(cb);
            const meta = document.createElement('div');
            meta.className = 'bm-tools__meta';
            const t = document.createElement('div');
            t.className = 'bm-tools__title';
            t.textContent = r.title || '(untitled)';
            const u = document.createElement('div');
            u.className = 'bm-tools__sub';
            u.textContent = r.url;
            meta.appendChild(t);
            meta.appendChild(u);
            row.appendChild(meta);
            list.appendChild(row);
        }

        const removeBtn = document.createElement('button');
        removeBtn.className = 'bm-tools__confirm';
        removeBtn.textContent = api.getMessage('bmToolsRemoveUnreachable') || 'Remove checked unreachable bookmarks';
        removeBtn.addEventListener('click', async () => {
            const ids = Array.from(list.querySelectorAll('input[type=checkbox]:checked'))
                .map(cb => cb.dataset.bookmarkId);
            if (ids.length === 0) return;
            const ok = await modal.showConfirm({
                title: api.getMessage('bmToolsConfirmRemoveTitle') || 'Remove dead links',
                message: (api.getMessage('bmToolsConfirmRemoveMessage') || 'Remove {n} bookmark(s)? This cannot be undone.')
                    .replace('{n}', String(ids.length)),
                confirmButtonText: api.getMessage('workspaceDelete') || 'Delete',
                confirmButtonClass: 'danger',
            });
            if (!ok) return;
            await bulkRemove(ids);
            document.dispatchEvent(new CustomEvent('refreshBookmarksRequired'));
            root.innerHTML = '';
            renderDeadLinksView(root);
        });
        root.appendChild(removeBtn);
        scanBtn.disabled = false;
    });
}

// === helpers ===

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

function makeEmpty(text) {
    const el = document.createElement('div');
    el.className = 'bm-tools__empty';
    el.textContent = text;
    return el;
}

function iconBtn(icon, title, handler) {
    const btn = document.createElement('button');
    btn.className = 'bm-tools__btn';
    btn.title = title;
    btn.textContent = icon;
    btn.addEventListener('click', handler);
    return btn;
}
