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
        group: 'shared-list',
        animation: 150,
        scroll: true,
        scrollSensitivity: 50,
        scrollSpeed: 15,
        onEnd: (evt) => handleBookmarkDrop(evt, refreshBookmarks, updateTabList),
        onAdd: (evt) => handleBookmarkDrop(evt, refreshBookmarks, updateTabList),
        onDragOver: function (evt) {
            clearTimeout(folderOpenTimer);
            const { related } = evt;
            const isCollapsedFolder = related.classList.contains('bookmark-folder') && related.querySelector('.bookmark-icon').textContent === '▶';
            if (isCollapsedFolder) {
                folderOpenTimer = setTimeout(() => {
                    related.click();
                }, 1000);
            }
        },
    };
    const sortableContainers = [ui.bookmarkListContainer, ...document.querySelectorAll('.folder-content')];
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
    const tabIdToMove = parseInt(item.dataset.tabId, 10);
    if (!tabIdToMove) return;
    if (to.classList.contains('tab-group-content')) {
        const header = to.previousElementSibling;
        const targetGroupId = parseInt(header.dataset.groupId, 10);
        await api.groupTabs([tabIdToMove], targetGroupId);
    } else if (to.id === 'tab-list') {
        await api.ungroupTabs(tabIdToMove);
    }
    await moveItem(item, newIndex, to);
}

async function moveItem(item, newIndex, container) {
    const allDraggables = Array.from(container.closest('#tab-list').querySelectorAll('.tab-item, .tab-group-header'));
    const droppedItemElement = allDraggables.find(el => el === item);
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
            const tabsInGroup = await api.getTabsInCurrentWindow({ groupId: targetGroupId });
            if (tabsInGroup.length > 0) {
                targetAbsoluteIndex = Math.min(...tabsInGroup.map(t => t.index));
            }
        }
    }
    if (item.classList.contains('tab-item')) {
        const tabIdToMove = parseInt(item.dataset.tabId, 10);
        api.moveTab(tabIdToMove, targetAbsoluteIndex);
    } else if (item.classList.contains('tab-group-header')) {
        const groupIdToMove = parseInt(item.dataset.groupId, 10);
        api.moveTabGroup(groupIdToMove, targetAbsoluteIndex);
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
