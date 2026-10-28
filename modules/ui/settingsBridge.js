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
import { invalidateCapabilityFlag } from '../apiManager.js';
import { isPrefStorageKey, prefNameFromKey } from '../prefs/prefsStore.js';
import { CAP_TAB_GROUPS, CAP_SIDE_PANEL } from '../utils/browserCapabilities.js';

const CAPABILITY_FLAG_KEYS = [CAP_TAB_GROUPS, CAP_SIDE_PANEL];

/**
 * Pure: map a storage change set to UI actions. No side effects.
 * @param {Object} changes chrome.storage.onChanged changes object
 * @param {string} areaName 'sync' | 'local'
 * @returns {Array<object>}
 */
export function resolveSettingChangeActions(changes, areaName) {
    const actions = [];
    // ISSUE-257 WP3: preferences live in storage.local as `pref_<name>` records
    // ({ v, t }); map them back to plain name → newValue so the mapping below is
    // unchanged. Legacy storage.sync writes from not-yet-upgraded devices are
    // deliberately ignored (no dual-write, BASE-014 §3.4).
    const prefChanges = {};
    if (areaName === 'local') {
        for (const [key, change] of Object.entries(changes)) {
            if (!isPrefStorageKey(key)) continue;
            const rec = change && change.newValue;
            prefChanges[prefNameFromKey(key)] = { newValue: rec && typeof rec === 'object' ? rec.v : undefined };
        }
    }
    if (Object.keys(prefChanges).length) {
        const changes = prefChanges; // shadow on purpose: same mapping as before the move
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
            newswireVisible: 'newswireVisibilityChanged',
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
            'newswireVisible',
        ];
        for (const key of refreshKeys) {
            if (changes[key]) actions.push({ type: 'refreshState', key });
        }
    }
    if (areaName === 'local') {
        if (changes.custom_bg_image_data) actions.push({ type: 'applyBackground' });
        // The background service worker writes Drive-sync status here; surface it
        // to the sidepanel badge via a DOM event (applySettingChanges dispatches it).
        if (changes.driveSyncStatus) actions.push({ type: 'dispatch', event: 'driveSyncStatusChanged', detail: changes.driveSyncStatus.newValue });
        // aiManager (any context, incl. the background SW) records cloud AI
        // 401/403 here; the sidepanel shows a throttled toast (modules/ui/toast.js).
        if (changes.aiProviderAuthError) actions.push({ type: 'dispatch', event: 'aiProviderAuthErrorChanged', detail: changes.aiProviderAuthError.newValue });
        // ISSUE-257: per-device capability flags (written by apiManager's group
        // guard in whichever context hit the failure). The sidepanel re-evaluates
        // grouping UI; applySettingChanges also drops apiManager's cached value.
        for (const name of CAPABILITY_FLAG_KEYS) {
            if (changes[name]) {
                const next = changes[name].newValue;
                actions.push({ type: 'dispatch', event: 'capabilitiesChanged', detail: { name, unsupported: Boolean(next && next.unsupported) } });
            }
        }
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
                if (a.event === 'capabilitiesChanged') {
                    invalidateCapabilityFlag(a.detail.name);
                    await state.initTabGroupingAvailability();
                }
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
                    newswireVisible: state.initNewswireVisibility,
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
