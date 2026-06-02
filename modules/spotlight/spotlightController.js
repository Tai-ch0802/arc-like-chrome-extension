/**
 * Spotlight controller — renders dataProvider results into the popup window,
 * keyboard navigation + Enter to execute. The window itself is the overlay,
 * so there is no open/close/backdrop logic here (Esc / blur close the window).
 */
import * as api from '../apiManager.js';
import { searchAll } from '../commandPalette/dataProvider.js';
import { debounce } from '../utils/functionUtils.js';

let inputEl, resultsEl;
/** @type {Array<{item: object, row: HTMLElement}>} */
let currentResults = [];
let activeIndex = 0;
/** Monotonic id so a late-arriving stale refresh() doesn't overwrite a newer one. */
let currentRequestId = 0;

export function initSpotlight() {
    inputEl = document.getElementById('spotlight-input');
    resultsEl = document.getElementById('spotlight-results');
    if (!inputEl || !resultsEl) return;

    inputEl.setAttribute('aria-label', api.getMessage('cmdPaletteAriaLabel') || 'Search');
    inputEl.addEventListener('input', debouncedRefresh);
    inputEl.addEventListener('keydown', handleInputKeydown);
    document.addEventListener('keydown', handleEscapeKeydown);

    inputEl.focus();
    refresh(); // 空白 → 引導預設
}

function handleEscapeKeydown(e) {
    if (e.key === 'Escape') { e.preventDefault(); window.close(); }
}

function handleInputKeydown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); moveActive(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveActive(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); executeActive(); }
}

const debouncedRefresh = debounce(() => refresh(), 100);

async function refresh() {
    const myId = ++currentRequestId;
    const query = inputEl.value;
    const groups = await searchAll(query);
    if (myId !== currentRequestId) return; // 丟棄過期結果
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
    row.id = `spotlight-row-${index}`;
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
    title.textContent = item.titleKey ? (api.getMessage(item.titleKey) || item.titleKey) : (item.title || '');
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
        const on = i === activeIndex;
        r.row.classList.toggle('active', on);
        r.row.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    const active = currentResults[activeIndex];
    if (active) {
        inputEl.setAttribute('aria-activedescendant', active.row.id);
        active.row.scrollIntoView({ block: 'nearest' });
    }
}

function moveActive(delta) { setActive(activeIndex + delta); }

async function executeActive() {
    const current = currentResults[activeIndex];
    if (!current) return;
    try {
        await current.item.handler();
    } catch (err) {
        console.error('Spotlight action failed:', err);
    } finally {
        window.close();
    }
}
