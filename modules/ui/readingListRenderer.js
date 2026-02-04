// --- Reading List Renderer Module ---
// UI rendering for Reading List items

import * as api from '../apiManager.js';
import * as readingListManager from '../readingListManager.js';
import * as modalManager from '../modalManager.js';
import { CHECK_ICON_SVG, CLOCK_ICON_SVG } from '../icons.js';

/**
 * Event delegation state
 */
let listenersInitialized = false;
let toggleInitialized = false;
let listenerAbortController = null;
let container = null;
let currentRefreshCallback = null;

/**
 * Resets reading list listeners. Useful for re-initialization or cleanup.
 */
export function resetReadingListListeners() {
    if (listenerAbortController) {
        listenerAbortController.abort();
        listenerAbortController = null;
    }
    listenersInitialized = false;
    currentRefreshCallback = null;
    container = null;
}

/**
 * Initializes event listeners on the container using delegation.
 */
function initReadingListListeners(containerElement) {
    if (listenersInitialized) return;
    listenersInitialized = true;
    container = containerElement;
    listenerAbortController = new AbortController();
    const { signal } = listenerAbortController;

    const handleRefresh = () => {
        if (currentRefreshCallback) currentRefreshCallback();
    };

    // Handle header clear-all-read button (outside container)
    const headerClearBtn = document.getElementById('clear-all-read-btn');
    if (headerClearBtn) {
        headerClearBtn.addEventListener('click', async () => {
            const confirmed = await modalManager.showConfirm({
                title: api.getMessage('confirmClearAllRead') || 'Remove all read items?',
                confirmButtonText: api.getMessage('deleteButton') || 'Delete',
                confirmButtonClass: 'danger'
            });

            if (!confirmed) return;

            await readingListManager.deleteAllRead();
            handleRefresh();
        }, { signal });
    }

    container.addEventListener('click', async (e) => {
        const target = e.target;

        // Handle action buttons
        const btn = target.closest('button[data-action]');
        if (btn) {
            e.preventDefault();
            e.stopPropagation();
            const action = btn.dataset.action;
            const item = btn.closest('.reading-list-item');
            const url = item?.dataset.url;

            if (!url) return;

            if (action === 'toggle-read') {
                const hasBeenRead = item.dataset.hasBeenRead === 'true';
                const newReadState = !hasBeenRead;
                await readingListManager.toggleReadStatus(url, newReadState);

                // Optimized: Update DOM element directly instead of re-rendering
                item.dataset.hasBeenRead = newReadState.toString();
                item.classList.toggle('is-read', newReadState);

                // Update button aria-label and title
                const toggleBtn = item.querySelector('[data-action="toggle-read"]');
                if (toggleBtn) {
                    const label = newReadState
                        ? api.getMessage('markAsUnread')
                        : api.getMessage('markAsRead');
                    toggleBtn.setAttribute('aria-label', label);
                    toggleBtn.title = label;
                }
            } else if (action === 'delete') {
                // Show confirmation dialog before deleting
                const confirmed = await modalManager.showConfirm({
                    title: api.getMessage('confirmDeleteReadingListItem') || 'Delete this item?',
                    confirmButtonText: api.getMessage('deleteButton') || 'Delete',
                    confirmButtonClass: 'danger'
                });

                if (!confirmed) return;

                await readingListManager.deleteEntry(url);
                // Optimized: Only remove this DOM element instead of re-rendering entire list
                item.style.transition = 'opacity 0.15s ease-out';
                item.style.opacity = '0';
                setTimeout(() => {
                    item.remove();
                    // Show empty message if no items left
                    if (container && container.querySelectorAll('.reading-list-item').length === 0) {
                        const emptyMsg = document.createElement('div');
                        emptyMsg.className = 'reading-list-empty';
                        emptyMsg.textContent = api.getMessage('readingListEmptyGuidance') || 'Right-click a link to add it here';
                        container.appendChild(emptyMsg);
                    }
                }, 150);
            } else if (action === 'clear-all-read') {
                // Show confirmation dialog
                const confirmed = await modalManager.showConfirm({
                    title: api.getMessage('confirmClearAllRead') || 'Remove all read items?',
                    confirmButtonText: api.getMessage('deleteButton') || 'Delete',
                    confirmButtonClass: 'danger'
                });

                if (!confirmed) return;

                // Delete all read items
                await readingListManager.deleteAllRead();
                handleRefresh();
            }
            return;
        }

        // Handle item click (open in tab)
        const readingListItem = target.closest('.reading-list-item');
        if (readingListItem) {
            e.preventDefault();
            const url = readingListItem.dataset.url;
            const title = readingListItem.dataset.title;
            await readingListManager.openReadingListItem({ url, title });
            handleRefresh();
        }
    }, { signal });

    // Handle sort change
    const sortSelect = document.getElementById('reading-list-sort');
    if (sortSelect) {
        sortSelect.addEventListener('change', async (e) => {
            const sortOrder = e.target.value;
            await api.setStorage('sync', { readingListSortOrder: sortOrder });
            handleRefresh();
        }, { signal });
    }

    // Keyboard support
    container.addEventListener('keydown', async (e) => {
        const item = e.target.closest('.reading-list-item');
        if (!item) return;

        // Enter/Space: Open item
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            item.click();
            return;
        }

        // Arrow keys: Navigate between items
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const items = Array.from(container.querySelectorAll('.reading-list-item'));
            const currentIndex = items.indexOf(item);

            let nextIndex;
            if (e.key === 'ArrowDown') {
                nextIndex = currentIndex + 1;
                if (nextIndex >= items.length) nextIndex = 0; // Loop to start
            } else {
                nextIndex = currentIndex - 1;
                if (nextIndex < 0) nextIndex = items.length - 1; // Loop to end
            }

            if (items[nextIndex]) {
                items[nextIndex].focus();
            }
            return;
        }

        // Delete key: Trigger delete action
        if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            const deleteBtn = item.querySelector('[data-action="delete"]');
            if (deleteBtn) {
                deleteBtn.click();
            }
        }
    }, { signal });
}

