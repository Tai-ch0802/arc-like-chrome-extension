import * as api from './apiManager.js';
import * as ui from './uiManager.js';
import * as state from './stateManager.js';
import * as modal from './modalManager.js';

let tabSortableInstances = [];
let bookmarkSortableInstances = [];
let folderOpenTimer = null;

function initialize(refreshBookmarks, updateTabList) {
    initializeTabSortable(updateTabList);
    initializeBookmarkSortable(refreshBookmarks, updateTabList);

    // Listen for folder expansion to reinitialize Sortable for new containers
    document.addEventListener('folderExpanded', () => {
        initializeBookmarkSortable(refreshBookmarks, updateTabList);
    });
}

function initializeTabSortable(updateTabList) {
    tabSortableInstances.forEach(instance => instance.destroy());
    tabSortableInstances = [];
    const sortableOptions = {
        group: {
            name: 'shared-list',
            pull: true,
            put: true
        },
        animation: 150,
        scroll: true,
        scrollSensitivity: 50,
        scrollSpeed: 15,
        onEnd: (evt) => handleDragEnd(evt, updateTabList),
        onAdd: (evt) => handleDragAdd(evt, updateTabList),
    };
    tabSortableInstances.push(new Sortable(ui.tabListContainer, sortableOptions));
    document.querySelectorAll('.tab-group-content').forEach(groupContent => {
        tabSortableInstances.push(new Sortable(groupContent, sortableOptions));
    });
}

function initializeBookmarkSortable(refreshBookmarks, updateTabList) {
    bookmarkSortableInstances.forEach(instance => instance.destroy());
    bookmarkSortableInstances = [];
    const sortableOptions = {
        group: {
            name: 'shared-list',
            pull: true,
            put: true
        },
        animation: 150,
        scroll: true,
        scrollSensitivity: 50,
        scrollSpeed: 15,
        // Only allow dragging .bookmark-item and .bookmark-folder, not .folder-content
        draggable: '.bookmark-item, .bookmark-folder',
        onEnd: (evt) => handleBookmarkDrop(evt, refreshBookmarks, updateTabList),
        onAdd: (evt) => handleBookmarkDrop(evt, refreshBookmarks, updateTabList),
        onDragOver: function (evt) {
            clearTimeout(folderOpenTimer);
            const { related } = evt;
            if (related && related.classList) {
                const isCollapsedFolder = related.classList.contains('bookmark-folder') &&
                    related.querySelector('.bookmark-icon')?.textContent === '▶';
                if (isCollapsedFolder) {
                    folderOpenTimer = setTimeout(() => {
                        related.click();
                    }, 1000);
                }
            }
        },
    };

    // Initialize Sortable on all folder-content containers, including empty ones,
    // so users can drag items into empty folders.
    const folderContents = Array.from(document.querySelectorAll('.folder-content'));
    const sortableContainers = [ui.bookmarkListContainer, ...folderContents];

    sortableContainers.forEach(container => {
        bookmarkSortableInstances.push(new Sortable(container, sortableOptions));
    });
}

async function handleDragEnd(evt, updateTabList) {
    if (evt.to.closest('#bookmark-list')) {
        return;
    }
    const { item, newIndex } = evt;
    await moveItem(item, newIndex, evt.to);
}

async function handleDragAdd(evt, updateTabList) {
    const { item, newIndex, to, from } = evt;
    if (item.classList.contains('bookmark-item') || item.classList.contains('bookmark-folder')) {
        from.appendChild(item);
        return;
    }

    let tabIdsToMove = [];
    if (item.classList.contains('tab-split-group')) {
        const children = Array.from(item.querySelectorAll('.tab-item'));
        tabIdsToMove = children.map(el => parseInt(el.dataset.tabId, 10)).filter(id => !isNaN(id));
    } else {
        const id = parseInt(item.dataset.tabId, 10);
        if (id) tabIdsToMove.push(id);
    }

    if (tabIdsToMove.length === 0) return;

    // When adding to a group or ungrouping, Chrome API handles the move internally.
    // We should NOT call moveItem afterwards as it causes race conditions/crashes.
    if (to.classList.contains('tab-group-content')) {
        const header = to.previousElementSibling;
        const targetGroupId = parseInt(header.dataset.groupId, 10);
        await api.groupTabs(tabIdsToMove, targetGroupId);
        // No moveItem call - groupTabs handles positioning
    } else if (to.id === 'tab-list') {
        await api.ungroupTabs(tabIdsToMove);
        // No moveItem call - ungroupTabs handles positioning
    }
}

