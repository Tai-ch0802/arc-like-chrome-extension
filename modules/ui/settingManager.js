import * as api from '../apiManager.js';
import * as customTheme from './customThemeManager.js';
import * as bgImage from './backgroundImageManager.js';

/**
 * 應用指定的主題到文檔的 body 上。
 * @param {string} themeName - 要應用的主題名稱 (e.g., 'geek', 'google', 'custom')。
 */
export function applyTheme(themeName) {
    if (themeName === 'custom') {
        // For custom theme, remove data-theme attribute and let CSS variables take over
        delete document.body.dataset.theme;
    } else {
        // For predefined themes, clear any custom CSS variables and set data-theme
        customTheme.clearCustomColors();
        document.body.dataset.theme = themeName;
    }
}

/** 有效的列間距密度;cozy 為預設(等同改版前的間距)。 */
export const VALID_DENSITIES = ['compact', 'cozy', 'comfortable'];

/**
 * 套用列間距密度到 body(data-density)。cozy 不設 attr,讓 :root 預設值生效。
 * @param {string} value - 'compact' | 'cozy' | 'comfortable'
 */
export function applyDensity(value) {
    const v = VALID_DENSITIES.includes(value) ? value : 'cozy';
    if (v === 'cozy') delete document.body.dataset.density;
    else document.body.dataset.density = v;
}

/**
 * 初始化主題切換器。
 * - 從存儲中加載並應用保存的主題。
 * - 設定齒輪按鈕點擊時開啟 options 頁面。
 */
export function initThemeSwitcher() {
    const settingsToggle = document.getElementById('settings-toggle');

    // 點擊設定圖示，開啟 options 設定頁面
    settingsToggle.addEventListener('click', () => {
        if (chrome.runtime.openOptionsPage) {
            chrome.runtime.openOptionsPage();
        } else {
            chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
        }
    });

    // 從存儲中加載並應用主題 (首次載入時)
    api.getStorage('sync', { theme: 'geek' }).then(async (data) => {
        if (data.theme === 'custom') {
            const applied = await customTheme.loadAndApplyCustomTheme();
            if (!applied) {
                applyTheme('geek');
                api.setStorage('sync', { theme: 'geek' });
            }
        } else {
            applyTheme(data.theme);
        }
    }).catch(console.error);

    // Load and apply background image (runs in parallel with theme)
    bgImage.loadAndApplyBackgroundImage().catch(console.error);

    // Load and apply list-row density (runs in parallel with theme)
    api.getStorage('sync', { listDensity: 'cozy' })
        .then((d) => applyDensity(d.listDensity))
        .catch(console.error);
}