/**
 * Renders reading list entries into a container.
 * @param {Array} entries - Reading list entries from chrome.readingList.query()
 * @param {HTMLElement} containerElement - The container to render into
 * @param {Function} refreshCallback - Callback to refresh the list after changes
 */
export function renderReadingList(entries, containerElement, refreshCallback) {
    if (!listenersInitialized && containerElement.id === 'reading-list') {
        initReadingListListeners(containerElement);
    }

    // Initialize toggle button (separate from list listeners)
    initToggleButton();

    currentRefreshCallback = refreshCallback;
    containerElement.innerHTML = '';

    if (entries.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'reading-list-empty';
        emptyMsg.textContent = api.getMessage('readingListEmptyGuidance') || 'Right-click any link to add it here';
        containerElement.appendChild(emptyMsg);
        // Hide header clear button when empty
        updateClearAllReadButton(false);
        return;
    }

    // Show/hide header clear button based on whether there are read items
    const hasReadItems = entries.some(e => e.hasBeenRead);
    updateClearAllReadButton(hasReadItems);

    const fragment = document.createDocumentFragment();

    // Sort based on preference
    api.getStorage('sync', { readingListSortOrder: 'date-newest' }).then(result => {
        const sortOrder = result.readingListSortOrder;

        // Update select value if it exists
        const sortSelect = document.getElementById('reading-list-sort');
        if (sortSelect && sortSelect.value !== sortOrder) {
            sortSelect.value = sortOrder;
        }

        const sortedEntries = [...entries].sort((a, b) => {
            // Always keep unread at top (unless we want a strictly different sort)
            if (a.hasBeenRead !== b.hasBeenRead) {
                return a.hasBeenRead ? 1 : -1;
            }

            if (sortOrder === 'title') {
                return a.title.localeCompare(b.title);
            } else if (sortOrder === 'date-oldest') {
                return (a.creationTime || 0) - (b.creationTime || 0);
            } else {
                // Default: date-newest
                return (b.creationTime || 0) - (a.creationTime || 0);
            }
        });

        const fragment = document.createDocumentFragment();
        // Calculate "new" threshold: items added within the last hour
        const newItemThreshold = Date.now() - (60 * 60 * 1000);

        for (const entry of sortedEntries) {
            const isNew = entry.creationTime && entry.creationTime > newItemThreshold && !entry.hasBeenRead;
            const item = createReadingListItem(entry, isNew);
            fragment.appendChild(item);
        }

        containerElement.appendChild(fragment);
    }).catch(err => {
        console.warn('Failed to load reading list sort preference:', err);
    });
}

/**
 * Updates the visibility of the clear all read button in the section header.
 * @param {boolean} show - Whether to show the button
 */
function updateClearAllReadButton(show) {
    const btn = document.getElementById('clear-all-read-btn');
    if (btn) {
        btn.classList.toggle('hidden', !show);
    }
}

/**
 * Initializes the toggle button for collapsing/expanding the reading list.
 * Has its own flag to ensure single initialization.
 */