async function moveItem(item, newIndex, container) {
    // Exclude tabs that are inside a split view because the split group itself is the draggable unit
    // This prevents double-counting indices or finding a nested tab as the 'next' element
    const allDraggables = Array.from(container.closest('#tab-list').querySelectorAll('.tab-item:not(.in-split-view), .tab-group-header, .tab-split-group'));

    const droppedItemElement = allDraggables.find(el => el === item);

    // Safety check if something went wrong finding the element
    if (!droppedItemElement) return;

    const actualNewIndex = allDraggables.indexOf(droppedItemElement);
    const targetElement = allDraggables[actualNewIndex + 1];
    let targetAbsoluteIndex = -1;
    if (targetElement) {
        if (targetElement.classList.contains('tab-item')) {
            const targetTabId = parseInt(targetElement.dataset.tabId, 10);
            const tab = await api.getTab(targetTabId);
            targetAbsoluteIndex = tab.index;
        } else if (targetElement.classList.contains('tab-group-header')) {
            const targetGroupId = parseInt(targetElement.dataset.groupId, 10);
            const tabsInGroup = await api.getTabsInCurrentWindow();
            const filteredTabs = tabsInGroup.filter(t => t.groupId === targetGroupId);
            if (filteredTabs.length > 0) {
                targetAbsoluteIndex = Math.min(...filteredTabs.map(t => t.index));
            }
        } else if (targetElement.classList.contains('tab-split-group')) {
            // If target is a split group, target the index of its first child tab
            const firstChild = targetElement.querySelector('.tab-item');
            if (firstChild) {
                const targetTabId = parseInt(firstChild.dataset.tabId, 10);
                const tab = await api.getTab(targetTabId);
                targetAbsoluteIndex = tab.index;
            }
        }
    }

    if (item.classList.contains('tab-item')) {
        const tabIdToMove = parseInt(item.dataset.tabId, 10);
        await api.moveTab(tabIdToMove, targetAbsoluteIndex);
    } else if (item.classList.contains('tab-group-header')) {
        const groupIdToMove = parseInt(item.dataset.groupId, 10);
        await api.moveTabGroup(groupIdToMove, targetAbsoluteIndex);
    } else if (item.classList.contains('tab-split-group')) {
        const children = Array.from(item.querySelectorAll('.tab-item'));
        const tabIdsToMove = children.map(el => parseInt(el.dataset.tabId, 10)).filter(id => !isNaN(id));
        if (tabIdsToMove.length > 0) {
            await api.moveTab(tabIdsToMove, targetAbsoluteIndex);
        }
    }
}

async function handleBookmarkDrop(evt, refreshBookmarks, updateTabList) {
    const { item, to, newIndex } = evt;
    if (item.classList.contains('tab-item')) {
        const tabId = parseInt(item.dataset.tabId, 10);
        const title = item.querySelector('.tab-title').textContent;
        const url = item.dataset.url;
        const parentId = to.dataset.parentId;
        if (title && url && parentId && tabId) {
            // Check for duplicate bookmark
            const existingBookmark = await api.searchBookmarksByUrl(url);
            if (existingBookmark) {
                const confirm = await modal.showConfirm({
                    title: api.getMessage('duplicateBookmarkConfirm', existingBookmark.title),
                    confirmButtonText: api.getMessage('addButton'),
                    cancelButtonText: api.getMessage('cancelButton')
                });
                if (!confirm) {
                    // User cancelled, do not create bookmark.
                    // SortableJS will handle returning the item to its original list.
                    refreshBookmarks(); // This will now show the linked icon
                    updateTabList();
                    return;
                }
            }
            const newBookmark = await api.createBookmark({
                parentId: parentId,
                title: title,
                url: url,
                index: newIndex
            });
            // Add the link between the original tab and the new bookmark
            if (newBookmark) {
                await state.addLinkedTab(newBookmark.id, tabId);
            }
            item.remove();
            refreshBookmarks(); // This will now show the linked icon
            updateTabList();
        }
        return;
    }
    const bookmarkId = item.dataset.bookmarkId;
    const newParentId = to.dataset.parentId;
    if (!bookmarkId || !newParentId) return;
    try {
        const destinationChildren = await api.getBookmarkChildren(newParentId);
        const safeIndex = Math.min(newIndex, destinationChildren.length);
        await api.moveBookmark(bookmarkId, {
            parentId: newParentId,
            index: safeIndex
        });
        refreshBookmarks();
    } catch (error) {
        console.error("Failed to move bookmark with safe index. Details:", {
            bookmarkId,
            newParentId,
            originalIndex: newIndex,
            safeIndex,
            error
        });
        refreshBookmarks();
    }
}

export { initialize, initializeTabSortable, initializeBookmarkSortable };