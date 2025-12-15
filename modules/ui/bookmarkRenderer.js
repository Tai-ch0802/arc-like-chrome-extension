import * as api from '../apiManager.js';
import * as state from '../stateManager.js';
import * as modal from '../modalManager.js';

const GROUP_COLORS = {
    grey: '#5f6368',
    blue: '#8ab4f8',
    red: '#f28b82',
    yellow: '#fdd663',
    green: '#81c995',
    pink: '#ff8bcb',
    purple: '#c58af9',
    cyan: '#78d9ec',
    orange: '#ffab70'
};

export async function showLinkedTabsPanel(bookmarkId) {
    const [bookmark, allGroups] = await Promise.all([
        api.getBookmark(bookmarkId),
        api.getTabGroupsInCurrentWindow()
    ]);

    if (!bookmark) return;

    const groupMap = new Map(allGroups.map(g => [g.id, g]));
    const linkedTabIds = state.getLinkedTabsByBookmarkId(bookmarkId);
    const linkedTabs = (await Promise.all(linkedTabIds.map(id => api.getTab(id).catch(() => null)))).filter(Boolean);

    let contentHtml = '<div class="linked-tabs-list">';

    if (linkedTabs.length === 0) {
        contentHtml += `<p>${api.getMessage('noLinkedTabs')}</p>`;
    } else {
        for (const tab of linkedTabs) {
            const group = tab.groupId ? groupMap.get(tab.groupId) : null;
            const groupName = group ? `<span class="linked-tab-group" style="color: ${GROUP_COLORS[group.color] || '#5f6368'};">${group.title}</span>` : '';
            const faviconUrl = (tab.favIconUrl && tab.favIconUrl.startsWith('http')) ? tab.favIconUrl : 'icons/fallback-favicon.svg';

            contentHtml += `
                <div class="linked-tab-item" data-tab-id="${tab.id}" data-window-id="${tab.windowId}" title="Switch to this tab">
                    <img src="${faviconUrl}" class="linked-tab-favicon" />
                    <span class="linked-tab-title">${tab.title}</span>
                    ${groupName}
                    <button class="linked-tab-close-btn" data-tab-id-to-close="${tab.id}">&times;</button>
                </div>
            `;
        }
    }
    contentHtml += '</div>';

    await modal.showCustomDialog({
        title: `${api.getMessage('linkedTabsPanelTitle')} "${bookmark.title}"`,
        content: contentHtml,
        onOpen: (modalContentElement) => {
            const listElement = modalContentElement.querySelector('.linked-tabs-list');
            const closeBtn = modalContentElement.querySelector('#closeButton');

            modalContentElement.querySelectorAll('.linked-tab-item').forEach(item => {
                item.addEventListener('click', async (e) => {
                    if (e.target.classList.contains('linked-tab-close-btn')) {
                        return; // Handled by the button's own listener
                    }
                    const tabId = parseInt(item.dataset.tabId, 10);
                    const windowId = parseInt(item.dataset.windowId, 10);
                    await api.updateTab(tabId, { active: true });
                    await api.updateWindow(windowId, { focused: true });
                    if (closeBtn) closeBtn.click();
                });
            });

            modalContentElement.querySelectorAll('.linked-tab-close-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const tabId = parseInt(btn.dataset.tabIdToClose, 10);
                    await api.removeTab(tabId);
                    btn.closest('.linked-tab-item').remove();

                    // If the list is now empty, close the dialog
                    if (listElement && listElement.children.length === 0) {
                        if (closeBtn) closeBtn.click();
                    }
                });
            });
        }
    });
}

import { flattenBookmarkTree } from '../utils/virtualScrollUtils.js';

// ... (existing showLinkedTabsPanel)

