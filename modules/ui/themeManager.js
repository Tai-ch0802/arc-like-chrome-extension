import * as api from '../apiManager.js';
import * as modal from '../modalManager.js';
import * as state from '../stateManager.js';
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

/**
 * 初始化主題切換器。
 * - 從存儲中加載並應用保存的主題。
 * - 為設定面板和主題選項添加事件監聯器。
 */
export function initThemeSwitcher() {
    const settingsToggle = document.getElementById('settings-toggle');

    // 點擊設定圖示，彈出設定對話框
    settingsToggle.addEventListener('click', async () => {
        const currentTheme = document.body.dataset.theme || 'geek';
        const storedData = await api.getStorage('sync', { theme: 'geek' });
        const selectedTheme = storedData.theme || 'geek';

        const themeOptions = [
            { value: 'geek', labelKey: 'themeOptionGeek' },
            { value: 'google', labelKey: 'themeOptionGoogle' },
            { value: 'darcula', labelKey: 'themeOptionDarcula' },
            { value: 'geek-blue', labelKey: 'themeOptionGeekBlue' },
            { value: 'christmas', labelKey: 'themeOptionChristmas' },
            { value: 'custom', labelKey: 'themeOptionCustom' }
        ];

        const themeSelectHtml = `
            <select id="theme-select-dropdown" class="modal-select">
                ${themeOptions.map(option => `
                    <option value="${option.value}" ${selectedTheme === option.value ? 'selected' : ''}>
                        ${api.getMessage(option.labelKey) || option.value}
                    </option>
                `).join('')}
            </select>
        `;

        // Get custom theme panel HTML
        const customThemePanelHtml = await customTheme.getCustomThemePanelHtml();

        // Get background image panel HTML
        const bgConfig = await bgImage.loadBackgroundConfig();
        const bgImagePanelHtml = bgImage.createBackgroundPanelHtml(bgConfig);

        // Fetch current shortcut
        let currentShortcut = 'N/A';
        let newTabRightShortcut = 'N/A';
        try {
            const commands = await chrome.commands.getAll();
            const toggleCommand = commands.find(cmd => cmd.name === '_execute_action');
            if (toggleCommand && toggleCommand.shortcut) {
                currentShortcut = toggleCommand.shortcut;
            }
            const newTabRightCommand = commands.find(cmd => cmd.name === 'create-new-tab-right');
            if (newTabRightCommand && newTabRightCommand.shortcut) {
                newTabRightShortcut = newTabRightCommand.shortcut;
            }
        } catch (error) {
            console.error('Failed to get commands:', error);
        }

        const content = `
            <div class="settings-section">
                <h4 class="settings-section-header">${api.getMessage('themeSectionHeader')}</h4>
                <div class="theme-options">
                    ${themeSelectHtml}
                </div>
                <div id="custom-theme-container" class="${selectedTheme === 'custom' ? '' : 'hidden'}">
                    ${customThemePanelHtml}
                </div>
            </div>
            <div class="settings-section">
                <h4 class="settings-section-header">${api.getMessage('bgImageSectionHeader') || 'Background Image'}</h4>
                ${bgImagePanelHtml}
            </div>
            <div class="settings-section">
                <h4 class="settings-section-header">${api.getMessage('shortcutSectionHeader')}</h4>
                <p>${api.getMessage('shortcutExplanation')}</p>
                <p>${api.getMessage('currentShortcutLabel')} <span id="current-shortcut">${currentShortcut}</span></p>
                <p>${api.getMessage('settingsShortcutCreateTabRight')} <span
           id="create-new-tab-right-shortcut">${newTabRightShortcut}</span></p>
                <button id="open-shortcuts-button" class="modal-button">${api.getMessage('shortcutLinkText')}</button>
            </div>
            <div class="settings-section">
                <h4 class="settings-section-header">${api.getMessage('sidePanelPositionSectionHeader')}</h4>
                <p>${api.getMessage('sidePanelPositionExplanation')}</p>
                <button id="open-appearance-settings-button" class="modal-button">${api.getMessage('sidePanelPositionLinkText')}</button>
            </div>
            <div class="settings-section">
                <h4 class="settings-section-header">${api.getMessage('aboutSectionHeader')}</h4>
                <p>${api.getMessage('aboutText')}</p>
                <a href="https://github.com/Tai-ch0802/arc-like-chrome-extension" target="_blank" class="modal-link-button">${api.getMessage('githubLinkText')}</a>
            </div>
        `;


        await modal.showCustomDialog({
            title: api.getMessage('settingsTitle'),
            content: content,
            onOpen: (modalContentElement) => {
                // 在對話框內容被添加到 DOM 後，綁定事件監聽器
                const themeSelectDropdown = modalContentElement.querySelector('#theme-select-dropdown');
                const customThemeContainer = modalContentElement.querySelector('#custom-theme-container');

                if (themeSelectDropdown) {
                    themeSelectDropdown.addEventListener('change', async (event) => {
                        const newTheme = event.target.value;

                        if (newTheme === 'custom') {
                            // Show custom theme panel
                            customThemeContainer.classList.remove('hidden');
                            // Load and apply custom theme
                            await customTheme.loadAndApplyCustomTheme();
                        } else {
                            // Hide custom theme panel
                            customThemeContainer.classList.add('hidden');
                            // Apply predefined theme
                            applyTheme(newTheme);
                        }

                        api.setStorage('sync', { theme: newTheme });
                    });
                }

                // Setup custom theme panel handlers
                if (customThemeContainer) {
                    customTheme.setupCustomThemePanel(customThemeContainer);
                }

                // Setup background image panel handlers
                const bgImagePanel = modalContentElement.querySelector('.bg-image-panel');
                if (bgImagePanel) {
                    bgImage.setupBackgroundPanelHandlers(bgImagePanel.parentElement);
                }

                const openShortcutsButton = modalContentElement.querySelector('#open-shortcuts-button');
                if (openShortcutsButton) {
                    openShortcutsButton.addEventListener('click', () => {
                        chrome.runtime.sendMessage({ action: 'openShortcutsPage' });
                    });
                }
                const openAppearanceSettingsButton = modalContentElement.querySelector('#open-appearance-settings-button');
                if (openAppearanceSettingsButton) {
                    openAppearanceSettingsButton.addEventListener('click', () => {
                        chrome.runtime.sendMessage({ action: 'openAppearanceSettingsPage' });
                    });
                }
            }
        });
    });

    // 從存儲中加載並應用主題 (首次載入時)
    api.getStorage('sync', { theme: 'geek' }).then(async (data) => {
        if (data.theme === 'custom') {
            // Load and apply custom theme
            const applied = await customTheme.loadAndApplyCustomTheme();
            if (!applied) {
                // Fallback to geek if no custom theme saved
                applyTheme('geek');
                api.setStorage('sync', { theme: 'geek' });
            }
        } else {
            applyTheme(data.theme);
        }
    }).catch(console.error);

    // Load and apply background image (runs in parallel with theme)
    bgImage.loadAndApplyBackgroundImage().catch(console.error);
}
