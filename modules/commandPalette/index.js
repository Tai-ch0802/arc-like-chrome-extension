/**
 * Command Palette — Cmd+K / Ctrl+K overlay for keyboard-driven access to
 * tabs, bookmarks, reading list, and built-in actions.
 *
 * Self-contained: owns the overlay DOM, its keyboard navigation, and the
 * Cmd+K global listener inside the sidepanel context. We intentionally do
 * NOT register Ctrl+K via manifest commands because Chrome already maps
 * Ctrl+K to the address bar's search-engine switcher; the listener is
 * sidepanel-scoped so it only fires when the sidepanel has focus.
 */
import * as api from '../apiManager.js';
import { searchAll } from './dataProvider.js';
import { debounce } from '../utils/functionUtils.js';

let overlayEl, inputEl, resultsEl;
/** @type {Array<{item: object, row: HTMLElement}>} */
let currentResults = [];
let activeIndex = 0;
let isOpen = false;
/** Element to restore focus to when the palette closes. */
let lastFocusedElement = null;
/** Monotonic id so a late-arriving stale refresh() doesn't overwrite a newer one. */
let currentRequestId = 0;

export function initCommandPalette() {
    overlayEl = document.getElementById('command-palette-overlay');
    inputEl = document.getElementById('command-palette-input');
    resultsEl = document.getElementById('command-palette-results');
    if (!overlayEl || !inputEl || !resultsEl) return;

    // Resolve placeholder and aria-label from i18n on init (data-i18n on
    // input attributes isn't supported by the project's global resolver).
    inputEl.placeholder = api.getMessage('cmdPalettePlaceholder') || 'Search tabs, bookmarks, actions...';
    inputEl.setAttribute('aria-label', api.getMessage('cmdPaletteAriaLabel') || 'Command palette');

    document.addEventListener('keydown', handleGlobalKeydown);
    overlayEl.addEventListener('click', (e) => {
        // Backdrop click closes; clicks inside the modal don't.
        if (e.target === overlayEl) close();
    });
    inputEl.addEventListener('input', debouncedRefresh);
    inputEl.addEventListener('keydown', handleInputKeydown);
}

function handleGlobalKeydown(e) {
    // Cmd+K on Mac, Ctrl+K elsewhere.
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        toggle();
    } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        close();
    }
}

function handleInputKeydown(e) {
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        moveActive(1);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        moveActive(-1);
    } else if (e.key === 'Enter') {
        e.preventDefault();
        executeActive();
    }
}

function toggle() {
    if (isOpen) close(); else open();
}

export function open() {
    isOpen = true;
    lastFocusedElement = document.activeElement;
    overlayEl.hidden = false;
    inputEl.value = '';
    inputEl.focus();
    refresh();
}

export function close() {
    isOpen = false;
    overlayEl.hidden = true;
    inputEl.value = '';
    inputEl.removeAttribute('aria-activedescendant');
    resultsEl.innerHTML = '';
    currentResults = [];
    activeIndex = 0;
    // Restore focus to the element that had it before the palette opened.
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
        try { lastFocusedElement.focus(); } catch { /* ignore */ }
    }
    lastFocusedElement = null;
}

const debouncedRefresh = debounce(() => refresh(), 100);

async function refresh() {
    const myId = ++currentRequestId;
    const query = inputEl.value;
    const groups = await searchAll(query);
    // Discard stale results — a newer query has already started.
    if (myId !== currentRequestId) return;
    renderGroups(groups);
}

function renderGroups(groups) {
    resultsEl.innerHTML = '';
    currentResults = [];
    activeIndex = 0;

    if (groups.length === 0) {
        inputEl.removeAttribute('aria-activedescendant');
        const empty = document.createElement('div');
        empty.className = 'cmd-palette-empty';
        empty.textContent = api.getMessage('cmdPaletteEmpty') || 'No results';
        resultsEl.appendChild(empty);
        return;
    }

    const frag = document.createDocumentFragment();
    for (const group of groups) {
        const header = document.createElement('div');
        header.className = 'cmd-palette-group-header';
        header.textContent = api.getMessage(group.titleKey) || group.titleKey;
        frag.appendChild(header);

        for (const item of group.items) {
            const row = buildRow(item, currentResults.length);
            currentResults.push({ item, row });
            frag.appendChild(row);
        }
    }
    resultsEl.appendChild(frag);
    setActive(0);
}

function buildRow(item, index) {
    const row = document.createElement('div');
    row.className = 'cmd-palette-row';
    row.dataset.index = String(index);
    row.id = `cmd-palette-row-${index}`;
    row.setAttribute('role', 'option');
    row.setAttribute('aria-selected', 'false');

    const icon = document.createElement('span');
    icon.className = 'cmd-palette-icon';
    const isUrlIcon = typeof item.icon === 'string'
        && (item.icon.startsWith('http://') || item.icon.startsWith('https://') || item.icon.startsWith('chrome://'));
    if (isUrlIcon) {
        const img = document.createElement('img');
        img.src = item.icon;
        img.alt = '';
        img.onerror = () => { img.replaceWith(document.createTextNode('🌐')); };
        icon.appendChild(img);
    } else {
        icon.textContent = item.icon || '•';
    }

    const meta = document.createElement('div');
    meta.className = 'cmd-palette-meta';

    const title = document.createElement('div');
    title.className = 'cmd-palette-title';
    title.textContent = item.titleKey
        ? (api.getMessage(item.titleKey) || item.titleKey)
        : (item.title || '');

    meta.appendChild(title);
    if (item.subtitle) {
        const subtitle = document.createElement('div');
        subtitle.className = 'cmd-palette-subtitle';
        subtitle.textContent = item.subtitle;
        meta.appendChild(subtitle);
    }

    row.appendChild(icon);
    row.appendChild(meta);

    row.addEventListener('click', () => {
        activeIndex = parseInt(row.dataset.index, 10) || 0;
        executeActive();
    });

    return row;
}

function setActive(index) {
    if (currentResults.length === 0) return;
    activeIndex = Math.max(0, Math.min(currentResults.length - 1, index));
    currentResults.forEach((r, i) => {
        const isActive = i === activeIndex;
        r.row.classList.toggle('active', isActive);
        r.row.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    const active = currentResults[activeIndex];
    if (active) {
        // Point screen readers to the active row even though focus stays in input.
        inputEl.setAttribute('aria-activedescendant', active.row.id);
        active.row.scrollIntoView({ block: 'nearest' });
    }
}

function moveActive(delta) {
    setActive(activeIndex + delta);
}

async function executeActive() {
    const current = currentResults[activeIndex];
    if (!current) return;
    close();
    try {
        await current.item.handler();
    } catch (err) {
        console.error('Command Palette action failed:', err);
    }
}