// Legacy Renderer (Recursive DOM)
function renderBookmarksLegacy(bookmarkNodes, container, parentId, refreshBookmarksCallback) {
    container.dataset.parentId = parentId;
    bookmarkNodes.forEach(node => {
        // ... (existing render logic, copy-pasted from original renderBookmarks)
        if (node.url) {
            const linkedTabIds = state.getLinkedTabsByBookmarkId(node.id);

            const bookmarkItem = document.createElement('div');
            bookmarkItem.className = 'bookmark-item';
            bookmarkItem.dataset.bookmarkId = node.id;

            let urlPreview = node.url;
            if (urlPreview && urlPreview.length > 300) {
                urlPreview = urlPreview.substring(0, 300) + '...';
            }
            bookmarkItem.title = `${node.title}\n${urlPreview}`;

            const icon = document.createElement('img');
            icon.className = 'bookmark-icon';
            if (node.url && (node.url.startsWith('http') || node.url.startsWith('https'))) {
                try {
                    const domain = new URL(node.url).hostname;
                    icon.src = `https://www.google.com/s2/favicons?sz=16&domain_url=${domain}`;
                } catch (error) {
                    icon.src = 'icons/fallback-favicon.svg';
                }
            } else {
                icon.src = 'icons/fallback-favicon.svg';
            }

            icon.onerror = () => {
                icon.src = 'icons/fallback-favicon.svg';
            };
            const title = document.createElement('span');
            title.className = 'bookmark-title';
            title.textContent = node.title;

            const titleWrapper = document.createElement('div');
            titleWrapper.className = 'bookmark-content-wrapper';
            titleWrapper.appendChild(title);

            bookmarkItem.appendChild(icon);

            if (linkedTabIds.length > 0) {
                const linkedIcon = document.createElement('span');
                linkedIcon.className = 'linked-tab-icon';
                linkedIcon.style.marginRight = '8px';
                const accentColor = getComputedStyle(document.body).getPropertyValue('--accent-color').trim();
                linkedIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${accentColor || 'currentColor'}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72"></path></svg>`;
                linkedIcon.title = api.getMessage('linkedTabsTooltip', linkedTabIds.length.toString());
                linkedIcon.addEventListener('click', (e) => {
                    e.stopPropagation();
                    showLinkedTabsPanel(node.id);
                });
                bookmarkItem.appendChild(linkedIcon);
            }

            bookmarkItem.appendChild(titleWrapper);

            const actionsContainer = document.createElement('div');
            actionsContainer.className = 'bookmark-actions';

            const editBtn = document.createElement('button');
            editBtn.className = 'bookmark-edit-btn';
            editBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path><path d="m15 5 4 4"></path></svg>`;
            editBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const result = await modal.showFormDialog({
                    title: api.getMessage("editBookmarkPromptForTitle"),
                    fields: [
                        { name: 'title', label: 'Name', defaultValue: node.title },
                        { name: 'url', label: 'URL', defaultValue: node.url }
                    ],
                    confirmButtonText: api.getMessage("saveButton")
                });
                if (result && (result.title !== node.title || result.url !== node.url)) {
                    api.updateBookmark(node.id, { title: result.title, url: result.url }).then(refreshBookmarksCallback);
                }
            });

            const closeBtn = document.createElement('button');
            closeBtn.className = 'bookmark-close-btn';
            closeBtn.textContent = '×';
            closeBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const confirm = await modal.showConfirm({
                    title: api.getMessage("deleteBookmarkConfirm", node.title),
                    confirmButtonText: api.getMessage("deleteButton"),
                    confirmButtonClass: 'danger'
                });
                if (confirm) {
                    api.removeBookmark(node.id).then(refreshBookmarksCallback);
                }
            });

            actionsContainer.appendChild(editBtn);
            actionsContainer.appendChild(closeBtn);
            bookmarkItem.appendChild(actionsContainer);

            bookmarkItem.addEventListener('click', async (e) => {
                if (e.target.closest('.bookmark-actions') || e.target.closest('.linked-tab-icon')) {
                    return;
                }
                e.preventDefault();
                const newTab = await api.createTab({ url: node.url, active: true });
                await state.addLinkedTab(node.id, newTab.id);
                refreshBookmarksCallback();
            });
            container.appendChild(bookmarkItem);

        } else if (node.children) {
            const folderItem = document.createElement('div');
            folderItem.className = 'bookmark-folder';
            folderItem.dataset.bookmarkId = node.id;
            folderItem.title = node.title;

            const isExpanded = state.isFolderExpanded(node.id);
            const icon = document.createElement('span');
            icon.className = 'bookmark-icon';
            icon.textContent = isExpanded ? '▼' : '▶';
            const title = document.createElement('span');
            title.className = 'bookmark-title';
            title.textContent = node.title;

            const actionsContainer = document.createElement('div');
            actionsContainer.className = 'bookmark-actions';

            const editBtn = document.createElement('button');
            editBtn.className = 'bookmark-edit-btn';
            editBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path><path d="m15 5 4 4"></path></svg>`;
            editBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const newTitle = await modal.showPrompt({
                    title: api.getMessage("editBookmarkFolderPromptForTitle"),
                    defaultValue: node.title,
                    confirmButtonText: api.getMessage("saveButton")
                });
                if (newTitle && newTitle !== node.title) {
                    api.updateBookmark(node.id, { title: newTitle }).then(refreshBookmarksCallback);
                }
            });

            const addFolderBtn = document.createElement('button');
            addFolderBtn.className = 'add-folder-btn';
            addFolderBtn.textContent = '+';
            addFolderBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const newFolderName = await modal.showPrompt({
                    title: api.getMessage("addFolderPrompt", node.title),
                    confirmButtonText: api.getMessage("createButton")
                });
                if (newFolderName) {
                    api.createBookmark({ parentId: node.id, title: newFolderName }).then(() => {
                        state.addExpandedFolder(node.id);
                        refreshBookmarksCallback();
                    });
                }
            });

            const closeBtn = document.createElement('button');
            closeBtn.className = 'bookmark-close-btn';
            closeBtn.textContent = '×';
            closeBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const confirm = await modal.showConfirm({
                    title: api.getMessage("deleteFolderConfirm", node.title),
                    confirmButtonText: api.getMessage("deleteButton"),
                    confirmButtonClass: 'danger'
                });
                if (confirm) {
                    api.removeBookmarkTree(node.id).then(() => {
                        state.removeExpandedFolder(node.id);
                        refreshBookmarksCallback();
                    });
                }
            });

            actionsContainer.appendChild(editBtn);
            if (!node.url) {
                actionsContainer.appendChild(addFolderBtn);
            }
            actionsContainer.appendChild(closeBtn);

            folderItem.appendChild(icon);
            folderItem.appendChild(title);
            folderItem.appendChild(actionsContainer);
            container.appendChild(folderItem);

            const folderContent = document.createElement('div');
            folderContent.className = 'folder-content';
            folderContent.style.display = isExpanded ? 'block' : 'none';
            container.appendChild(folderContent);

            folderItem.addEventListener('click', (e) => {
                if (e.target.tagName !== 'BUTTON') {
                    const isNowExpanded = folderContent.style.display === 'none';
                    folderContent.style.display = isNowExpanded ? 'block' : 'none';
                    icon.textContent = isNowExpanded ? '▼' : '▶';
                    if (isNowExpanded) {
                        state.addExpandedFolder(node.id);
                    } else {
                        state.removeExpandedFolder(node.id);
                    }
                }
            });
            renderBookmarksLegacy(node.children, folderContent, node.id, refreshBookmarksCallback);
        }
    });
}

