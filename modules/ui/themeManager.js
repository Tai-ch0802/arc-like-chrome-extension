import * as api from '../apiManager.js';
import * as modal from '../modalManager.js';
import * as state from '../stateManager.js';

/**
 * 應用指定的主題到文檔的 body 上。
 * 如果主題是 'custom'，則會從存儲中加載自訂主題樣式。
 * @param {string} themeName - 要應用的主題名稱 (e.g., 'geek', 'google', 'custom')。
 */
export function applyTheme(themeName) {
    // 清除先前可能已應用的自訂樣式和內聯樣式
    const existingStyle = document.getElementById('custom-theme-style');
    if (existingStyle) {
        existingStyle.remove();
    }
    document.body.style.backgroundImage = '';
    document.body.style.backgroundColor = '';
    document.body.style.backgroundSize = '';
    document.body.style.backgroundPosition = '';
    document.body.style.backgroundRepeat = '';
    document.body.style.backgroundAttachment = '';


    if (themeName === 'custom') {
        api.getStorage('sync', { customTheme: {} }).then(data => {
            const customTheme = data.customTheme;
            if (customTheme && Object.keys(customTheme).length > 0) {
                const style = document.createElement('style');
                style.id = 'custom-theme-style';

                let cssText = ':root {';
                for (const [key, value] of Object.entries(customTheme)) {
                    if (key.startsWith('--')) {
                        cssText += `${key}: ${value};`;
                    }
                }
                cssText += '}';

                style.textContent = cssText;
                document.head.appendChild(style);

                // 處理背景圖片
                const bodyStyle = document.body.style;
                const bgUrl = customTheme['background-image-url'];
                const opacity = customTheme['background-opacity'];
                const bgColor = customTheme['--main-bg-color'] || '#1e1e2e';

                if (bgUrl) {
                     bodyStyle.setProperty('background-image', `url('${bgUrl}')`, 'important');
                     bodyStyle.setProperty('background-size', 'cover', 'important');
                     bodyStyle.setProperty('background-position', 'center', 'important');
                     bodyStyle.setProperty('background-repeat', 'no-repeat', 'important');
                     bodyStyle.setProperty('background-attachment', 'fixed', 'important');
                } else {
                    bodyStyle.backgroundImage = 'none';
                }
                // Always set background color for opacity layer or solid color
                 bodyStyle.backgroundColor = bgColor;
            }
        });
    }
    document.body.dataset.theme = themeName;
}

/**
 * 初始化主題切換器。
 * - 從存儲中加載並應用保存的主題。
 * - 為設定面板和主題選項添加事件監聽器。
 */
export function initThemeSwitcher() {
    const settingsToggle = document.getElementById('settings-toggle');

    // 點擊設定圖示，彈出設定對話框
    settingsToggle.addEventListener('click', async () => {
        const currentTheme = document.body.dataset.theme || 'geek';

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
                    <option value="${option.value}" ${currentTheme === option.value ? 'selected' : ''}>
                        ${api.getMessage(option.labelKey)}
                    </option>
                `).join('')}
            </select>
        `;

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
                if (themeSelectDropdown) {
                    themeSelectDropdown.addEventListener('change', (event) => {
                        const newTheme = event.target.value;
                        if (newTheme === 'custom') {
                            chrome.runtime.openOptionsPage();
                        } else {
                            applyTheme(newTheme);
                            api.setStorage('sync', { theme: newTheme });
                        }
                    });
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
    api.getStorage('sync', { theme: 'geek' }).then(data => {
        applyTheme(data.theme);
    }).catch(console.error);
}
