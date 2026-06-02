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
import { requestPanelAction, resolveTargetWindowId } from './panelBridge.js';

/**
 * @returns {Array<{id: string, type: 'action', icon: string, titleKey: string, handler: () => any, isVisible?: () => boolean}>}
 */
export function buildActions() {
    return [
        {
            id: 'action-smart-group',
            type: 'action',
            icon: 'auto_awesome',
            titleKey: 'cmdPaletteActionSmartGroup',
            isVisible: () => state.isAiGroupingVisible(),
            handler: () => requestPanelAction('smart-group'),
        },
        {
            id: 'action-ai-cleanup',
            type: 'action',
            icon: 'cleaning_services',
            titleKey: 'cmdPaletteActionAiCleanup',
            isVisible: () => state.isAiCleanupVisible(),
            handler: () => requestPanelAction('ai-cleanup'),
        },
        {
            id: 'action-new-tab-right',
            type: 'action',
            icon: 'add',
            titleKey: 'cmdPaletteActionNewTabRight',
            handler: async () => {
                const winId = await resolveTargetWindowId();
                if (typeof winId !== 'number') return;
                const [active] = await chrome.tabs.query({ active: true, windowId: winId });
                if (!active) return;
                const newTab = await chrome.tabs.create({ windowId: winId, index: active.index + 1, active: true });
                if (active.groupId > 0) await chrome.tabs.group({ groupId: active.groupId, tabIds: newTab.id });
            },
        },
        {
            id: 'action-refresh-bookmarks',
            type: 'action',
            icon: 'refresh',
            titleKey: 'cmdPaletteActionRefreshBookmarks',
            handler: () => requestPanelAction('refresh-bookmarks'),
        },
        {
            id: 'action-open-settings',
            type: 'action',
            icon: 'settings',
            titleKey: 'cmdPaletteActionSettings',
            handler: () => chrome.runtime.openOptionsPage(),
        },
        {
            id: 'action-create-workspace',
            type: 'action',
            icon: 'work',
            titleKey: 'cmdPaletteActionCreateWorkspace',
            handler: () => requestPanelAction('create-workspace'),
        },
        {
            id: 'action-manage-workspaces',
            type: 'action',
            icon: 'inventory_2',
            titleKey: 'cmdPaletteActionManageWorkspaces',
            handler: () => requestPanelAction('manage-workspaces'),
        },
        {
            id: 'action-bookmark-tools',
            type: 'action',
            icon: 'build',
            titleKey: 'cmdPaletteActionBookmarkTools',
            handler: () => requestPanelAction('bookmark-tools'),
        },
        {
            id: 'action-ask-ai-search',
            type: 'action',
            icon: 'smart_toy',
            titleKey: 'cmdPaletteActionAskAi',
            handler: () => requestPanelAction('ask-ai-search'),
        },
    ];
}