// Virtual Renderer
const ITEM_HEIGHT = 30; // Fixed height for virtual items

function renderBookmarksVirtual(bookmarkNodes, container, parentId, refreshBookmarksCallback, filterKeywords = []) {
    // Set parentId for drag-drop handling (required by handleBookmarkDrop)
    container.dataset.parentId = parentId;

    // Flatten the tree
    const flatList = flattenBookmarkTree(bookmarkNodes, state.isFolderExpanded, filterKeywords);

    // Setup container
    container.innerHTML = '';
    container.classList.add('virtual-scroll-container');
    container.style.position = 'relative';
    container.style.overflowY = 'auto';
    container.style.height = '100%'; // Ensure it takes full height

    const totalHeight = flatList.length * ITEM_HEIGHT;

    // Spacer to simulate total height
    const spacer = document.createElement('div');
    spacer.style.height = `${totalHeight}px`;
    spacer.style.width = '1px'; // Minimal width
    container.appendChild(spacer);

    // Calculate visible range
    const scrollTop = container.scrollTop;
    const containerHeight = container.clientHeight || 600; // Fallback height
    const startIndex = Math.floor(scrollTop / ITEM_HEIGHT);
    const endIndex = Math.min(flatList.length - 1, Math.floor((scrollTop + containerHeight) / ITEM_HEIGHT) + 5); // Buffer

    // Render visible items
    for (let i = startIndex; i <= endIndex; i++) {
        const item = flatList[i];
        if (!item) continue;

        const node = item.node;
        const depth = item.depth;
        const top = i * ITEM_HEIGHT;

        let element;
        if (node.url) {
            element = createVirtualBookmarkItem(node, depth, refreshBookmarksCallback);
        } else {
            element = createVirtualFolderItem(node, depth, item.isExpanded, refreshBookmarksCallback);
        }

        element.style.position = 'absolute';
        element.style.top = `${top}px`;
        element.style.left = '0';
        element.style.width = '100%';
        element.style.height = `${ITEM_HEIGHT}px`;

        container.appendChild(element);
    }

    // Scroll listener (debounced or throttled ideally, but simple for now)
    const onScroll = () => {
        // Re-render only if indices changed significantly? 
        // For simplicity, we can just re-call renderBookmarksVirtual but that's expensive to re-flatten.
        // Ideally we keep flatList in memory.
        // But for this Beta implementation, let's just re-render the visible slice.
        // To do that properly, we need to separate "flattening" from "rendering slice".
        // But since we are inside renderBookmarksVirtual which is called by uiManager, 
        // we might need to store the flatList on the container or a closure.

        // Optimization: Just update the DOM elements? 
        // Let's stick to a simple re-render of the slice for now.
        // But wait, if we re-call this function, we re-flatten. That's bad.

        // We should attach the scroll listener ONCE.
        // And store the flatList.
    };

    // Store flatList on container for the scroll handler to access
    container._virtualFlatList = flatList;
    container._virtualRefreshCallback = refreshBookmarksCallback;

    if (!container._virtualScrollHandler) {
        container._virtualScrollHandler = () => {
            const list = container._virtualFlatList;
            if (!list) return;

            const sTop = container.scrollTop;
            const cHeight = container.clientHeight;
            const sIndex = Math.floor(sTop / ITEM_HEIGHT);
            const eIndex = Math.min(list.length - 1, Math.floor((sTop + cHeight) / ITEM_HEIGHT) + 5);

            // Remove old items (except spacer)
            Array.from(container.children).forEach(child => {
                if (child !== spacer) child.remove();
            });

            // Render new slice
            for (let j = sIndex; j <= eIndex; j++) {
                const it = list[j];
                if (!it) continue;

                let el;
                if (it.node.url) {
                    el = createVirtualBookmarkItem(it.node, it.depth, container._virtualRefreshCallback);
                } else {
                    el = createVirtualFolderItem(it.node, it.depth, it.isExpanded, container._virtualRefreshCallback);
                }

                el.style.position = 'absolute';
                el.style.top = `${j * ITEM_HEIGHT}px`;
                el.style.left = '0';
                el.style.width = '100%';
                el.style.height = `${ITEM_HEIGHT}px`;
                container.appendChild(el);
            }
        };
        container.addEventListener('scroll', container._virtualScrollHandler);
    }
}

