import * as api from '../apiManager.js';
import * as modal from '../modalManager.js';
import * as state from '../stateManager.js';
import * as customTheme from './customThemeManager.js';
import * as bgImage from './backgroundImageManager.js';
import * as rss from '../rssManager.js';
import { escapeHtml } from '../utils/textUtils.js';

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
/**
 * 建構設定對話框的 HTML 內容。
 * @param {string} selectedTheme - 當前選中的主題
 * @returns {Promise<string>} 設定對話框的 HTML 內容
 */
async function buildSettingsDialogContent(selectedTheme) {
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

    // Fetch current shortcuts
    let currentShortcut = 'N/A';
    let newTabRightShortcut = 'N/A';
    try {
        const commands = await chrome.commands.getAll();
        const toggleCommand = commands.find(cmd => cmd.name === '_execute_action');
        if (toggleCommand && toggleCommand.shortcut) {
            currentShortcut = escapeHtml(toggleCommand.shortcut);
        }
        const newTabRightCommand = commands.find(cmd => cmd.name === 'create-new-tab-right');
        if (newTabRightCommand && newTabRightCommand.shortcut) {
            newTabRightShortcut = escapeHtml(newTabRightCommand.shortcut);
        }
    } catch (error) {
        console.error('Failed to get commands:', error);
    }

    // Chevron icon for collapsible sections
    const chevronIcon = `<svg class="chevron-icon" width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

    return `
        <!-- Theme Section (default expanded) -->
        <div class="settings-section collapsible" data-expanded="true">
            <button class="settings-section-header collapsible-toggle expanded" aria-expanded="true">
                ${chevronIcon}
                <span>${api.getMessage('themeSectionHeader')}</span>
            </button>
            <div class="settings-section-content expanded">
                <div class="theme-options">
                    ${themeSelectHtml}
                </div>
                <div id="custom-theme-container" class="${selectedTheme === 'custom' ? '' : 'hidden'}">
                    ${customThemePanelHtml}
                </div>
            </div>
        </div>

        <!-- Background Image Section -->
        <div class="settings-section collapsible">
            <button class="settings-section-header collapsible-toggle" aria-expanded="false">
                ${chevronIcon}
                <span>${api.getMessage('bgImageSectionHeader') || 'Background Image'}</span>
            </button>
            <div class="settings-section-content">
                ${bgImagePanelHtml}
            </div>
        </div>

        <!-- Reading List Section -->
        <div class="settings-section collapsible">
            <button class="settings-section-header collapsible-toggle" aria-expanded="false">
                ${chevronIcon}
                <span>${api.getMessage('readingListSettingsHeader')}</span>
            </button>
            <div class="settings-section-content">
                <!-- Show/Hide Toggle -->
                <label class="settings-toggle">
                    <input type="checkbox" id="reading-list-toggle" ${state.isReadingListVisible() ? 'checked' : ''}>
                    <span class="toggle-label">${api.getMessage('showReadingListLabel')}</span>
                </label>

                <!-- RSS Subsection -->
                <div class="settings-subsection">
                    <h4 class="settings-subsection-header">${api.getMessage('rssSubscriptionHeader')}</h4>
                    <div id="rss-subscriptions-list"></div>
                    <div class="rss-add-form">
                        <input type="url" id="rss-url-input" placeholder="https://example.com/feed.xml" class="settings-input">
                        <button id="add-rss-btn" class="settings-button">${api.getMessage('addRssSubscription')}</button>
                    </div>
                    <div id="rss-error-message" class="rss-error hidden"></div>
                </div>
            </div>
        </div>

        <!-- Shortcuts Section -->
        <div class="settings-section collapsible">
            <button class="settings-section-header collapsible-toggle" aria-expanded="false">
                ${chevronIcon}
                <span>${api.getMessage('shortcutSectionHeader')}</span>
            </button>
            <div class="settings-section-content">
                <p>${api.getMessage('shortcutExplanation')}</p>
                <p>${api.getMessage('currentShortcutLabel')} <span id="current-shortcut">${currentShortcut}</span></p>
                <p>${api.getMessage('settingsShortcutCreateTabRight')} <span id="create-new-tab-right-shortcut">${newTabRightShortcut}</span></p>
                <button id="open-shortcuts-button" class="modal-button">${api.getMessage('shortcutLinkText')}</button>
            </div>
        </div>

        <!-- Side Panel Position Section -->
        <div class="settings-section collapsible">
            <button class="settings-section-header collapsible-toggle" aria-expanded="false">
                ${chevronIcon}
                <span>${api.getMessage('sidePanelPositionSectionHeader')}</span>
            </button>
            <div class="settings-section-content">
                <p>${api.getMessage('sidePanelPositionExplanation')}</p>
                <button id="open-appearance-settings-button" class="modal-button">${api.getMessage('sidePanelPositionLinkText')}</button>
            </div>
        </div>

        <!-- About Section -->
        <div class="settings-section collapsible">
            <button class="settings-section-header collapsible-toggle" aria-expanded="false">
                ${chevronIcon}
                <span>${api.getMessage('aboutSectionHeader')}</span>
            </button>
            <div class="settings-section-content">
                <p>${api.getMessage('aboutText')}</p>
                <a href="https://github.com/Tai-ch0802/arc-like-chrome-extension" target="_blank" class="modal-link-button">${api.getMessage('githubLinkText')}</a>
            </div>
        </div>
    `;
}

/**
 * 綁定設定對話框的事件處理器。
 * @param {HTMLElement} modalContentElement - 對話框內容元素
 */
function bindSettingsEventHandlers(modalContentElement) {
    const themeSelectDropdown = modalContentElement.querySelector('#theme-select-dropdown');
    const customThemeContainer = modalContentElement.querySelector('#custom-theme-container');

    // Theme selection handler
    if (themeSelectDropdown) {
        themeSelectDropdown.addEventListener('change', async (event) => {
            const newTheme = event.target.value;

            if (newTheme === 'custom') {
                customThemeContainer.classList.remove('hidden');
                await customTheme.loadAndApplyCustomTheme();
            } else {
                customThemeContainer.classList.add('hidden');
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

    // Shortcuts button
    const openShortcutsButton = modalContentElement.querySelector('#open-shortcuts-button');
    if (openShortcutsButton) {
        openShortcutsButton.addEventListener('click', () => {
            chrome.runtime.sendMessage({ action: 'openShortcutsPage' });
        });
    }

    // Appearance settings button
    const openAppearanceSettingsButton = modalContentElement.querySelector('#open-appearance-settings-button');
    if (openAppearanceSettingsButton) {
        openAppearanceSettingsButton.addEventListener('click', () => {
            chrome.runtime.sendMessage({ action: 'openAppearanceSettingsPage' });
        });
    }

    // Reading List toggle handler
    const readingListToggle = modalContentElement.querySelector('#reading-list-toggle');
    if (readingListToggle) {
        readingListToggle.addEventListener('change', async (e) => {
            const isVisible = e.target.checked;
            await state.setReadingListVisible(isVisible);
            // Dispatch custom event for sidepanel to react
            document.dispatchEvent(new CustomEvent('readingListVisibilityChanged', {
                detail: { visible: isVisible }
            }));
        });
    }

    // RSS Subscriptions handlers
    const rssListContainer = modalContentElement.querySelector('#rss-subscriptions-list');
    const rssUrlInput = modalContentElement.querySelector('#rss-url-input');
    const addRssBtn = modalContentElement.querySelector('#add-rss-btn');
    const rssErrorMessage = modalContentElement.querySelector('#rss-error-message');

    // Render RSS subscription list
    async function renderRssList() {
        if (!rssListContainer) return;

        const subscriptions = rss.getSubscriptions();

        if (subscriptions.length === 0) {
            rssListContainer.innerHTML = `<p class="rss-empty">${api.getMessage('rssNoSubscriptions') || 'No RSS subscriptions yet.'}</p>`;
            return;
        }

        rssListContainer.innerHTML = subscriptions.map(sub => `
            <div class="rss-subscription-item" data-id="${escapeHtml(sub.id)}">
                <div class="rss-subscription-info">
                    <span class="rss-subscription-title">${escapeHtml(sub.title)}</span>
                    <select class="rss-interval-select" title="${api.getMessage('rssIntervalLabel')}">
                        <option value="1h" ${sub.interval === '1h' ? 'selected' : ''}>1h</option>
                        <option value="3h" ${sub.interval === '3h' ? 'selected' : ''}>3h</option>
                        <option value="8h" ${sub.interval === '8h' ? 'selected' : ''}>8h</option>
                        <option value="12h" ${sub.interval === '12h' ? 'selected' : ''}>12h</option>
                        <option value="24h" ${sub.interval === '24h' ? 'selected' : ''}>24h</option>
                    </select>
                </div>
                <div class="rss-subscription-actions">
                    <button class="rss-fetch-now-btn" title="${api.getMessage('rssFetchNowButton')}" aria-label="${api.getMessage('rssFetchNowButton')}">
                        🔄
                    </button>
                    <button class="rss-toggle-btn" data-action="${sub.enabled ? 'pause' : 'resume'}" title="${sub.enabled ? api.getMessage('rssPauseButton') : api.getMessage('rssResumeButton')}" aria-label="${sub.enabled ? api.getMessage('rssPauseButton') : api.getMessage('rssResumeButton')}">
                        ${sub.enabled ? '⏸' : '▶'}
                    </button>
                    <button class="rss-delete-btn" title="${api.getMessage('rssDeleteButton')}" aria-label="${api.getMessage('rssDeleteButton')}">×</button>
                </div>
            </div>
        `).join('');

        // Bind event listeners
        rssListContainer.querySelectorAll('.rss-fetch-now-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const item = e.target.closest('.rss-subscription-item');
                const id = item.dataset.id;

                // Show loading state
                const originalContent = btn.innerHTML;
                btn.disabled = true;
                btn.textContent = '...';

                const statusMsg = document.createElement('div');
                statusMsg.className = 'rss-fetch-status';
                statusMsg.textContent = api.getMessage('rssFetching') || 'Fetching...';
                item.appendChild(statusMsg);

                try {
                    const addedCount = await rss.fetchNow(id);
                    statusMsg.textContent = api.getMessage('labelSuccess') || 'Success!';
                    statusMsg.classList.add('success');

                    // Dispatch event to refresh reading list UI if visible
                    document.dispatchEvent(new CustomEvent('readingListUpdated'));

                    setTimeout(() => statusMsg.remove(), 2000);
                } catch (err) {
                    statusMsg.textContent = err.message;
                    statusMsg.classList.add('error');
                    setTimeout(() => statusMsg.remove(), 3000);
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = originalContent;
                }
            });
        });

        rssListContainer.querySelectorAll('.rss-toggle-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const item = e.target.closest('.rss-subscription-item');
                const id = item.dataset.id;
                const action = e.target.dataset.action;
                await rss.updateSubscription(id, { enabled: action === 'resume' });
                renderRssList();
            });
        });

        // Interval change handler
        rssListContainer.querySelectorAll('.rss-interval-select').forEach(select => {
            select.addEventListener('change', async (e) => {
                const item = e.target.closest('.rss-subscription-item');
                const id = item.dataset.id;
                const newInterval = e.target.value;
                await rss.updateSubscription(id, { interval: newInterval });
            });
        });

        rssListContainer.querySelectorAll('.rss-delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const item = e.target.closest('.rss-subscription-item');
                const id = item.dataset.id;
                const title = item.querySelector('.rss-subscription-title').textContent;

                const confirmed = await modal.showConfirm({
                    title: api.getMessage('rssDeleteButton'),
                    message: api.getMessage('confirmDeleteRss', title),
                    confirmButtonText: api.getMessage('deleteButton'),
                    confirmButtonClass: 'danger'
                });

                if (confirmed) {
                    await rss.removeSubscription(id);
                    renderRssList();
                }
            });
        });
    }


    // Add subscription handler
    if (addRssBtn && rssUrlInput) {
        addRssBtn.addEventListener('click', async () => {
            const url = rssUrlInput.value.trim();
            if (!url) return;

            addRssBtn.disabled = true;
            addRssBtn.textContent = '...';
            rssErrorMessage.classList.add('hidden');

            try {
                await rss.addSubscription(url);
                rssUrlInput.value = '';
                renderRssList();
            } catch (err) {
                // Use i18n error messages based on error type
                let errorMsg;
                if (err.message.includes('timeout')) {
                    errorMsg = api.getMessage('rssErrorTimeout');
                } else if (err.message.includes('Already subscribed')) {
                    errorMsg = api.getMessage('rssErrorAlreadySubscribed');
                } else {
                    errorMsg = api.getMessage('rssErrorFetchFailed') || err.message;
                }
                rssErrorMessage.textContent = errorMsg;
                rssErrorMessage.classList.remove('hidden');
            } finally {
                addRssBtn.disabled = false;
                addRssBtn.textContent = api.getMessage('addRssSubscription');
            }
        });
    }

    // Initial render of RSS list
    renderRssList();

    // Setup collapsible section toggles
    const collapsibleToggles = modalContentElement.querySelectorAll('.collapsible-toggle');
    collapsibleToggles.forEach(toggle => {
        toggle.addEventListener('click', () => {
            const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
            const content = toggle.nextElementSibling;

            toggle.setAttribute('aria-expanded', !isExpanded);
            toggle.classList.toggle('expanded', !isExpanded);
            if (content) {
                content.classList.toggle('expanded', !isExpanded);
            }
        });
    });
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
        const storedData = await api.getStorage('sync', { theme: 'geek' });
        const selectedTheme = storedData.theme || 'geek';

        const content = await buildSettingsDialogContent(selectedTheme);

        await modal.showCustomDialog({
            title: api.getMessage('settingsTitle'),
            content: content,
            onOpen: bindSettingsEventHandlers
        });
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
}

