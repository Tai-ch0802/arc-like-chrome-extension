/**
 * Context Menu Manager Module
 * Handles creation and management of custom context menus for tabs.
 */
import * as api from '../apiManager.js';
import { COPY_ICON_SVG } from '../icons.js';

/**
 * Shows a custom context menu for a tab element.
 * @param {number} x - X coordinate for menu position
 * @param {number} y - Y coordinate for menu position
 * @param {Object} tab - Tab object containing at least { id, url }
 * @param {HTMLElement} originElement - The element that triggered the context menu (for focus restoration)
 */
export function showContextMenu(x, y, tab, originElement) {
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

    // Copy URL Option
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
                menu.remove();
            }, 800);
        } catch (err) {
            console.error('Failed to copy: ', err);
            menu.remove();
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
 * @param {Object} tab - Tab object containing at least { id, url }
 */
export function bindContextMenu(element, tab) {
    element.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showContextMenu(e.clientX, e.clientY, tab, element);
    });
}
