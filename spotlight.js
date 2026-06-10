import * as api from './modules/apiManager.js';
import { applyTheme } from './modules/ui/settingManager.js';
import * as customTheme from './modules/ui/customThemeManager.js';
import * as state from './modules/stateManager.js';
import * as workspaceManager from './modules/workspace/workspaceManager.js';
import * as tagManager from './modules/bookmark/tagManager.js';
import { setOriginWindowId } from './modules/commandPalette/searchContext.js';
import { initSpotlight } from './modules/spotlight/spotlightController.js';

async function applyOwnTheme() {
    try {
        const { theme } = await api.getStorage('sync', { theme: 'geek' });
        if (theme === 'custom') { await customTheme.loadAndApplyCustomTheme(); }
        else { applyTheme(theme); }
    } catch (e) { console.warn('spotlight theme apply failed', e); }
}

function localizeStatic() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const msg = api.getMessage(el.getAttribute('data-i18n'));
        if (msg) el.textContent = msg;
    });
    const input = document.getElementById('spotlight-input');
    if (input) input.placeholder = api.getMessage('cmdPalettePlaceholder') || 'Search tabs, bookmarks, actions…';
}

document.addEventListener('DOMContentLoaded', async () => {
    // i18n 必須在套用任何字串前載入自訂字典
    const uiLang = await state.initUiLanguage();
    await api.loadCustomI18n(uiLang);
    await applyOwnTheme();
    localizeStatic();

    // 取得 background 記錄的來源 normal 視窗,讓 handler 作用於使用者視窗
    try {
        const { spotlightOriginWindowId } = await chrome.storage.session.get('spotlightOriginWindowId');
        setOriginWindowId(spotlightOriginWindowId);
    } catch { /* ignore */ }
    // 從另一個視窗再按快捷鍵會「聚焦既有 Spotlight」並改寫 origin(不重載頁面),
    // 必須跟著更新,否則動作會路由到舊的來源視窗(ISSUE-162 A2)。
    chrome.storage.session.onChanged.addListener((changes) => {
        if (changes.spotlightOriginWindowId) {
            setOriginWindowId(changes.spotlightOriginWindowId.newValue);
        }
    });

    // Hydrate data provider + action 可見性判斷所讀的 state
    await Promise.all([
        state.loadBookmarkCache(),
        state.initAiGroupingVisibility(),
        state.initAiCleanupVisibility(),
        workspaceManager.initWorkspaces(),
        tagManager.initTags(), // tag: 查詢需要(ISSUE-162 WP6)
    ]);

    initSpotlight();
});
