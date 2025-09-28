import * as ui from './uiManager.js';
import * as state from './stateManager.js';

function handleSearch() {
    const query = ui.searchBox.value.toLowerCase().trim();
    filterTabsAndGroups(query);
    filterBookmarks(query);
}

function filterTabsAndGroups(query) {
    const tabItems = document.querySelectorAll('#tab-list .tab-item');
    const groupHeaders = document.querySelectorAll('#tab-list .tab-group-header');
    tabItems.forEach(item => {
        const title = item.querySelector('.tab-title').textContent.toLowerCase();
        const matches = title.includes(query);
        item.classList.toggle('hidden', !matches);
    });
    groupHeaders.forEach(header => {
        const content = header.nextElementSibling;
        const visibleTabsInGroup = content.querySelectorAll('.tab-item:not(.hidden)');
        const titleElement = header.querySelector('.tab-group-title');
        const title = titleElement ? titleElement.textContent.toLowerCase() : '';
        const groupTitleMatches = title.includes(query);
        const hasVisibleChildren = visibleTabsInGroup.length > 0;
        header.classList.toggle('hidden', !hasVisibleChildren && !groupTitleMatches);
        if ((hasVisibleChildren || groupTitleMatches) && query) {
            content.style.display = 'block';
            header.querySelector('.tab-group-arrow').textContent = '▼';
        } else if (!query) {
            const isCollapsed = header.dataset.collapsed === 'true';
            content.style.display = isCollapsed ? 'none' : 'block';
            header.querySelector('.tab-group-arrow').textContent = isCollapsed ? '▶' : '▼';
        }
    });
}

function filterBookmarks(query) {
    const visibleBookmarkNodes = new Set();
    if (ui.bookmarkListContainer.children.length > 0) {
        const topLevelItems = ui.bookmarkListContainer.querySelectorAll(':scope > .bookmark-item, :scope > .bookmark-folder');
        for (const item of topLevelItems) {
            calculateBookmarkVisibility(item, query, visibleBookmarkNodes);
        }
    }
    applyBookmarkVisibility(query, visibleBookmarkNodes);
}

function calculateBookmarkVisibility(node, query, visibleItems) {
    const titleElement = node.querySelector('.bookmark-title');
    if (!titleElement) return false;
    const title = titleElement.textContent.toLowerCase();
    const selfMatches = query ? title.includes(query) : true;
    let hasVisibleChild = false;
    if (node.classList.contains('bookmark-folder')) {
        const content = node.nextElementSibling;
        if (content && content.classList.contains('folder-content')) {
            for (const child of content.children) {
                if (calculateBookmarkVisibility(child, query, visibleItems)) {
                    hasVisibleChild = true;
                }
            }
        }
    }
    const shouldBeVisible = selfMatches || hasVisibleChild;
    if (shouldBeVisible) {
        visibleItems.add(node);
    }
    return shouldBeVisible;
}

function applyBookmarkVisibility(query, visibleItems) {
    const allItems = ui.bookmarkListContainer.querySelectorAll('.bookmark-item, .bookmark-folder');
    allItems.forEach(node => {
        const isVisible = visibleItems.has(node);
        node.classList.toggle('hidden', !isVisible);
        if (node.classList.contains('bookmark-folder')) {
            const content = node.nextElementSibling;
            const icon = node.querySelector('.bookmark-icon');
            if (isVisible && query) {
                let shouldExpand = false;
                if (content) {
                     for(const child of content.children) {
                        if (visibleItems.has(child)) {
                            shouldExpand = true;
                            break;
                        }
                    }
                }
                if (shouldExpand) {
                    content.style.display = 'block';
                    icon.textContent = '▼';
                } else {
                    content.style.display = 'none';
                    icon.textContent = '▶';
                }
            } else {
                if (state.isFolderExpanded(node.dataset.bookmarkId)) {
                    content.style.display = 'block';
                    icon.textContent = '▼';
                } else {
                    content.style.display = 'none';
                    icon.textContent = '▶';
                }
            }
        }
    });
}

function initialize() {
    ui.searchBox.addEventListener('input', handleSearch);
}

export { initialize, handleSearch, filterTabsAndGroups, filterBookmarks };
