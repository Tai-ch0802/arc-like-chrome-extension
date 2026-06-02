/**
 * Event delegation for the tab list container.
 * Owns the AbortController + initialized flag so it can be reset for tests
 * or container replacement.
 *
 * Pure module: receives all dependencies (caches, callbacks, chrome wrappers)
 * via the deps object so it can be unit-tested in isolation if needed.
 */
import * as api from '../../apiManager.js';
import { showContextMenu } from '../contextMenuManager.js';

let listenersInitialized = false;
let listenerAbortController = null;

/**
 * @param {HTMLElement} container - The tab list container element.
 * @param {{
 *   getTabsCache: () => Map<number, chrome.tabs.Tab>,
 *   getAddToGroupCallback: () => ((tabId: number) => void) | null,
 * }} deps
 */
export function initTabListeners(container, deps) {
    if (listenersInitialized) return;
    listenersInitialized = true;

    let lastInputWasKeyboard = true;

    listenerAbortController = new AbortController();
    const { signal } = listenerAbortController;

    const getTabFromElement = (element) => {
        const tabItem = element.closest('.tab-item');
        if (!tabItem) return null;
        const tabId = parseInt(tabItem.dataset.tabId);
        return deps.getTabsCache().get(tabId);
    };

    const getGroupData = (element) => {
        const header = element.closest('.tab-group-header');
        if (!header) return null;
        return {
            id: parseInt(header.dataset.groupId),
            collapsed: header.dataset.collapsed === 'true',
            element: header
        };
    };

    container.addEventListener('click', async (e) => {
        const button = e.target.closest('button');
        if (button) {
            e.stopPropagation();
            const action = button.dataset.action;
            const tab = getTabFromElement(button);
            if (!tab) return;

            if (action === 'close') {
                api.removeTab(tab.id);
            } else if (action === 'add-to-group') {
                const cb = deps.getAddToGroupCallback();
                if (cb) cb(tab.id);
            } else if (action === 'add-to-bookmark') {
                const modal = await import('../../modalManager.js');
                const result = await modal.showAddToBookmarkDialog({
                    name: tab.title,
                    url: tab.url
                });
                if (result) {
                    await api.createBookmark(result);
                }
            }
            return;
        }

        const groupData = getGroupData(e.target);
        if (groupData) {
            const header = groupData.element;
            const content = header.nextElementSibling;
            const arrow = header.querySelector('.tab-group-arrow');

            const newCollapsedState = !groupData.collapsed;
            content.style.display = newCollapsedState ? 'none' : 'block';
            if (arrow) arrow.classList.toggle('is-collapsed', newCollapsedState);
            header.setAttribute('aria-expanded', (!newCollapsedState).toString());
            header.dataset.collapsed = newCollapsedState ? 'true' : 'false';

            api.updateTabGroup(groupData.id, { collapsed: newCollapsedState });
            return;
        }

        const tab = getTabFromElement(e.target);
        if (tab) {
            api.updateTab(tab.id, { active: true });
            api.updateWindow(tab.windowId, { focused: true });
        }
    }, { signal });

    container.addEventListener('mousedown', () => {
        lastInputWasKeyboard = false;
    }, { signal });

    container.addEventListener('keydown', (e) => {
        lastInputWasKeyboard = true;
        const tabItem = e.target.closest('.tab-item');
        const groupHeader = e.target.closest('.tab-group-header');

        if (tabItem) {
            if (e.target.tagName === 'BUTTON') return;

            const tab = getTabFromElement(tabItem);
            if (!tab) return;

            if (e.key === 'Enter') {
                e.preventDefault();
                api.updateTab(tab.id, { active: true });
                api.updateWindow(tab.windowId, { focused: true });
            } else if (e.key === 'Delete') {
                e.preventDefault();
                e.stopPropagation();
                api.removeTab(tab.id);
            } else if (e.key === ' ') {
                e.preventDefault();
                const existingMenu = document.querySelector('.custom-context-menu');
                if (existingMenu) {
                    existingMenu.remove();
                } else {
                    const rect = tabItem.getBoundingClientRect();
                    showContextMenu(rect.left + 20, rect.bottom, tab, tabItem);
                }
            }
        } else if (groupHeader) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                groupHeader.click();
            }
        }
    }, { signal });

    container.addEventListener('contextmenu', (e) => {
        const tab = getTabFromElement(e.target);
        const tabItem = e.target.closest('.tab-item');
        if (tab && tabItem) {
            e.preventDefault();
            showContextMenu(e.clientX, e.clientY, tab, tabItem);
        }
    }, { signal });

    // Auto-scroll on focusin only for keyboard navigation. Mouse-click focus
    // would otherwise jump the scroll after DOM reconciliation post-onActivated.
    container.addEventListener('focusin', (e) => {
        if (!lastInputWasKeyboard) return;
        const tabItem = e.target.closest('.tab-item');
        if (tabItem) {
            setTimeout(() => {
                tabItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }, 0);
        }
    }, { signal });
}

/**
 * Aborts all listeners and resets the initialized flag.
 * Caches owned by the caller (tabRenderer.js) must be reset separately.
 */
export function resetTabListeners() {
    if (listenerAbortController) {
        listenerAbortController.abort();
        listenerAbortController = null;
    }
    listenersInitialized = false;
}
