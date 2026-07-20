/**
 * Settings propagation bridge.
 *
 * The options page (separate context) only writes to chrome.storage. The
 * sidepanel reacts to storage.onChanged. resolveSettingChangeActions maps a
 * change set to a list of UI actions; applySettingChanges executes them.
 */
import { applyTheme, applyDensity } from './settingManager.js';
import * as customTheme from './customThemeManager.js';
import * as bgImage from './backgroundImageManager.js';
import * as state from '../stateManager.js';

/**
 * Pure: map a storage change set to UI actions. No side effects.
 * @param {Object} changes chrome.storage.onChanged changes object
 * @param {string} areaName 'sync' | 'local'
 * @returns {Array<object>}
 */
export function resolveSettingChangeActions(changes, areaName) {
    const actions = [];
    if (areaName === 'sync') {
        if (changes.theme) actions.push({ type: 'applyTheme', value: changes.theme.newValue });
        if (changes.listDensity) actions.push({ type: 'applyDensity', value: changes.listDensity.newValue });
        if (changes.customTheme) actions.push({ type: 'applyCustomTheme' });
        if (changes.backgroundImageConfig) actions.push({ type: 'applyBackground' });
        if (changes.uiLanguage) actions.push({ type: 'reload' });
        // BASE-015:外觀頁拖曳寫入 sectionOrder;sidepanel 據此重排區塊 wrapper。
        if (changes.sectionOrder) actions.push({ type: 'dispatch', event: 'sectionOrderChanged', detail: { order: changes.sectionOrder.newValue } });
        const evMap = {
            readingListVisible: 'readingListVisibilityChanged',
            aiGroupingVisible: 'aiGroupingVisibilityChanged',
            aiCleanupVisible: 'aiCleanupVisibilityChanged',
            pageReaderVisible: 'pageReaderVisibilityChanged',
        };
        for (const [key, event] of Object.entries(evMap)) {
            if (changes[key]) actions.push({ type: 'dispatch', event, detail: { visible: changes[key].newValue } });
        }
        const refreshKeys = [
            'readingListVisible',
            'aiGroupingVisible',
            'aiCleanupVisible',
            'pageReaderVisible',
            'aiAutoNamingEnabled',
            'hoverSummarizeEnabled',
            'readingListSummaryEnabled',
        ];
        for (const key of refreshKeys) {
            if (changes[key]) actions.push({ type: 'refreshState', key });
        }
    } else if (areaName === 'local') {
        if (changes.custom_bg_image_data) actions.push({ type: 'applyBackground' });
        // The background service worker writes Drive-sync status here; surface it
        // to the sidepanel badge via a DOM event (applySettingChanges dispatches it).
        if (changes.driveSyncStatus) actions.push({ type: 'dispatch', event: 'driveSyncStatusChanged', detail: changes.driveSyncStatus.newValue });
        // aiManager (any context, incl. the background SW) records cloud AI
        // 401/403 here; the sidepanel shows a throttled toast (modules/ui/toast.js).
        if (changes.aiProviderAuthError) actions.push({ type: 'dispatch', event: 'aiProviderAuthErrorChanged', detail: changes.aiProviderAuthError.newValue });
    }
    return actions;
}

/** Executes actions in the sidepanel context. */
export async function applySettingChanges(actions) {
    for (const a of actions) {
        try {
            if (a.type === 'applyTheme') {
                if (a.value === 'custom') await customTheme.loadAndApplyCustomTheme();
                else applyTheme(a.value);
            } else if (a.type === 'applyDensity') {
                applyDensity(a.value);
            } else if (a.type === 'applyCustomTheme') {
                await customTheme.loadAndApplyCustomTheme();
            } else if (a.type === 'applyBackground') {
                await bgImage.loadAndApplyBackgroundImage();
            } else if (a.type === 'reload') {
                window.location.reload();
            } else if (a.type === 'dispatch') {
                document.dispatchEvent(new CustomEvent(a.event, { detail: a.detail }));
            } else if (a.type === 'refreshState') {
                const initByKey = {
                    readingListVisible: state.initReadingListVisibility,
                    aiGroupingVisible: state.initAiGroupingVisibility,
                    aiCleanupVisible: state.initAiCleanupVisibility,
                    pageReaderVisible: state.initPageReaderVisibility,
                    aiAutoNamingEnabled: state.initAiAutoNaming,
                    hoverSummarizeEnabled: state.initHoverSummarize,
                    readingListSummaryEnabled: state.initReadingListSummary,
                };
                const fn = initByKey[a.key];
                if (fn) await fn();
            }
        } catch (e) { console.warn('[settingsBridge] action failed', a, e); }
    }
}

/** Subscribe in the sidepanel. */
export function initSettingsBridge() {
    if (!chrome?.storage?.onChanged) return;
    chrome.storage.onChanged.addListener((changes, areaName) => {
        const actions = resolveSettingChangeActions(changes, areaName);
        if (actions.length) applySettingChanges(actions);
    });
}
