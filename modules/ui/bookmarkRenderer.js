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

export function renderBookmarks(bookmarkNodes, container, parentId, refreshBookmarksCallback) {
    container.dataset.parentId = parentId;
    bookmarkNodes.forEach(node => {
        if (node.url) {
            const linkedTabIds = state.getLinkedTabsByBookmarkId(node.id);

            const bookmarkItem = document.createElement('div'); // Changed from 'a' to 'div'
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

            // 創建 title 容器，用於包裹 title 和可能的 domain
            const titleWrapper = document.createElement('div');
            titleWrapper.className = 'bookmark-content-wrapper';
            titleWrapper.appendChild(title);

            bookmarkItem.appendChild(icon);

            // --- Linked Tab Icon ---
            if (linkedTabIds.length > 0) {
                const linkedIcon = document.createElement('span');
                linkedIcon.className = 'linked-tab-icon';
                linkedIcon.style.marginRight = '8px'; // Add margin to separate from title

                // Get the accent color from the current theme
                const accentColor = getComputedStyle(document.body).getPropertyValue('--accent-color').trim();

                // Using an inline SVG for the link icon with the theme's accent color
                linkedIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${accentColor || 'currentColor'}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72"></path></svg>`;
                linkedIcon.title = api.getMessage('linkedTabsTooltip', linkedTabIds.length.toString());

                linkedIcon.addEventListener('click', (e) => {
                    e.stopPropagation();
                    showLinkedTabsPanel(node.id);
                });
                bookmarkItem.appendChild(linkedIcon); // Append icon after main icon
            }

            bookmarkItem.appendChild(titleWrapper);  // 使用 titleWrapper


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

            // --- Modified Click Listener ---
            bookmarkItem.addEventListener('click', async (e) => {
                if (e.target.closest('.bookmark-actions') || e.target.closest('.linked-tab-icon')) {
                    return; // Ignore clicks on action buttons or the linked icon
                }
                e.preventDefault();
                const newTab = await api.createTab({ url: node.url, active: true });
                await state.addLinkedTab(node.id, newTab.id);
                refreshBookmarksCallback(); // Refresh to show the new linked icon
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
            renderBookmarks(node.children, folderContent, node.id, refreshBookmarksCallback);
        }
    });
}