function createVirtualBookmarkItem(node, depth, refreshCallback) {
    // ... (Similar to legacy but returns element, handles depth via padding)
    // Simplified creation for brevity, reusing logic
    const item = document.createElement('div');
    item.className = 'bookmark-item virtual-item';
    item.dataset.bookmarkId = node.id;
    item.style.paddingLeft = `${depth * 20 + 8}px`; // Indentation

    // ... (Content creation: icon, title, actions)
    // For Beta, let's reuse the exact innerHTML structure logic if possible or copy-paste
    // Copy-pasting logic from legacy for now to ensure exact UI match

    let urlPreview = node.url;
    if (urlPreview && urlPreview.length > 300) urlPreview = urlPreview.substring(0, 300) + '...';
    item.title = `${node.title}\n${urlPreview}`;

    const icon = document.createElement('img');
    icon.className = 'bookmark-icon';
    icon.src = (node.url && node.url.startsWith('http')) ?
        `https://www.google.com/s2/favicons?sz=16&domain_url=${new URL(node.url).hostname}` : 'icons/fallback-favicon.svg';
    icon.onerror = () => icon.src = 'icons/fallback-favicon.svg';

    const title = document.createElement('span');
    title.className = 'bookmark-title';
    title.textContent = node.title;

    const titleWrapper = document.createElement('div');
    titleWrapper.className = 'bookmark-content-wrapper';
    titleWrapper.appendChild(title);

    item.appendChild(icon);

    // Linked Tabs (Simplified check)
    const linkedTabIds = state.getLinkedTabsByBookmarkId(node.id);
    if (linkedTabIds.length > 0) {
        const linkedIcon = document.createElement('span');
        linkedIcon.className = 'linked-tab-icon';
        linkedIcon.style.marginRight = '8px';
        const accentColor = getComputedStyle(document.body).getPropertyValue('--accent-color').trim();
        linkedIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${accentColor || 'currentColor'}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72"></path></svg>`;
        linkedIcon.addEventListener('click', (e) => { e.stopPropagation(); showLinkedTabsPanel(node.id); });
        item.appendChild(linkedIcon);
    }

    item.appendChild(titleWrapper);

    // Actions
    const actions = document.createElement('div');
    actions.className = 'bookmark-actions';
    // ... (Add edit/delete buttons similar to legacy)
    // For brevity in this tool call, I'll omit full button logic reconstruction here but in real code it must be there.
    // I will add a placeholder or copy full logic in next step if needed.
    // Actually, I should include it to be correct.

    // Edit Btn
    const editBtn = document.createElement('button');
    editBtn.className = 'bookmark-edit-btn';
    editBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path><path d="m15 5 4 4"></path></svg>`;
    editBtn.addEventListener('click', async (e) => {
        e.preventDefault(); e.stopPropagation();
        const result = await modal.showFormDialog({
            title: api.getMessage("editBookmarkPromptForTitle"),
            fields: [{ name: 'title', label: 'Name', defaultValue: node.title }, { name: 'url', label: 'URL', defaultValue: node.url }],
            confirmButtonText: api.getMessage("saveButton")
        });
        if (result && (result.title !== node.title || result.url !== node.url)) {
            api.updateBookmark(node.id, { title: result.title, url: result.url }).then(refreshCallback);
        }
    });
    actions.appendChild(editBtn);

    // Close Btn
    const closeBtn = document.createElement('button');
    closeBtn.className = 'bookmark-close-btn';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', async (e) => {
        e.preventDefault(); e.stopPropagation();
        if (await modal.showConfirm({ title: api.getMessage("deleteBookmarkConfirm", node.title), confirmButtonText: api.getMessage("deleteButton"), confirmButtonClass: 'danger' })) {
            api.removeBookmark(node.id).then(refreshCallback);
        }
    });
    actions.appendChild(closeBtn);

    item.appendChild(actions);

    item.addEventListener('click', async (e) => {
        if (e.target.closest('.bookmark-actions') || e.target.closest('.linked-tab-icon')) return;
        e.preventDefault();
        const newTab = await api.createTab({ url: node.url, active: true });
        await state.addLinkedTab(node.id, newTab.id);
        refreshCallback();
    });

    return item;
}

function createVirtualFolderItem(node, depth, isExpanded, refreshCallback) {
    const item = document.createElement('div');
    item.className = 'bookmark-folder virtual-item';
    item.dataset.bookmarkId = node.id;
    item.style.paddingLeft = `${depth * 20 + 8}px`;
    item.title = node.title;

    const icon = document.createElement('span');
    icon.className = 'bookmark-icon';
    icon.textContent = isExpanded ? '▼' : '▶';

    const title = document.createElement('span');
    title.className = 'bookmark-title';
    title.textContent = node.title;

    const actions = document.createElement('div');
    actions.className = 'bookmark-actions';

    // Edit Btn
    const editBtn = document.createElement('button');
    editBtn.className = 'bookmark-edit-btn';
    editBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path><path d="m15 5 4 4"></path></svg>`;
    editBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const newTitle = await modal.showPrompt({ title: api.getMessage("editBookmarkFolderPromptForTitle"), defaultValue: node.title, confirmButtonText: api.getMessage("saveButton") });
        if (newTitle && newTitle !== node.title) api.updateBookmark(node.id, { title: newTitle }).then(refreshCallback);
    });
    actions.appendChild(editBtn);

    // Add Folder Btn
    const addFolderBtn = document.createElement('button');
    addFolderBtn.className = 'add-folder-btn';
    addFolderBtn.textContent = '+';
    addFolderBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const newName = await modal.showPrompt({ title: api.getMessage("addFolderPrompt", node.title), confirmButtonText: api.getMessage("createButton") });
        if (newName) {
            api.createBookmark({ parentId: node.id, title: newName }).then(() => {
                state.addExpandedFolder(node.id);
                refreshCallback();
            });
        }
    });
    actions.appendChild(addFolderBtn);

    // Close Btn
    const closeBtn = document.createElement('button');
    closeBtn.className = 'bookmark-close-btn';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (await modal.showConfirm({ title: api.getMessage("deleteFolderConfirm", node.title), confirmButtonText: api.getMessage("deleteButton"), confirmButtonClass: 'danger' })) {
            api.removeBookmarkTree(node.id).then(() => {
                state.removeExpandedFolder(node.id);
                refreshCallback();
            });
        }
    });
    actions.appendChild(closeBtn);

    item.appendChild(icon);
    item.appendChild(title);
    item.appendChild(actions);

    item.addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON') {
            if (isExpanded) {
                state.removeExpandedFolder(node.id);
            } else {
                state.addExpandedFolder(node.id);
            }
            // In virtual mode, trigger refresh via event instead of callback
            document.dispatchEvent(new CustomEvent('refreshBookmarksRequired'));
        }
    });

    return item;
}

export function renderBookmarks(bookmarkNodes, container, parentId, refreshBookmarksCallback, filterKeywords = []) {
    if (state.isVirtualScrollingEnabled()) {
        renderBookmarksVirtual(bookmarkNodes, container, parentId, refreshBookmarksCallback, filterKeywords);
    } else {
        // Legacy mode doesn't support filterKeywords in render, it relies on DOM filtering in searchManager
        // But if we are in legacy mode, we should clear the container first if it was virtual
        container.innerHTML = '';
        container.classList.remove('virtual-scroll-container');
        container.style.height = '';
        container.style.overflowY = '';
        container.style.position = '';
        // Remove scroll listener if any (not easy to remove anonymous function, but we can reset the property)
        if (container._virtualScrollHandler) {
            container.removeEventListener('scroll', container._virtualScrollHandler);
            delete container._virtualScrollHandler;
        }
        renderBookmarksLegacy(bookmarkNodes, container, parentId, refreshBookmarksCallback);
    }
}
