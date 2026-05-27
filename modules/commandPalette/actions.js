/**
 * Built-in action registry for the Command Palette.
 *
 * Each action exposes an i18n key for its label, an icon, a handler, and an
 * optional `isVisible()` predicate. Promote actions here only when they are
 * high-value entry points — don't mirror every UI button.
 *
 * isVisible() lets the palette hide actions whose underlying feature the user
 * has disabled in settings (otherwise the palette would silently bypass the
 * setting by clicking the hidden button).
 */
import * as state from '../stateManager.js';

/**
 * @returns {Array<{id: string, type: 'action', icon: string, titleKey: string, handler: () => any, isVisible?: () => boolean}>}
 */
export function buildActions() {
    return [
        {
            id: 'action-smart-group',
            type: 'action',
            icon: '✨',
            titleKey: 'cmdPaletteActionSmartGroup',
            isVisible: () => state.isAiGroupingVisible(),
            handler: () => document.getElementById('ai-group-btn')?.click(),
        },
        {
            id: 'action-ai-cleanup',
            type: 'action',
            icon: '🧹',
            titleKey: 'cmdPaletteActionAiCleanup',
            isVisible: () => state.isAiCleanupVisible(),
            handler: () => document.getElementById('ai-cleanup-btn')?.click(),
        },
        {
            id: 'action-new-tab-right',
            type: 'action',
            icon: '➕',
            titleKey: 'cmdPaletteActionNewTabRight',
            handler: async () => {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!tab) return;
                const newTab = await chrome.tabs.create({ index: tab.index + 1, active: true });
                if (tab.groupId > 0) {
                    await chrome.tabs.group({ groupId: tab.groupId, tabIds: newTab.id });
                }
            },
        },
        {
            id: 'action-refresh-bookmarks',
            type: 'action',
            icon: '🔄',
            titleKey: 'cmdPaletteActionRefreshBookmarks',
            handler: () => document.dispatchEvent(new CustomEvent('refreshBookmarksRequired')),
        },
        {
            id: 'action-open-settings',
            type: 'action',
            icon: '⚙️',
            titleKey: 'cmdPaletteActionSettings',
            handler: () => document.getElementById('settings-toggle')?.click(),
        },
    ];
}
