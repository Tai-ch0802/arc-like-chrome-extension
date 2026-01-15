/**
 * keyboardManager.js
 * Manages keyboard navigation for the extension's side panel.
 * Implements "Roving focus" style navigation where Up/Down moves between items,
 * and Left/Right moves between actions within an item.
 */

import { tabListContainer, bookmarkListContainer, otherWindowsList, searchBox } from './ui/elements.js';

export function initialize() {
    // Add global keydown listener to the document for delegation
    document.addEventListener('keydown', handleKeyDown);
}

function handleKeyDown(e) {
    if (e.defaultPrevented) {
        return;
    }

    // Only handle arrow keys
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        return;
    }

    const { target } = e;

    // If focus is on body/html (meaning nothing specific is focused),
    // redirect focus to the active tab item first, then let the keypress work
    if (target === document.body || target === document.documentElement) {
        const activeTab = document.querySelector('.tab-item.active');
        if (activeTab) {
            e.preventDefault();
            activeTab.focus();
            return;
        }
    }

    // Check if we are inside a list container we manage
    if (!tabListContainer.contains(target) &&
        !bookmarkListContainer.contains(target) &&
        !otherWindowsList.contains(target)) {

        // Special handling for search box:
        // ArrowDown should move focus to the first visible item
        if (target === searchBox && e.key === 'ArrowDown') {
            const allRows = getAllVisibleRowItems();
            if (allRows.length > 0) {
                e.preventDefault();
                allRows[0].focus();
            }
            return;
        }

        // For other keys in search box or other unmanaged areas, do nothing
        return;
    }

    const isTabItem = target.classList.contains('tab-item');
    const isTabGroupHeader = target.classList.contains('tab-group-header');
    const isBookmarkItem = target.classList.contains('bookmark-item') || target.classList.contains('bookmark-folder');
    const isWindowFolder = target.classList.contains('window-folder');
    const isActionButton = target.tagName === 'BUTTON' || target.classList.contains('bookmark-edit-btn') || target.classList.contains('bookmark-close-btn');

    // Find the main container item (the row)
    let rowItem = target;
    if (isActionButton) {
        rowItem = target.closest('.tab-item, .bookmark-item, .bookmark-folder, .window-folder, .tab-group-header');
    }

    if (!rowItem) return; // Should not happen if contains check passed, but safety first

    e.preventDefault(); // Consume the event if we are handling it

    switch (e.key) {
        case 'ArrowRight':
            handleArrowRight(target, rowItem);
            break;
        case 'ArrowLeft':
            handleArrowLeft(target, rowItem);
            break;
        case 'ArrowUp':
            handleArrowUp(rowItem);
            break;
        case 'ArrowDown':
            handleArrowDown(rowItem);
            break;
    }
}

function getFocusableButtons(rowItem) {
    // Select all button elements or specific classes acting as buttons
    // Note: CSS classes for buttons vary between tabs and bookmarks
    return Array.from(rowItem.querySelectorAll('button, .bookmark-edit-btn, .bookmark-close-btn, .add-to-bookmark-btn, .close-btn, .add-to-group-btn'));
}

function handleArrowRight(target, rowItem) {
    // If on the row item itself, move to the first button
    if (target === rowItem) {
        const buttons = getFocusableButtons(rowItem);
        if (buttons.length > 0) {
            buttons[0].focus();
        }
    }
    // If on a button, move to the next button
    else {
        const buttons = getFocusableButtons(rowItem);
        const currentIndex = buttons.indexOf(target);
        if (currentIndex !== -1 && currentIndex < buttons.length - 1) {
            buttons[currentIndex + 1].focus();
        }
    }
}

function handleArrowLeft(target, rowItem) {
    // If on a button, move to previous button or back to row item
    if (target !== rowItem) {
        const buttons = getFocusableButtons(rowItem);
        const currentIndex = buttons.indexOf(target);

        if (currentIndex > 0) {
            buttons[currentIndex - 1].focus();
        } else {
            // If on first button, go back to row item
            rowItem.focus();
        }
    }
}

function getAllVisibleRowItems() {
    // Select all relevant row items that are NOT hidden (e.g. collapsed groups)
    // We query the whole document for simplicity because items are scattered across containers
    // but strict ordering is determined by DOM order.

    // Selectors for all navigable rows
    const selectors = [
        '.tab-item',
        '.tab-group-header',
        '.bookmark-item',
        '.bookmark-folder',
        '.window-folder'
    ];

    // Get all potential items
    const allItems = Array.from(document.querySelectorAll(selectors.join(', ')));

    // Filter out hidden items (parents with display: none)
    return allItems.filter(item => {
        // Check if any parent up to body is hidden
        let el = item;
        while (el && el !== document.body) {
            const style = window.getComputedStyle(el);
            if (style.display === 'none') return false;
            el = el.parentElement;
        }
        return true;
    });
}

function handleArrowUp(currentRow) {
    const allRows = getAllVisibleRowItems();
    const currentIndex = allRows.indexOf(currentRow);

    if (currentIndex > 0) {
        allRows[currentIndex - 1].focus();
    } else if (currentIndex === 0) {
        // If at the top of the list, move focus to search box
        searchBox.focus();
    }
}

function handleArrowDown(currentRow) {
    const allRows = getAllVisibleRowItems();
    const currentIndex = allRows.indexOf(currentRow);

    if (currentIndex < allRows.length - 1) {
        allRows[currentIndex + 1].focus();
    }
}
