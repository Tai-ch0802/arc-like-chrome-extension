/**
 * Context Menu Manager Module
 * Handles creation and management of custom context menus for tabs.
 */
import * as api from '../apiManager.js';
import { COPY_ICON_SVG, READING_LIST_ICON_SVG } from '../icons.js';
import { addToReadingList, isUrlInReadingList } from '../readingListManager.js';

/**
 * Shows a custom context menu for a tab element.
 * @param {number} x - X coordinate for menu position
 * @param {number} y - Y coordinate for menu position
 * @param {Object} tab - Tab object containing at least { id, url, title }
 * @param {HTMLElement} originElement - The element that triggered the context menu (for focus restoration)
 */
export async function showContextMenu(x, y, tab, originElement) {
    // Remove existing context menus
    const existingMenu = document.querySelector('.custom-context-menu');
    if (existingMenu) {
        existingMenu.remove();
    }

    const menu = document.createElement('div');
    menu.className = 'custom-context-menu';
    menu.setAttribute('role', 'menu');
    menu.tabIndex = -1;

    // Adjust if close to right edge
    if (x + 150 > window.innerWidth) {
        x = window.innerWidth - 160;
    }

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    // --- Copy URL Option ---
    const copyOption = document.createElement('div');
    copyOption.className = 'context-menu-item';
    copyOption.setAttribute('role', 'menuitem');
    copyOption.tabIndex = 0;
    copyOption.innerHTML = `
        ${COPY_ICON_SVG}
        <span>${api.getMessage('copyUrl')}</span>
    `;

    const triggerCopy = async () => {
        try {
            await navigator.clipboard.writeText(tab.url);

            // Show feedback
            copyOption.querySelector('span').textContent = api.getMessage('urlCopied');
            copyOption.style.color = 'var(--accent-color)';

            setTimeout(() => {
                closeMenu();
            }, 800);
        } catch (err) {
            console.error('Failed to copy: ', err);
            closeMenu();
        }
    };

    copyOption.addEventListener('click', async (e) => {
        e.stopPropagation();
        await triggerCopy();
    });

    copyOption.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            await triggerCopy();
        } else if (e.key === 'Escape' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            closeMenu();
        }
    });

    menu.appendChild(copyOption);

    // --- Add to Reading List Option ---
    const readingListOption = document.createElement('div');
    readingListOption.className = 'context-menu-item';
    readingListOption.setAttribute('role', 'menuitem');
    readingListOption.tabIndex = 0;

    // Check if Reading List API is available and URL is valid (not chrome:// pages)
    const isValidUrl = tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://');
    const isReadingListAvailable = typeof chrome.readingList !== 'undefined';

    if (isReadingListAvailable && isValidUrl) {
        // Check if URL already exists in reading list
        const alreadyExists = await isUrlInReadingList(tab.url);

        if (alreadyExists) {
            readingListOption.classList.add('disabled');
            readingListOption.setAttribute('aria-disabled', 'true');
            readingListOption.innerHTML = `
                ${READING_LIST_ICON_SVG}
                <span>${api.getMessage('alreadyInReadingList')}</span>
            `;
        } else {
            readingListOption.innerHTML = `
                ${READING_LIST_ICON_SVG}
                <span>${api.getMessage('addToReadingList')}</span>
            `;

            const triggerAddToReadingList = async () => {
                try {
                    await addToReadingList(tab.url, tab.title || tab.url);

                    // Show feedback with fade-in animation
                    readingListOption.classList.add('success');
                    readingListOption.querySelector('span').textContent = api.getMessage('alreadyInReadingList');

                    setTimeout(() => {
                        closeMenu();
                    }, 1000);
                } catch (err) {
                    console.error('Failed to add to reading list: ', err);
                    closeMenu();
                }
            };

            readingListOption.addEventListener('click', async (e) => {
                e.stopPropagation();
                await triggerAddToReadingList();
            });

            readingListOption.addEventListener('keydown', async (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    await triggerAddToReadingList();
                } else if (e.key === 'Escape' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    closeMenu();
                }
            });
        }

        menu.appendChild(readingListOption);
    }

    document.body.appendChild(menu);

    // Focus the first item
    copyOption.focus();

    // Close menu and restore focus
    function closeMenu() {
        menu.remove();
        document.removeEventListener('click', closeMenu);
        document.removeEventListener('contextmenu', handleContextMenuClose);
        // Restore focus to the original element
        if (originElement) {
            originElement.focus();
        }
    }

    function handleContextMenuClose(e) {
        if (!menu.contains(e.target)) {
            closeMenu();
        }
    }

    // Use setTimeout to avoid immediate trigger
    setTimeout(() => {
        document.addEventListener('click', closeMenu);
        document.addEventListener('contextmenu', handleContextMenuClose);
    }, 0);
}

/**
 * Binds a context menu to an element.
 * @param {HTMLElement} element - The element to bind the context menu to
 * @param {Object} tab - Tab object containing at least { id, url, title }
 */
export function bindContextMenu(element, tab) {
    element.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showContextMenu(e.clientX, e.clientY, tab, element);
    });
}
