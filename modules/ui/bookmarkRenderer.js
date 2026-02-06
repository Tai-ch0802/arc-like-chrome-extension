import * as api from '../apiManager.js';
import * as state from '../stateManager.js';
import * as modal from '../modalManager.js';
import { EDIT_ICON_SVG, LINKED_TAB_ICON_SVG, EMPTY_FOLDER_ICON_SVG } from '../icons.js';
import { GROUP_COLORS } from './groupColors.js';
import { highlightText } from '../utils/textUtils.js';
import { reconcileDOM } from '../utils/domUtils.js';

export async function showLinkedTabsPanel(bookmarkId, refreshBookmarksCallback) {
    const [bookmark, allGroups] = await Promise.all([
        api.getBookmark(bookmarkId),
        api.getTabGroupsInCurrentWindow()
    ]);

    if (!bookmark) return;

    const groupMap = new Map(allGroups.map(g => [g.id, g]));
    const linkedTabIds = state.getLinkedTabsByBookmarkId(bookmarkId);
    // Fetch tab info; if getTab fails (tab closed), catch returns null, then we filter out nulls.
    const linkedTabs = (await Promise.all(linkedTabIds.map(id => api.getTab(id).catch(() => null)))).filter(Boolean);

    const listContainer = document.createElement('div');
    listContainer.className = 'linked-tabs-list';
    let shouldAutoClose = false;

    // Check if we have stale tabs (IDs existed in state but tabs are gone)
    // or if the list is just empty.
    if (linkedTabs.length === 0) {
        const msg = document.createElement('p');
        msg.textContent = api.getMessage('noLinkedTabs');
        listContainer.appendChild(msg);

        // If we had IDs in state but no actual tabs found, it means they were stale.
        // We should clean up and auto-close.
        if (linkedTabIds.length > 0) {
            shouldAutoClose = true;
            await state.removeLinksByBookmarkId(bookmarkId);
            const warning = document.createElement('p');
            warning.className = 'auto-close-warning';
            warning.style.marginTop = '10px';
            warning.style.color = 'var(--accent-color)';
            warning.style.fontSize = '0.9em';
            warning.textContent = api.getMessage('autoCloseDialog');
            listContainer.appendChild(warning);
        }
    } else {
        const closeTabLabel = api.getMessage('closeTab') || 'Close Tab';
        for (const tab of linkedTabs) {
            const group = tab.groupId ? groupMap.get(tab.groupId) : null;
            const faviconUrl = (tab.favIconUrl && tab.favIconUrl.startsWith('http')) ? tab.favIconUrl : 'icons/fallback-favicon.svg';

            const item = document.createElement('div');
            item.className = 'linked-tab-item';
            item.dataset.tabId = tab.id;
            item.dataset.windowId = tab.windowId;
            item.title = 'Switch to this tab';

            const img = document.createElement('img');
            img.src = faviconUrl;
            img.alt = "";
            img.className = 'linked-tab-favicon';
            item.appendChild(img);

            const titleSpan = document.createElement('span');
            titleSpan.className = 'linked-tab-title';
            titleSpan.textContent = tab.title;
            item.appendChild(titleSpan);

            if (group) {
                const groupSpan = document.createElement('span');
                groupSpan.className = 'linked-tab-group';
                groupSpan.style.color = GROUP_COLORS[group.color] || '#5f6368';
                groupSpan.textContent = group.title;
                item.appendChild(groupSpan);
            }

            const closeBtn = document.createElement('button');
            closeBtn.className = 'linked-tab-close-btn';
            closeBtn.dataset.tabIdToClose = tab.id;
            closeBtn.setAttribute('aria-label', closeTabLabel);
            closeBtn.title = closeTabLabel;
            closeBtn.textContent = '×';
            item.appendChild(closeBtn);

            listContainer.appendChild(item);
        }
    }

    await modal.showCustomDialog({
        title: `${api.getMessage('linkedTabsPanelTitle')} "${bookmark.title}"`,
        content: listContainer,
        onOpen: (modalContentElement) => {
            const listElement = modalContentElement.querySelector('.linked-tabs-list');
            const closeBtn = modalContentElement.querySelector('#closeButton');

            if (shouldAutoClose) {
                setTimeout(() => {
                    if (closeBtn) closeBtn.click();
                    if (refreshBookmarksCallback) refreshBookmarksCallback();
                }, 5000);
            }

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


// --- Event Delegation State ---
let listenersInitialized = false;
let listenerAbortController = null;
let bookmarkContainer = null;
/** @type {Function|null} Callback for refreshing bookmarks */
let currentRefreshCallback = null;
/** @type {boolean} Flag to expand all folders */
let currentForceExpandAll = false;
/** @type {RegExp[]} Current highlight regexes for lazy load */
let currentHighlightRegexes = [];

// Shared data access helpers for delegation
const getBookmarkItem = (el) => el.closest('.bookmark-item');
const getFolderItem = (el) => el.closest('.bookmark-folder');
const getLinkedIcon = (el) => el.closest('.linked-tab-icon');
const getActionBtn = (el) => el.closest('.bookmark-actions button');

/**
 * Resets bookmark listeners. Useful for re-initialization or cleanup.
 */
export function resetBookmarkListeners() {
    if (listenerAbortController) {
        listenerAbortController.abort();
        listenerAbortController = null;
    }
    listenersInitialized = false;
    currentRefreshCallback = null;
    bookmarkContainer = null;
}

/**
 * Initializes event listeners on the container using delegation.
 */
function initBookmarkListeners(container) {
    if (listenersInitialized) return;
    listenersInitialized = true;
    bookmarkContainer = container;
    listenerAbortController = new AbortController();
    const { signal } = listenerAbortController;

    const handleRefresh = () => {
        if (currentRefreshCallback) currentRefreshCallback();
    };

    container.addEventListener('click', async (e) => {
        // 1. Handle Action Buttons (Edit, Delete, Add Folder)
        const btn = getActionBtn(e.target);
        if (btn) {
            e.preventDefault();
            e.stopPropagation();
            const action = btn.dataset.action;
            const item = btn.closest('.bookmark-item, .bookmark-folder');
            const id = item.dataset.bookmarkId;

            if (action === 'edit-bookmark') {
                try {
                    const node = await api.getBookmark(id);
                    if (!node) return;
                    const result = await modal.showFormDialog({
                        title: api.getMessage("editBookmarkPromptForTitle"),
                        fields: [
                            { name: 'title', label: 'Name', defaultValue: node.title },
                            { name: 'url', label: 'URL', defaultValue: node.url }
                        ],
                        confirmButtonText: api.getMessage("saveButton")
                    });
                    if (result && (result.title !== node.title || result.url !== node.url)) {
                        await api.updateBookmark(id, { title: result.title, url: result.url });
                        handleRefresh();
                    }
                } catch (err) { console.error(err); }
            } else if (action === 'delete-bookmark') {
                try {
                    const node = await api.getBookmark(id);
                    const confirm = await modal.showConfirm({
                        title: api.getMessage("deleteBookmarkConfirm", node ? node.title : ''),
                        confirmButtonText: api.getMessage("deleteButton"),
                        confirmButtonClass: 'danger'
                    });
                    if (confirm) {
                        await api.removeBookmark(id);
                        handleRefresh();
                    }
                } catch (err) { console.error(err); }
            } else if (action === 'edit-folder') {
                try {
                    const node = await api.getBookmark(id);
                    const newTitle = await modal.showPrompt({
                        title: api.getMessage("editBookmarkFolderPromptForTitle"),
                        defaultValue: node ? node.title : '',
                        confirmButtonText: api.getMessage("saveButton")
                    });
                    if (newTitle && newTitle !== node.title) {
                        await api.updateBookmark(id, { title: newTitle });
                        handleRefresh();
                    }
                } catch (err) { console.error(err); }
            } else if (action === 'add-folder') {
                const node = await api.getBookmark(id);
                const newFolderName = await modal.showPrompt({
                    title: api.getMessage("addFolderPrompt", node ? node.title : ''),
                    confirmButtonText: api.getMessage("createButton")
                });
                if (newFolderName) {
                    await api.createBookmark({ parentId: id, title: newFolderName });
                    state.addExpandedFolder(id);
                    handleRefresh();
                }
            } else if (action === 'delete-folder') {
                const node = await api.getBookmark(id);
                const confirm = await modal.showConfirm({
                    title: api.getMessage("deleteFolderConfirm", node ? node.title : ''),
                    confirmButtonText: api.getMessage("deleteButton"),
                    confirmButtonClass: 'danger'
                });
                if (confirm) {
                    await api.removeBookmarkTree(id);
                    state.removeExpandedFolder(id);
                    handleRefresh();
                }
            }
            return;
        }

        // 2. Handle Linked Tab Icon
        const linkedIcon = getLinkedIcon(e.target);
        if (linkedIcon) {
            e.stopPropagation();
            const item = linkedIcon.closest('.bookmark-item');
            showLinkedTabsPanel(item.dataset.bookmarkId, currentRefreshCallback);
            return;
        }

        // 3. Handle Bookmark Item Click (Open Tab)
        const bookmarkItem = getBookmarkItem(e.target);
        if (bookmarkItem) {
            e.preventDefault();
            const id = bookmarkItem.dataset.bookmarkId;
            const node = await api.getBookmark(id);
            if (node && node.url) {
                const newTab = await api.createTab({ url: node.url, active: true });
                await state.addLinkedTab(id, newTab.id);
                handleRefresh();
            }
            return;
        }

        // 4. Handle Folder Click (Expand/Collapse)
        const folderItem = getFolderItem(e.target);
        if (folderItem) {
            const id = folderItem.dataset.bookmarkId;
            const isNowExpanded = !JSON.parse(folderItem.getAttribute('aria-expanded'));
            folderItem.setAttribute('aria-expanded', isNowExpanded.toString());

            const icon = folderItem.querySelector('.bookmark-icon');
            const content = folderItem.nextElementSibling; // folder-content

            if (icon) icon.textContent = isNowExpanded ? '▼' : '▶';
            if (content) {
                content.style.display = isNowExpanded ? 'block' : 'none';

                if (isNowExpanded) {
                    state.addExpandedFolder(id);
                    // Lazy Load / Render children if empty
                    if (content.children.length === 0) {
                        try {
                            // 使用 getSubTree 來獲取包含 children 的節點
                            const subtree = await api.getSubTree(id);
                            if (subtree && subtree[0] && subtree[0].children) {
                                renderBookmarks(subtree[0].children, content, id, currentRefreshCallback, {
                                    forceExpandAll: currentForceExpandAll,
                                    highlightRegexes: currentHighlightRegexes
                                });
                            }
                        } catch (err) {
                            console.error('Failed to load bookmark subtree:', err);
                        }

                        setTimeout(() => {
                            document.dispatchEvent(new CustomEvent('folderExpanded', { detail: { folderId: id } }));
                        }, 50);
                    }
                } else {
                    state.removeExpandedFolder(id);
                }
            }
        }
    }, { signal });

    // Keydown Delegation
    container.addEventListener('keydown', (e) => {
        const item = e.target.closest('.bookmark-item, .bookmark-folder, .linked-tab-icon');
        if (!item) return;

        // Skip if focus is on an action button inside
        if (e.target.tagName === 'BUTTON' && !e.target.classList.contains('linked-tab-icon')) return;

        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            item.click();
        } else if (e.key === 'F2') { // Rename shortcut
            e.preventDefault();
            e.stopPropagation();
            const editBtn = item.querySelector('.bookmark-edit-btn');
            if (editBtn) editBtn.click();
        } else if (e.key === 'Delete') { // Delete shortcut
            e.preventDefault();
            e.stopPropagation();
            const closeBtn = item.querySelector('.bookmark-close-btn');
            if (closeBtn) closeBtn.click();
        }
    }, { signal });
}

// --- DOM Recycling Cache & Helpers ---

/** @type {Map<string, {item: HTMLElement, content: HTMLElement|null}>} Cache for bookmark DOM elements */
let bookmarkElementsCache = new Map();

export function resetBookmarkCache() {
    bookmarkElementsCache = new Map();
}

function updateBookmarkElement(item, node, { highlightRegexes = [] } = {}) {
    // Update basic attributes
    if (item.dataset.bookmarkId !== node.id) item.dataset.bookmarkId = node.id;

    let urlPreview = node.url;
    if (urlPreview && urlPreview.length > 300) {
        urlPreview = urlPreview.substring(0, 300) + '...';
    }
    const newTitleTooltip = `${node.title}\n${urlPreview}`;
    if (item.title !== newTitleTooltip) item.title = newTitleTooltip;

    // Update Icon
    const icon = item.querySelector('.bookmark-icon');
    if (icon) {
        let newSrc = 'icons/fallback-favicon.svg';
        if (node.url && (node.url.startsWith('http') || node.url.startsWith('https'))) {
             try {
                const domain = new URL(node.url).hostname;
                newSrc = `https://www.google.com/s2/favicons?sz=16&domain_url=${domain}`;
            } catch (error) {}
        }
        if (icon.src !== newSrc && !icon.src.endsWith(newSrc)) {
             icon.src = newSrc;
        }
    }

    // Update Title and Highlighting
    const titleSpan = item.querySelector('.bookmark-title');
    const titleWrapper = item.querySelector('.bookmark-content-wrapper');

    if (titleSpan) {
        if (highlightRegexes.length > 0) {
            const titleHtml = highlightText(node.title, highlightRegexes, 'title');
             // Only update if changed
            if (titleSpan.innerHTML !== titleHtml) {
                titleSpan.innerHTML = titleHtml;
                titleSpan.dataset.originalText = node.title;
            }
        } else {
            if (titleSpan.dataset.originalText || titleSpan.textContent !== node.title) {
                titleSpan.textContent = node.title;
                delete titleSpan.dataset.originalText;
            }
        }
    }

    // Domain Match Display Logic
    // Remove existing domain match
    const existingDomain = item.querySelector('.matched-domain');
    if (existingDomain) existingDomain.remove();
    delete item.dataset.urlMatch;
    delete item.dataset.matchedDomain;

    if (highlightRegexes.length > 0 && titleWrapper) {
         const titleMatched = titleSpan && titleSpan.innerHTML.includes('<mark');
         try {
            const domain = new URL(node.url).hostname;
            const domainHtml = highlightText(domain, highlightRegexes, 'url');
            const domainMatched = domainHtml.includes('<mark');

            if (domainMatched && !titleMatched) {
                const domainElement = document.createElement('div');
                domainElement.className = 'matched-domain';
                domainElement.innerHTML = domainHtml + '...';
                titleWrapper.appendChild(domainElement);
                item.dataset.urlMatch = 'true';
                item.dataset.matchedDomain = domain;
            }
        } catch (e) {}
    }

    // Linked Tabs Icon
    const linkedTabIds = state.getLinkedTabsByBookmarkId(node.id);
    const linkedIcon = item.querySelector('.linked-tab-icon');
    if (linkedTabIds.length > 0) {
        if (!linkedIcon) {
             const newLinkedIcon = document.createElement('span');
             newLinkedIcon.className = 'linked-tab-icon';
             newLinkedIcon.style.marginRight = '8px';
             newLinkedIcon.innerHTML = LINKED_TAB_ICON_SVG;
             // Insert before titleWrapper
             item.insertBefore(newLinkedIcon, titleWrapper);
             updateLinkedIconTooltip(newLinkedIcon, linkedTabIds.length);
             newLinkedIcon.setAttribute('role', 'button');
             newLinkedIcon.setAttribute('tabindex', '0');
        } else {
             updateLinkedIconTooltip(linkedIcon, linkedTabIds.length);
        }
    } else if (linkedIcon) {
        linkedIcon.remove();
    }
}

function updateLinkedIconTooltip(icon, count) {
     const label = api.getMessage('linkedTabsIcon') + ' - ' + api.getMessage('linkedTabsTooltip', count.toString());
     if (icon.getAttribute('aria-label') !== label) {
         icon.setAttribute('aria-label', label);
         icon.title = api.getMessage('linkedTabsTooltip', count.toString());
     }
}

function createBookmarkItem(node, options) {
    const item = document.createElement('div');
    item.className = 'bookmark-item';
    item.tabIndex = 0;
    item.setAttribute('role', 'button');

    const icon = document.createElement('img');
    icon.className = 'bookmark-icon';
    icon.alt = "";
    item.appendChild(icon); // Src set in update

    const title = document.createElement('span');
    title.className = 'bookmark-title';

    const titleWrapper = document.createElement('div');
    titleWrapper.className = 'bookmark-content-wrapper';
    titleWrapper.appendChild(title);
    item.appendChild(titleWrapper);

    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'bookmark-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'bookmark-edit-btn';
    editBtn.innerHTML = EDIT_ICON_SVG;
    editBtn.tabIndex = -1;
    editBtn.setAttribute('aria-label', api.getMessage('editBookmark'));
    editBtn.title = api.getMessage('editBookmark');
    editBtn.dataset.action = 'edit-bookmark';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'bookmark-close-btn';
    closeBtn.textContent = '×';
    closeBtn.tabIndex = -1;
    closeBtn.setAttribute('aria-label', api.getMessage('deleteBookmark'));
    closeBtn.title = api.getMessage('deleteBookmark');
    closeBtn.dataset.action = 'delete-bookmark';

    actionsContainer.appendChild(editBtn);
    actionsContainer.appendChild(closeBtn);
    item.appendChild(actionsContainer);

    updateBookmarkElement(item, node, options);
    return item;
}

function getOrCreateBookmarkElement(node, options) {
    const cacheKey = `bookmark_${node.id}`;
    const cached = bookmarkElementsCache.get(cacheKey);
    if (cached && cached.item) {
        updateBookmarkElement(cached.item, node, options);
        return cached.item;
    }
    const item = createBookmarkItem(node, options);
    bookmarkElementsCache.set(cacheKey, { item, content: null });
    return item;
}

function updateFolderElement(item, node, { forceExpandAll = false, highlightRegexes = [] } = {}) {
    if (item.dataset.bookmarkId !== node.id) item.dataset.bookmarkId = node.id;
    if (item.title !== node.title) item.title = node.title;

    const isExpanded = forceExpandAll || state.isFolderExpanded(node.id);
    if (item.getAttribute('aria-expanded') !== isExpanded.toString()) {
        item.setAttribute('aria-expanded', isExpanded.toString());
        const icon = item.querySelector('.bookmark-icon');
        if (icon) icon.textContent = isExpanded ? '▼' : '▶';
    }

    const titleSpan = item.querySelector('.bookmark-title');
    if (titleSpan) {
        if (highlightRegexes.length > 0) {
            const titleHtml = highlightText(node.title, highlightRegexes, 'title');
            if (titleSpan.innerHTML !== titleHtml) {
                titleSpan.innerHTML = titleHtml;
                titleSpan.dataset.originalText = node.title;
            }
        } else {
             if (titleSpan.dataset.originalText || titleSpan.textContent !== node.title) {
                titleSpan.textContent = node.title;
                delete titleSpan.dataset.originalText;
            }
        }
    }
}

function createFolderItem(node, options) {
    const folderItem = document.createElement('div');
    folderItem.className = 'bookmark-folder';
    folderItem.tabIndex = 0;
    folderItem.setAttribute('role', 'button');

    const icon = document.createElement('span');
    icon.className = 'bookmark-icon';
    // Text content set in update
    folderItem.appendChild(icon);

    const title = document.createElement('span');
    title.className = 'bookmark-title';
    folderItem.appendChild(title);

    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'bookmark-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'bookmark-edit-btn';
    editBtn.innerHTML = EDIT_ICON_SVG;
    editBtn.tabIndex = -1;
    editBtn.setAttribute('aria-label', api.getMessage('editFolder'));
    editBtn.title = api.getMessage('editFolder');
    editBtn.dataset.action = 'edit-folder';

    const addFolderBtn = document.createElement('button');
    addFolderBtn.className = 'add-folder-btn';
    addFolderBtn.textContent = '+';
    addFolderBtn.tabIndex = -1;
    addFolderBtn.setAttribute('aria-label', api.getMessage('addFolder'));
    addFolderBtn.title = api.getMessage('addFolder');
    addFolderBtn.dataset.action = 'add-folder';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'bookmark-close-btn';
    closeBtn.textContent = '×';
    closeBtn.tabIndex = -1;
    closeBtn.setAttribute('aria-label', api.getMessage('deleteFolder'));
    closeBtn.title = api.getMessage('deleteFolder');
    closeBtn.dataset.action = 'delete-folder';

    actionsContainer.appendChild(editBtn);
    actionsContainer.appendChild(addFolderBtn);
    actionsContainer.appendChild(closeBtn);
    folderItem.appendChild(actionsContainer);

    updateFolderElement(folderItem, node, options);
    return folderItem;
}

function getOrCreateFolderElement(node, options) {
    const cacheKey = `folder_${node.id}`;
    let cached = bookmarkElementsCache.get(cacheKey);

    let item, content;

    if (cached && cached.item) {
        updateFolderElement(cached.item, node, options);
        item = cached.item;
        content = cached.content;
    } else {
        item = createFolderItem(node, options);
    }

    if (!content) {
         content = document.createElement('div');
         content.className = 'folder-content';
    }

    const isExpanded = options.forceExpandAll || state.isFolderExpanded(node.id);
    content.style.display = isExpanded ? 'block' : 'none';
    content.dataset.parentId = node.id;

    bookmarkElementsCache.set(cacheKey, { item, content });
    return { item, content };
}

export function renderBookmarks(bookmarkNodes, container, parentId, refreshBookmarksCallback, options = {}) {
    if (!listenersInitialized && container.id === 'bookmark-list') {
        initBookmarkListeners(container);
    }

    let forceExpandAll = false;
    let highlightRegexes = [];

    if (typeof options === 'boolean') {
        forceExpandAll = options;
    } else {
        forceExpandAll = options.forceExpandAll || false;
        highlightRegexes = options.highlightRegexes || [];
    }

    // Construct options object for recursive calls
    const currentOptions = { forceExpandAll, highlightRegexes };

    // Only update callback if it's the root render
    if (parentId === '1' || container.id === 'bookmark-list') {
        currentRefreshCallback = refreshBookmarksCallback;
        currentForceExpandAll = forceExpandAll;
        currentHighlightRegexes = highlightRegexes;
    }

    container.dataset.parentId = parentId;

    if (bookmarkNodes.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'empty-folder-message';
        emptyMsg.innerHTML = `${EMPTY_FOLDER_ICON_SVG}<span>${api.getMessage("emptyFolder") || 'Folder is empty'}</span>`;
        reconcileDOM(container, [emptyMsg]);
        return;
    }

    const newChildren = [];

    bookmarkNodes.forEach(node => {
        if (node.url) { // It's a bookmark
            const item = getOrCreateBookmarkElement(node, currentOptions);
            newChildren.push(item);
        } else if (node.children) { // It's a folder
            const { item, content } = getOrCreateFolderElement(node, currentOptions);

            const isExpanded = currentOptions.forceExpandAll || state.isFolderExpanded(node.id);
            if (isExpanded && node.children) {
                renderBookmarks(node.children, content, node.id, refreshBookmarksCallback, currentOptions);
            }

            newChildren.push(item);
            newChildren.push(content);
        }
    });

    reconcileDOM(container, newChildren);
}
