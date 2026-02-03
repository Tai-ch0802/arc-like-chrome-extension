// --- Reading List Renderer Module ---
// UI rendering for Reading List items

import * as api from '../apiManager.js';
import * as readingListManager from '../readingListManager.js';
import { CHECK_ICON_SVG, CLOCK_ICON_SVG } from '../icons.js';

/**
 * Event delegation state
 */
let listenersInitialized = false;
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
                await readingListManager.toggleReadStatus(url, !hasBeenRead);
                handleRefresh();
            } else if (action === 'delete') {
                await readingListManager.deleteEntry(url);
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

    // Keyboard support
    container.addEventListener('keydown', (e) => {
        const item = e.target.closest('.reading-list-item');
        if (!item) return;

        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            item.click();
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

    currentRefreshCallback = refreshCallback;
    containerElement.innerHTML = '';

    if (entries.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'reading-list-empty';
        emptyMsg.textContent = api.getMessage('searchNoResults') || 'No items';
        containerElement.appendChild(emptyMsg);
        return;
    }

    const fragment = document.createDocumentFragment();

    // Sort: unread first, then by creation time (newest first)
    const sortedEntries = [...entries].sort((a, b) => {
        if (a.hasBeenRead !== b.hasBeenRead) {
            return a.hasBeenRead ? 1 : -1;
        }
        return (b.creationTime || 0) - (a.creationTime || 0);
    });

    for (const entry of sortedEntries) {
        const item = createReadingListItem(entry);
        fragment.appendChild(item);
    }

    containerElement.appendChild(fragment);
}

/**
 * Creates a single reading list item element.
 * @param {Object} entry - The reading list entry
 * @returns {HTMLElement} The created DOM element
 */
function createReadingListItem(entry) {
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

    // Title
    const titleEl = document.createElement('span');
    titleEl.className = 'reading-list-title';
    titleEl.textContent = entry.title;
    contentWrapper.appendChild(titleEl);

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