function initToggleButton() {
    if (toggleInitialized) return;

    const toggleBtn = document.getElementById('reading-list-toggle');
    if (!toggleBtn) return;

    toggleInitialized = true;

    // Initialize state from storage
    api.getStorage('sync', ['readingListCollapsed']).then(result => {
        const isCollapsed = result.readingListCollapsed === true;
        setCollapsedState(isCollapsed);
    }).catch(err => {
        console.warn('Failed to load reading list collapsed state:', err);
    });

    toggleBtn.addEventListener('click', () => {
        const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
        const newCollapsedState = isExpanded; // If expanded, we're collapsing
        setCollapsedState(newCollapsedState);
        api.setStorage('sync', { readingListCollapsed: newCollapsedState });
    });
}

/**
 * Sets the collapsed state of the reading list section.
 * @param {boolean} collapsed - Whether to collapse the section
 */
function setCollapsedState(collapsed) {
    const toggleBtn = document.getElementById('reading-list-toggle');
    const content = document.getElementById('reading-list');

    if (toggleBtn) {
        toggleBtn.setAttribute('aria-expanded', (!collapsed).toString());
    }
    if (content) {
        content.classList.toggle('collapsed', collapsed);
    }
}

/**
 * Creates a single reading list item element.
 * @param {Object} entry - The reading list entry
 * @param {boolean} isNew - Whether this is a newly added item
 * @returns {HTMLElement} The created DOM element
     */
function createReadingListItem(entry, isNew = false) {
    const item = document.createElement('div');
    item.className = 'reading-list-item';
    if (entry.hasBeenRead) {
        item.classList.add('is-read');
    }
    item.tabIndex = 0;
    item.setAttribute('role', 'button');
    item.dataset.url = entry.url;
    item.dataset.title = entry.title;
    item.dataset.hasBeenRead = entry.hasBeenRead.toString();
    item.title = `${entry.title}\n${entry.url}`;

    // Favicon
    const favicon = document.createElement('img');
    favicon.className = 'reading-list-favicon';
    favicon.alt = '';
    try {
        const domain = new URL(entry.url).hostname;
        favicon.src = `https://www.google.com/s2/favicons?sz=16&domain_url=${domain}`;
    } catch {
        favicon.src = 'icons/fallback-favicon.svg';
    }
    favicon.onerror = () => { favicon.src = 'icons/fallback-favicon.svg'; };

    // Content wrapper
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'reading-list-content';

    // Title row (badge + title on same line)
    const titleRow = document.createElement('div');
    titleRow.className = 'reading-list-title-row';

    // NEW badge for recently added items
    if (isNew) {
        const newBadge = document.createElement('span');
        newBadge.className = 'reading-list-new-badge';
        newBadge.textContent = api.getMessage('newItemBadge') || 'NEW';
        titleRow.appendChild(newBadge);
    }

    // Title
    const titleEl = document.createElement('span');
    titleEl.className = 'reading-list-title';
    titleEl.textContent = entry.title;
    titleRow.appendChild(titleEl);

    contentWrapper.appendChild(titleRow);

    // "Viewed X days ago" label for old read items
    if (readingListManager.shouldShowViewedLabel(entry)) {
        const daysAgo = readingListManager.getDaysSinceViewed(entry.lastUpdateTime);
        const labelEl = document.createElement('span');
        labelEl.className = 'reading-list-viewed-label';
        labelEl.innerHTML = `${CLOCK_ICON_SVG} ${api.getMessage('viewedDaysAgo', daysAgo.toString())}`;
        contentWrapper.appendChild(labelEl);
    }

    // Actions
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'reading-list-actions';

    // Toggle read button
    const toggleReadBtn = document.createElement('button');
    toggleReadBtn.className = 'reading-list-toggle-read';
    toggleReadBtn.innerHTML = CHECK_ICON_SVG;
    toggleReadBtn.dataset.action = 'toggle-read';
    toggleReadBtn.tabIndex = -1;
    toggleReadBtn.setAttribute('aria-label', entry.hasBeenRead
        ? api.getMessage('markAsUnread')
        : api.getMessage('markAsRead'));
    toggleReadBtn.title = entry.hasBeenRead
        ? api.getMessage('markAsUnread')
        : api.getMessage('markAsRead');

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'reading-list-delete';
    deleteBtn.textContent = '×';
    deleteBtn.dataset.action = 'delete';
    deleteBtn.tabIndex = -1;
    deleteBtn.setAttribute('aria-label', api.getMessage('deleteReadingListItem'));
    deleteBtn.title = api.getMessage('deleteReadingListItem');

    actionsContainer.appendChild(toggleReadBtn);
    actionsContainer.appendChild(deleteBtn);

    // Assemble
    item.appendChild(favicon);
    item.appendChild(contentWrapper);
    item.appendChild(actionsContainer);

    return item;
}
