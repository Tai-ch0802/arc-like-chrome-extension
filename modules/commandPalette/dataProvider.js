/**
 * Aggregates searchable items for the Command Palette from four sources:
 * tabs (all windows), bookmarks, reading list, and built-in actions.
 *
 * Returned groups have a uniform shape so the renderer in index.js stays simple.
 * Empty groups are filtered out before returning.
 */
import * as state from '../stateManager.js';
import * as api from '../apiManager.js';
import * as readingListManager from '../readingListManager.js';
import * as wsManager from '../workspace/workspaceManager.js';
import { buildActions } from './actions.js';
import { requestPanelAction, openUrlInOrigin } from './panelBridge.js';

const MAX_RESULTS_PER_GROUP = 8;

/**
 * @typedef {Object} PaletteItem
 * @property {string} id
 * @property {'tab'|'bookmark'|'reading-list'|'action'} type
 * @property {string} [icon] - URL or short string (emoji)
 * @property {string} [title] - Already-resolved display text (for tabs/bookmarks/reading-list)
 * @property {string} [titleKey] - i18n key (for actions; resolved by the renderer)
 * @property {string} [subtitle]
 * @property {() => (any|Promise<any>)} handler
 */

/**
 * Search all sources for the given query.
 * Empty query returns top items from each source (capped per group).
 *
 * @param {string} query
 * @returns {Promise<Array<{type: string, titleKey: string, items: PaletteItem[]}>>}
 */
export async function searchAll(query) {
    const q = (query || '').trim().toLowerCase();

    const [tabs, readingList] = await Promise.all([
        getTabResults(q),
        getReadingListResults(q),
    ]);
    const bookmarks = getBookmarkResults(q);
    const actions = getActionResults(q);
    const workspaces = getWorkspaceResults(q);

    return [
        { type: 'action', titleKey: 'cmdPaletteGroupActions', items: actions },
        { type: 'workspace', titleKey: 'cmdPaletteGroupWorkspaces', items: workspaces },
        { type: 'tab', titleKey: 'cmdPaletteGroupTabs', items: tabs },
        { type: 'bookmark', titleKey: 'cmdPaletteGroupBookmarks', items: bookmarks },
        { type: 'reading-list', titleKey: 'cmdPaletteGroupReadingList', items: readingList },
    ].filter(g => g.items.length > 0);
}

function getWorkspaceResults(q) {
    const workspaces = wsManager.getAllWorkspaces();
    return scoreFilter(workspaces, q, w => w.name || '').map(w => ({
        id: 'workspace-' + w.id,
        type: 'workspace',
        icon: w.icon,
        title: w.name,
        subtitle: `${(w.tabSnapshot || []).length} tab(s)`,
        handler: () => requestPanelAction('switch-workspace', { workspaceId: w.id }),
    }));
}

async function getTabResults(q) {
    const tabs = await chrome.tabs.query({}).catch(() => []);
    return scoreFilter(tabs, q, t => (t.title || '') + ' ' + (t.url || ''))
        .map(t => ({
            id: 'tab-' + t.id,
            type: 'tab',
            icon: t.favIconUrl || 'language',
            title: t.title || '(untitled)',
            subtitle: t.url,
            handler: async () => {
                await chrome.tabs.update(t.id, { active: true });
                await chrome.windows.update(t.windowId, { focused: true });
            },
        }));
}

function getBookmarkResults(q) {
    const cache = state.getBookmarkCache() || [];
    const bookmarks = cache.filter(b => b.type === 'bookmark');
    return scoreFilter(bookmarks, q, b => (b.title || '') + ' ' + (b.url || ''))
        .map(b => ({
            id: 'bookmark-' + b.id,
            type: 'bookmark',
            icon: 'bookmark',
            title: b.title || '(untitled)',
            subtitle: b.url,
            handler: () => openUrlInOrigin(b.url),
        }));
}

async function getReadingListResults(q) {
    const entries = await readingListManager.getAllEntries().catch(() => []);
    return scoreFilter(entries, q, e => (e.title || '') + ' ' + (e.url || ''))
        .map(e => ({
            id: 'reading-' + e.url,
            type: 'reading-list',
            icon: 'menu_book',
            title: e.title || '(untitled)',
            subtitle: e.url,
            handler: () => openUrlInOrigin(e.url),
        }));
}

function getActionResults(q) {
    // Filter by per-action visibility predicate so disabled features don't leak
    // through the palette (the underlying button is just display:none, so a
    // bare .click() would still trigger the action without this guard).
    const actions = buildActions().filter(a => !a.isVisible || a.isVisible());
    if (!q) return actions; // show all visible actions when query is empty
    // Match against the resolved (localized) label so e.g. Chinese users
    // searching for "清理" can find "AI 分頁清理" — the i18n key alone
    // ('cmdPaletteActionAiCleanup') would never match.
    return scoreFilter(actions, q, a => api.getMessage(a.titleKey) || a.titleKey || '');
}

/**
 * Empty query passes through (returns input capped). Otherwise keeps items
 * whose haystack contains the query (case-insensitive) and sorts by match
 * position (earlier = better). Caps at MAX_RESULTS_PER_GROUP per source.
 */
function scoreFilter(items, q, getHaystack) {
    if (!q) return items.slice(0, MAX_RESULTS_PER_GROUP);
    const scored = [];
    for (const item of items) {
        const hay = (getHaystack(item) || '').toLowerCase();
        const idx = hay.indexOf(q);
        if (idx >= 0) scored.push({ item, score: idx });
    }
    scored.sort((a, b) => a.score - b.score);
    return scored.slice(0, MAX_RESULTS_PER_GROUP).map(s => s.item);
}
