import * as api from './modules/apiManager.js';
import { applyTheme } from './modules/ui/settingManager.js';
import * as customTheme from './modules/ui/customThemeManager.js';
import * as bgImage from './modules/ui/backgroundImageManager.js';
import * as rss from './modules/rssManager.js';
import { checkModelAvailability, triggerLanguageModelDownload } from './modules/aiManager.js';

const THEME_OPTIONS = [
    { value: 'geek', labelKey: 'themeOptionGeek' },
    { value: 'google', labelKey: 'themeOptionGoogle' },
    { value: 'darcula', labelKey: 'themeOptionDarcula' },
    { value: 'geek-blue', labelKey: 'themeOptionGeekBlue' },
    { value: 'christmas', labelKey: 'themeOptionChristmas' },
    { value: 'custom', labelKey: 'themeOptionCustom' }
];

/**
 * 建立一個 .opt-row 容器：左側 label（含選用說明），右側 control。
 * @param {string} labelText
 * @param {HTMLElement} control
 * @param {string} [descText]
 * @returns {HTMLElement}
 */
function makeRow(labelText, control, descText) {
    const row = document.createElement('div');
    row.className = 'opt-row';

    const labelWrap = document.createElement('div');
    const label = document.createElement('div');
    label.className = 'opt-row__label';
    label.textContent = labelText;
    labelWrap.appendChild(label);
    if (descText) {
        const desc = document.createElement('div');
        desc.className = 'opt-row__desc';
        desc.textContent = descText;
        labelWrap.appendChild(desc);
    }

    row.appendChild(labelWrap);
    if (control) row.appendChild(control);
    return row;
}

/**
 * 渲染外觀設定區塊：主題選擇、自訂主題面板、背景圖控制。
 * 重用 sidepanel 的 customThemeManager / backgroundImageManager 既有 API，
 * 但掛載在 options 頁面而非 modal 內。所有變更會即時套用到本頁面預覽，
 * 並寫入 storage；不 dispatch CustomEvent（sidepanel 透過 D6 bridge 反應）。
 * @param {HTMLElement} container
 */
async function renderAppearance(container) {
    const h = document.createElement('h2');
    h.textContent = api.getMessage('settingsNavAppearance') || 'Appearance';
    container.appendChild(h);

    const { theme: storedTheme } = await api.getStorage('sync', { theme: 'geek' });
    const selectedTheme = storedTheme || 'geek';

    // --- Theme select ---
    const themeSelect = document.createElement('select');
    themeSelect.id = 'theme-select-dropdown';
    themeSelect.className = 'modal-select';
    for (const opt of THEME_OPTIONS) {
        const o = document.createElement('option');
        o.value = opt.value;
        o.textContent = api.getMessage(opt.labelKey) || opt.value;
        if (opt.value === selectedTheme) o.selected = true;
        themeSelect.appendChild(o);
    }
    container.appendChild(
        makeRow(api.getMessage('themeSectionHeader') || 'Theme', themeSelect)
    );

    // --- Custom theme panel (reuse customThemeManager) ---
    const customThemeContainer = document.createElement('div');
    customThemeContainer.id = 'custom-theme-container';
    customThemeContainer.innerHTML = await customTheme.getCustomThemePanelHtml();
    if (selectedTheme !== 'custom') customThemeContainer.classList.add('hidden');
    container.appendChild(customThemeContainer);
    customTheme.setupCustomThemePanel(customThemeContainer);

    // --- Theme change handler ---
    themeSelect.addEventListener('change', async (event) => {
        const newTheme = event.target.value;
        await api.setStorage('sync', { theme: newTheme });

        // Apply to THIS options page for instant preview.
        if (newTheme === 'custom') {
            customThemeContainer.classList.remove('hidden');
            await customTheme.loadAndApplyCustomTheme();
        } else {
            customThemeContainer.classList.add('hidden');
            applyTheme(newTheme);
        }
        // NOTE: no CustomEvent dispatch — sidepanel reacts via D6 storage bridge.
    });

    // --- Background image panel (reuse backgroundImageManager) ---
    const bgConfig = await bgImage.loadBackgroundConfig();
    const bgWrap = document.createElement('div');
    bgWrap.innerHTML = bgImage.createBackgroundPanelHtml(bgConfig);
    container.appendChild(
        makeRow(api.getMessage('bgImageSectionHeader') || 'Background Image', null)
    );
    container.appendChild(bgWrap);
    // Handlers query the panel's children; pass the wrapper as container.
    bgImage.setupBackgroundPanelHandlers(bgWrap);
    // Ensure preview reflects current saved background on this page.
    await bgImage.loadAndApplyBackgroundImage();

    // --- Side Panel Position helper (migrated from in-sidepanel dialog) ---
    // chrome:// 連結透過 chrome.tabs.create({url}) 開啟，因為 <a href="chrome://..."> 被瀏覽器封鎖。
    const spHeader = document.createElement('h4');
    spHeader.className = 'settings-subsection-header';
    spHeader.style.marginTop = '12px';
    spHeader.textContent = api.getMessage('sidePanelPositionSectionHeader') || 'Side Panel Position';
    container.appendChild(spHeader);

    const spExplanation = document.createElement('p');
    spExplanation.textContent = api.getMessage('sidePanelPositionExplanation') || '';
    container.appendChild(spExplanation);

    const spBtn = document.createElement('button');
    spBtn.className = 'modal-btn';
    spBtn.textContent = api.getMessage('sidePanelPositionLinkText') || 'Open Chrome Appearance Settings';
    spBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: 'chrome://settings/appearance' });
    });
    container.appendChild(makeRow('', spBtn));
}

const LANGUAGE_OPTIONS = [
    { value: 'auto',  label: () => api.getMessage('languageAuto') || 'Auto (Follow Browser)' },
    { value: 'en',    label: () => 'English' },
    { value: 'zh_TW', label: () => '繁體中文' },
    { value: 'zh_CN', label: () => '简体中文' },
    { value: 'ja',    label: () => '日本語' },
    { value: 'ko',    label: () => '한국어' },
    { value: 'fr',    label: () => 'Français' },
    { value: 'de',    label: () => 'Deutsch' },
    { value: 'es',    label: () => 'Español' },
    { value: 'pt_BR', label: () => 'Português (BR)' },
    { value: 'ru',    label: () => 'Русский' },
    { value: 'id',    label: () => 'Bahasa Indonesia' },
    { value: 'th',    label: () => 'ไทย' },
    { value: 'vi',    label: () => 'Tiếng Việt' },
    { value: 'hi',    label: () => 'हिन्दी' },
];

/**
 * 渲染語言設定區塊：UI 語言選擇。
 * 變更寫入 storage 後 reload 本頁以套用新語言；
 * sidepanel 透過 D6 storage bridge 自行反應，不 dispatch CustomEvent。
 * @param {HTMLElement} container
 */
async function renderLanguage(container) {
    const h = document.createElement('h2');
    h.textContent = api.getMessage('settingsNavLanguage') || 'Language';
    container.appendChild(h);

    const { uiLanguage: storedLang } = await api.getStorage('sync', { uiLanguage: 'auto' });
    const selectedLang = storedLang || 'auto';

    const langSelect = document.createElement('select');
    langSelect.id = 'ui-language-select';
    langSelect.className = 'modal-select';
    for (const opt of LANGUAGE_OPTIONS) {
        const o = document.createElement('option');
        o.value = opt.value;
        o.textContent = opt.label();
        if (opt.value === selectedLang) o.selected = true;
        langSelect.appendChild(o);
    }
    container.appendChild(
        makeRow(api.getMessage('languageSectionHeader') || 'Language / 語言', langSelect)
    );

    langSelect.addEventListener('change', async (e) => {
        await api.setStorage('sync', { uiLanguage: e.target.value });
        // Reload this options page to apply the new locale.
        // NOTE: no CustomEvent dispatch — sidepanel reacts via D6 storage bridge.
        window.location.reload();
    });
}

const FEATURE_TOGGLES = [
    {
        key: 'readingListVisible',
        defaultVal: true,
        labelKey: 'showReadingListLabel',
        descKey: null,
    },
    {
        key: 'aiGroupingVisible',
        defaultVal: true,
        labelKey: 'aiGroupingToggleLabel',
        descKey: 'aiGroupingDescription1',
    },
    {
        key: 'aiCleanupVisible',
        defaultVal: true,
        labelKey: 'aiCleanupToggleLabel',
        descKey: 'aiCleanupDescription',
    },
    {
        key: 'aiAutoNamingEnabled',
        defaultVal: true,
        labelKey: 'aiAutoNamingToggleLabel',
        descKey: 'aiAutoNamingDescription',
    },
    {
        key: 'hoverSummarizeEnabled',
        defaultVal: true,
        labelKey: 'hoverSummarizeToggle',
        descKey: 'hoverSummarizeDescription',
    },
    {
        key: 'readingListSummaryEnabled',
        defaultVal: true,
        labelKey: 'rlSummaryToggleLabel',
        descKey: 'rlSummaryDescription',
    },
];

/**
 * 渲染功能可見性設定區塊：六個功能開關。
 * 每個開關僅 await api.setStorage(...)，不 dispatch CustomEvent；
 * sidepanel 透過 D6 storage bridge 反應。
 * @param {HTMLElement} container
 */
async function renderFeatures(container) {
    const h = document.createElement('h2');
    h.textContent = api.getMessage('settingsNavFeatures') || 'Features';
    container.appendChild(h);

    // Load all feature toggle states in one batch
    const defaults = Object.fromEntries(FEATURE_TOGGLES.map(f => [f.key, f.defaultVal]));
    const stored = await api.getStorage('sync', defaults);

    for (const feat of FEATURE_TOGGLES) {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `feat-toggle-${feat.key}`;
        checkbox.checked = stored[feat.key] !== false; // default true guard

        const labelText = api.getMessage(feat.labelKey) || feat.key;
        const descText  = feat.descKey ? (api.getMessage(feat.descKey) || '') : undefined;

        const row = makeRow(labelText, checkbox, descText);
        container.appendChild(row);

        // AI grouping toggle gets a second description line with an external docs link.
        if (feat.key === 'aiGroupingVisible') {
            const desc2 = document.createElement('div');
            desc2.className = 'opt-row__desc';
            // Build with DOM nodes (part1 + <a> + part2); textContent avoids injection.
            desc2.appendChild(document.createTextNode(api.getMessage('aiGroupingDescription2_part1') || ''));
            const docsLink = document.createElement('a');
            docsLink.href = 'https://developer.chrome.com/docs/ai/get-started';
            docsLink.target = '_blank';
            docsLink.rel = 'noopener';
            docsLink.textContent = api.getMessage('aiGroupingDescription2_linkText') || '';
            desc2.appendChild(docsLink);
            desc2.appendChild(document.createTextNode(api.getMessage('aiGroupingDescription2_part2') || ''));
            // Append into the label/desc column (first child of the .opt-row).
            row.firstChild.appendChild(desc2);
        }

        checkbox.addEventListener('change', async (e) => {
            // NOTE: no CustomEvent dispatch — sidepanel reacts via D6 storage bridge.
            await api.setStorage('sync', { [feat.key]: e.target.checked });
        });
    }
}

/**
 * 渲染 RSS 訂閱設定區塊：列出現有訂閱（含 pause/resume、fetch-now、interval、刪除），
 * 以及 inline 新增訂閱表單。所有資料透過 rssManager 持久化至 chrome.storage。
 * NOTE: fetch-now 在 options 頁面執行後，sidepanel 的閱讀清單不會即時更新，
 * 因為 options page 與 sidepanel 是不同的 context，CustomEvent 無法跨 context 傳遞。
 * sidepanel 在下次開啟時會從 storage 中讀取最新資料，屬於可接受的行為。
 * @param {HTMLElement} container
 */
async function renderRss(container) {
    const h = document.createElement('h2');
    h.textContent = api.getMessage('settingsNavRss') || 'RSS';
    container.appendChild(h);

    // Ensure subscriptions are loaded from storage
    await rss.initRssManager();

    // --- Add subscription row ---
    const addWrap = document.createElement('div');
    addWrap.className = 'opt-row opt-row--rss-add';

    const addLabelWrap = document.createElement('div');
    const addLabel = document.createElement('div');
    addLabel.className = 'opt-row__label';
    addLabel.textContent = api.getMessage('addRssSubscription') || 'Add RSS subscription';
    addLabelWrap.appendChild(addLabel);
    addWrap.appendChild(addLabelWrap);

    const addControls = document.createElement('div');
    addControls.className = 'rss-add-controls';

    const urlInput = document.createElement('input');
    urlInput.type = 'url';
    urlInput.id = 'rss-url-input';
    urlInput.className = 'modal-input';
    urlInput.placeholder = 'https://example.com/feed.xml';
    addControls.appendChild(urlInput);

    const addBtn = document.createElement('button');
    addBtn.id = 'rss-add-btn';
    addBtn.className = 'modal-btn';
    addBtn.textContent = api.getMessage('addRssSubscription') || 'Add';
    addControls.appendChild(addBtn);

    const errorMsg = document.createElement('div');
    errorMsg.id = 'rss-error-message';
    errorMsg.className = 'rss-error-message hidden';
    addControls.appendChild(errorMsg);

    addWrap.appendChild(addControls);
    container.appendChild(addWrap);

    // --- Subscription list container ---
    const listContainer = document.createElement('div');
    listContainer.id = 'rss-subscriptions-list';
    container.appendChild(listContainer);

    // --- Render subscription list ---
    async function renderList() {
        listContainer.innerHTML = '';
        const subscriptions = rss.getSubscriptions();

        if (subscriptions.length === 0) {
            const emptyMsg = document.createElement('p');
            emptyMsg.className = 'rss-empty';
            emptyMsg.textContent = api.getMessage('rssNoSubscriptions') || 'No RSS subscriptions yet.';
            listContainer.appendChild(emptyMsg);
            return;
        }

        const fragment = document.createDocumentFragment();

        subscriptions.forEach(sub => {
            const item = document.createElement('div');
            item.className = 'rss-subscription-item';
            item.dataset.id = sub.id;

            const info = document.createElement('div');
            info.className = 'rss-subscription-info';

            const titleSpan = document.createElement('span');
            titleSpan.className = 'rss-subscription-title';
            titleSpan.textContent = sub.title;
            info.appendChild(titleSpan);

            const urlSpan = document.createElement('span');
            urlSpan.className = 'rss-subscription-url';
            urlSpan.textContent = sub.url;
            info.appendChild(urlSpan);

            const intervalSelect = document.createElement('select');
            intervalSelect.className = 'modal-select rss-interval-select';
            intervalSelect.title = api.getMessage('rssIntervalLabel') || 'Fetch interval';
            ['1h', '3h', '8h', '12h', '24h'].forEach(val => {
                const opt = document.createElement('option');
                opt.value = val;
                opt.textContent = val;
                if (sub.interval === val) opt.selected = true;
                intervalSelect.appendChild(opt);
            });
            info.appendChild(intervalSelect);

            const actions = document.createElement('div');
            actions.className = 'rss-subscription-actions';

            const fetchBtn = document.createElement('button');
            fetchBtn.className = 'rss-fetch-now-btn';
            fetchBtn.title = api.getMessage('rssFetchNowButton') || 'Fetch now';
            fetchBtn.setAttribute('aria-label', api.getMessage('rssFetchNowButton') || 'Fetch now');
            fetchBtn.textContent = '🔄';
            actions.appendChild(fetchBtn);

            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'rss-toggle-btn';
            toggleBtn.dataset.action = sub.enabled ? 'pause' : 'resume';
            toggleBtn.title = sub.enabled
                ? (api.getMessage('rssPauseButton') || 'Pause')
                : (api.getMessage('rssResumeButton') || 'Resume');
            toggleBtn.setAttribute('aria-label', toggleBtn.title);
            toggleBtn.textContent = sub.enabled ? '⏸' : '▶';
            actions.appendChild(toggleBtn);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'rss-delete-btn';
            deleteBtn.title = api.getMessage('rssDeleteButton') || 'Delete';
            deleteBtn.setAttribute('aria-label', api.getMessage('rssDeleteButton') || 'Delete');
            deleteBtn.textContent = '×';
            actions.appendChild(deleteBtn);

            item.appendChild(info);
            item.appendChild(actions);
            fragment.appendChild(item);
        });

        listContainer.appendChild(fragment);

        // --- Bind event listeners ---

        listContainer.querySelectorAll('.rss-fetch-now-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const item = e.target.closest('.rss-subscription-item');
                const id = item.dataset.id;
                const originalContent = btn.innerHTML;
                btn.disabled = true;
                btn.textContent = '...';

                const statusMsg = document.createElement('div');
                statusMsg.className = 'rss-fetch-status';
                statusMsg.textContent = api.getMessage('rssFetching') || 'Fetching...';
                item.appendChild(statusMsg);

                try {
                    const added = await rss.fetchNow(id);
                    if (added > 0) {
                        statusMsg.textContent = `Fetched ${added} new item${added === 1 ? '' : 's'}`;
                        statusMsg.classList.add('success');
                    } else {
                        statusMsg.textContent = 'No new items';
                    }
                    // NOTE: no CustomEvent('readingListUpdated') dispatch — options page
                    // and sidepanel run in separate contexts; CustomEvent cannot cross them.
                    // The sidepanel will reflect new items on next open via storage.
                    setTimeout(() => statusMsg.remove(), 2000);
                } catch (err) {
                    statusMsg.textContent = err.message || 'Fetch failed';
                    statusMsg.classList.add('error');
                    setTimeout(() => statusMsg.remove(), 3000);
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = originalContent;
                }
            });
        });

        listContainer.querySelectorAll('.rss-toggle-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const item = e.target.closest('.rss-subscription-item');
                const id = item.dataset.id;
                const action = e.target.dataset.action;
                await rss.updateSubscription(id, { enabled: action === 'resume' });
                await renderList();
            });
        });

        listContainer.querySelectorAll('.rss-interval-select').forEach(select => {
            select.addEventListener('change', async (e) => {
                const item = e.target.closest('.rss-subscription-item');
                const id = item.dataset.id;
                await rss.updateSubscription(id, { interval: e.target.value });
            });
        });

        listContainer.querySelectorAll('.rss-delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const item = e.target.closest('.rss-subscription-item');
                const id = item.dataset.id;
                const title = item.querySelector('.rss-subscription-title').textContent;
                const confirmed = window.confirm(
                    (api.getMessage('confirmDeleteRss', title)) ||
                    `Delete subscription "${title}"?`
                );
                if (confirmed) {
                    await rss.removeSubscription(id);
                    await renderList();
                }
            });
        });
    }

    // --- Add subscription handler ---
    addBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if (!url) return;

        addBtn.disabled = true;
        addBtn.textContent = '...';
        errorMsg.classList.add('hidden');

        try {
            await rss.addSubscription(url);
            urlInput.value = '';
            await renderList();
        } catch (err) {
            let msg;
            if (err.message.includes('timeout')) {
                msg = api.getMessage('rssErrorTimeout');
            } else if (err.message.includes('Already subscribed')) {
                msg = api.getMessage('rssErrorAlreadySubscribed');
            } else {
                msg = api.getMessage('rssErrorFetchFailed') || err.message;
            }
            errorMsg.textContent = msg;
            errorMsg.classList.remove('hidden');
        } finally {
            addBtn.disabled = false;
            addBtn.textContent = api.getMessage('addRssSubscription') || 'Add';
        }
    });

    // Allow pressing Enter in the URL input to trigger Add
    urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addBtn.click();
    });

    // Initial render
    await renderList();
}

/**
 * Maps an AI availability status string to a badge display object.
 * Mirrors the same helper in settingManager.js (getStatusBadge).
 * @param {string} status
 * @returns {{emoji: string, className: string}}
 */
function getStatusBadge(status) {
    switch (status) {
        case 'available':   return { emoji: '✅ Available',   className: 'available' };
        case 'downloading': return { emoji: '⏳ Downloading', className: 'downloading' };
        case 'downloadable':return { emoji: '📥 Downloadable',className: 'downloadable' };
        default:            return { emoji: '❌ Unavailable', className: 'unavailable' };
    }
}

/**
 * 渲染 AI 模型狀態區塊：LanguageModel + Summarizer 可用性標誌、下載進度條、
 * 以及引導使用者開啟 chrome://flags 的設定指南。
 * chrome:// 連結透過 chrome.tabs.create({url}) 開啟，因為 <a href="chrome://..."> 被瀏覽器封鎖。
 * @param {HTMLElement} container
 */
async function renderAi(container) {
    const h = document.createElement('h2');
    h.textContent = api.getMessage('settingsNavAi') || 'AI & Experimental';
    container.appendChild(h);

    // --- Model status header ---
    const statusSection = document.createElement('div');
    statusSection.className = 'ai-model-status-section';

    const statusHeader = document.createElement('div');
    statusHeader.className = 'ai-model-status-header';
    statusHeader.textContent = 'Gemini Nano';
    statusSection.appendChild(statusHeader);

    // LanguageModel row
    const lmRow = document.createElement('div');
    lmRow.className = 'ai-model-status-row';
    const lmLabel = document.createElement('span');
    lmLabel.className = 'ai-model-status-label';
    lmLabel.textContent = 'LanguageModel';
    const lmBadge = document.createElement('span');
    lmBadge.id = 'ai-lm-status-badge';
    lmBadge.className = 'ai-status-badge checking';
    lmBadge.textContent = '⏳';
    lmRow.appendChild(lmLabel);
    lmRow.appendChild(lmBadge);
    statusSection.appendChild(lmRow);

    // Summarizer row
    const sumRow = document.createElement('div');
    sumRow.className = 'ai-model-status-row';
    const sumLabel = document.createElement('span');
    sumLabel.className = 'ai-model-status-label';
    sumLabel.textContent = 'Summarizer';
    const sumBadge = document.createElement('span');
    sumBadge.id = 'ai-sum-status-badge';
    sumBadge.className = 'ai-status-badge checking';
    sumBadge.textContent = '⏳';
    sumRow.appendChild(sumLabel);
    sumRow.appendChild(sumBadge);
    statusSection.appendChild(sumRow);

    // Progress bar (hidden until download is in progress)
    const progressContainer = document.createElement('div');
    progressContainer.id = 'ai-settings-progress-container';
    progressContainer.className = 'ai-settings-progress-wrap';
    progressContainer.hidden = true;
    const progressBar = document.createElement('div');
    progressBar.className = 'ai-progress';
    const progressFill = document.createElement('div');
    progressFill.className = 'ai-progress__fill';
    progressFill.id = 'ai-settings-progress-fill';
    progressBar.appendChild(progressFill);
    const progressText = document.createElement('span');
    progressText.id = 'ai-settings-progress-text';
    progressText.className = 'ai-progress-text';
    progressContainer.appendChild(progressBar);
    progressContainer.appendChild(progressText);
    statusSection.appendChild(progressContainer);

    container.appendChild(statusSection);

    // --- Setup guide ---
    const guide = document.createElement('div');
    guide.className = 'ai-setup-guide';

    const guideTitle = document.createElement('div');
    guideTitle.className = 'ai-setup-guide-title';
    guideTitle.textContent = api.getMessage('aiSetupGuideTitle') || 'How to Enable Gemini Nano';
    guide.appendChild(guideTitle);

    const steps = [
        { textKey: 'aiSetupStep1',  url: 'chrome://flags/#optimization-guide-on-device-model' },
        { textKey: 'aiSetupStep2',  url: 'chrome://flags/#prompt-api-for-gemini-nano' },
        { textKey: 'aiSetupStep2b', url: 'chrome://flags/#prompt-api-for-gemini-nano-multimodal-input' },
        { textKey: 'aiSetupStep3',  url: 'chrome://on-device-internals' },
        { textKey: 'aiSetupStep4',  url: 'chrome://components' },
    ];

    const ol = document.createElement('ol');
    ol.className = 'ai-setup-steps';
    for (const step of steps) {
        const li = document.createElement('li');
        const stepText = document.createElement('span');
        stepText.textContent = api.getMessage(step.textKey) || step.textKey;
        li.appendChild(stepText);

        const openBtn = document.createElement('button');
        openBtn.className = 'ai-setup-link-btn';
        openBtn.textContent = (api.getMessage('aiSetupOpenLink') || 'Open') + ' ↗';
        openBtn.addEventListener('click', () => {
            chrome.tabs.create({ url: step.url });
        });
        li.appendChild(openBtn);
        ol.appendChild(li);
    }
    guide.appendChild(ol);

    const restartNote = document.createElement('div');
    restartNote.className = 'ai-setup-restart-note';
    restartNote.textContent = api.getMessage('aiSetupRestartNote') || '⚠️ Restart Chrome after changing the flags above.';
    guide.appendChild(restartNote);

    container.appendChild(guide);

    // --- Async status detection (mirrors detectAiModelStatus in settingManager.js) ---
    (async () => {
        // LanguageModel
        const lmStatus = await checkModelAvailability();
        const lmBadgeInfo = getStatusBadge(lmStatus);
        lmBadge.textContent = lmBadgeInfo.emoji;
        lmBadge.className = `ai-status-badge ${lmBadgeInfo.className}`;

        // Summarizer — call Summarizer.availability() directly (same as settingManager)
        let sumStatus = 'unavailable';
        if ('Summarizer' in self) {
            try { sumStatus = await Summarizer.availability() || 'unavailable'; } catch { /* ignore */ }
        }
        const sumBadgeInfo = getStatusBadge(sumStatus);
        sumBadge.textContent = sumBadgeInfo.emoji;
        sumBadge.className = `ai-status-badge ${sumBadgeInfo.className}`;

        // Trigger download + show progress if needed
        if (lmStatus === 'downloadable' || lmStatus === 'downloading') {
            progressContainer.hidden = false;
            if (lmStatus === 'downloading') {
                progressBar.classList.add('shimmer');
                progressText.textContent = 'Downloading...';
            } else {
                progressText.textContent = 'Waiting to download...';
            }

            try {
                await triggerLanguageModelDownload({
                    onProgress(loaded) {
                        if (loaded >= 1) {
                            progressBar.classList.add('shimmer');
                            progressText.textContent = 'Loading into memory...';
                        } else {
                            progressBar.classList.remove('shimmer');
                            progressFill.style.width = `${Math.round(loaded * 100)}%`;
                            progressText.textContent = `${Math.round(loaded * 100)}%`;
                        }
                    }
                });
            } catch (err) {
                console.warn('[AI] Download trigger failed:', err);
            }

            const newStatus = await checkModelAvailability();
            const newBadge = getStatusBadge(newStatus);
            lmBadge.textContent = newBadge.emoji;
            lmBadge.className = `ai-status-badge ${newBadge.className}`;
            progressContainer.hidden = true;
        }
    })();
}

/**
 * 渲染快捷鍵設定區塊：顯示目前的 Chrome 命令快捷鍵，
 * 以及側邊欄內部的鍵盤快捷鍵列表。
 * 「管理快捷鍵」按鈕透過 chrome.tabs.create 開啟 chrome://extensions/shortcuts。
 * @param {HTMLElement} container
 */
async function renderShortcuts(container) {
    const h = document.createElement('h2');
    h.textContent = api.getMessage('settingsNavShortcuts') || 'Shortcuts';
    container.appendChild(h);

    // --- Fetch current command shortcuts via chrome.commands.getAll() ---
    let currentShortcut = 'N/A';
    let newTabRightShortcut = 'N/A';
    try {
        const commands = await chrome.commands.getAll();
        const toggleCmd = commands.find(cmd => cmd.name === '_execute_action');
        if (toggleCmd && toggleCmd.shortcut) currentShortcut = toggleCmd.shortcut;
        const newTabRightCmd = commands.find(cmd => cmd.name === 'create-new-tab-right');
        if (newTabRightCmd && newTabRightCmd.shortcut) newTabRightShortcut = newTabRightCmd.shortcut;
    } catch (err) {
        console.error('Failed to get commands:', err);
    }

    // Explanation text
    const explanation = document.createElement('p');
    explanation.textContent = api.getMessage('shortcutExplanation') || 'You can customize the extension\'s shortcuts on Chrome\'s management page.';
    container.appendChild(explanation);

    // Current shortcut row
    const openPanelLabel = document.createElement('span');
    openPanelLabel.textContent = (api.getMessage('currentShortcutLabel') || 'Current Shortcut:') + ' ';
    const openPanelKbd = document.createElement('kbd');
    openPanelKbd.textContent = currentShortcut;
    const openPanelP = document.createElement('p');
    openPanelP.appendChild(openPanelLabel);
    openPanelP.appendChild(openPanelKbd);
    container.appendChild(openPanelP);

    // New tab right shortcut row
    const newTabLabel = document.createElement('span');
    newTabLabel.textContent = (api.getMessage('settingsShortcutCreateTabRight') || 'Create new tab on the right:') + ' ';
    const newTabKbd = document.createElement('kbd');
    newTabKbd.textContent = newTabRightShortcut;
    const newTabP = document.createElement('p');
    newTabP.appendChild(newTabLabel);
    newTabP.appendChild(newTabKbd);
    container.appendChild(newTabP);

    // Button to open chrome://extensions/shortcuts
    const manageBtn = document.createElement('button');
    manageBtn.className = 'modal-btn';
    manageBtn.textContent = api.getMessage('shortcutLinkText') || 'Manage Extension Shortcuts';
    manageBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
    });
    container.appendChild(manageBtn);

    // In-sidepanel shortcuts sub-section
    const inPanelHeader = document.createElement('h4');
    inPanelHeader.className = 'settings-subsection-header';
    inPanelHeader.style.marginTop = '12px';
    inPanelHeader.textContent = api.getMessage('shortcutInSidepanelHeader') || 'In-sidepanel shortcuts';
    container.appendChild(inPanelHeader);

    const shortcutItems = [
        { keys: ['⌘K', 'Ctrl+K'],  descKey: 'shortcutDescCommandPalette', fallback: 'Open Command Palette' },
        { keys: ['↑', '↓'],        descKey: 'shortcutDescPaletteNav',     fallback: 'Navigate Command Palette results' },
        { keys: ['Enter'],          descKey: 'shortcutDescPaletteSelect',  fallback: 'Activate selected result' },
        { keys: ['Esc'],            descKey: 'shortcutDescPaletteClose',   fallback: 'Close Command Palette' },
    ];

    const ul = document.createElement('ul');
    ul.className = 'settings-shortcut-list';
    for (const item of shortcutItems) {
        const li = document.createElement('li');
        for (const key of item.keys) {
            const kbd = document.createElement('kbd');
            kbd.textContent = key;
            li.appendChild(kbd);
            li.appendChild(document.createTextNode(' '));
        }
        li.appendChild(document.createTextNode('— ' + (api.getMessage(item.descKey) || item.fallback)));
        ul.appendChild(li);
    }
    container.appendChild(ul);

    const note = document.createElement('p');
    note.className = 'settings-shortcut-note';
    note.textContent = api.getMessage('shortcutInSidepanelNote') || 'These run inside the sidepanel only and cannot be remapped via the Chrome shortcuts page.';
    container.appendChild(note);
}

/**
 * 渲染「關於」區塊：專案說明文字、官方網站連結、GitHub 連結。
 * 外部 https 連結使用正常 <a> 元素（target="_blank" rel="noopener"）。
 * @param {HTMLElement} container
 */
function renderAbout(container) {
    const h = document.createElement('h2');
    h.textContent = api.getMessage('aboutSectionHeader') || 'About';
    container.appendChild(h);

    const aboutP = document.createElement('p');
    aboutP.textContent = api.getMessage('aboutText') || 'This project is open source. You are welcome to join the development! Star us on GitHub!';
    container.appendChild(aboutP);

    const websiteLink = document.createElement('a');
    websiteLink.href = 'https://sidebar-for-tabs-bookmarks.taislife.work/';
    websiteLink.target = '_blank';
    websiteLink.rel = 'noopener';
    websiteLink.className = 'modal-link-button';
    websiteLink.textContent = api.getMessage('officialWebsiteLinkText') || 'Official Website';
    container.appendChild(websiteLink);

    const githubLink = document.createElement('a');
    githubLink.href = 'https://github.com/Tai-ch0802/arc-like-chrome-extension';
    githubLink.target = '_blank';
    githubLink.rel = 'noopener';
    githubLink.className = 'modal-link-button';
    githubLink.style.marginTop = '8px';
    githubLink.textContent = api.getMessage('githubLinkText') || 'View on GitHub';
    container.appendChild(githubLink);
}

const SECTIONS = [
    { id: 'appearance', labelKey: 'settingsNavAppearance', render: renderAppearance },
    { id: 'language',   labelKey: 'settingsNavLanguage',   render: renderLanguage },
    { id: 'features',   labelKey: 'settingsNavFeatures',   render: renderFeatures },
    { id: 'ai',         labelKey: 'settingsNavAi',         render: renderAi },
    { id: 'rss',        labelKey: 'settingsNavRss',        render: renderRss },
    { id: 'shortcuts',  labelKey: 'settingsNavShortcuts',  render: renderShortcuts },
    { id: 'about',      labelKey: 'settingsNavAbout',      render: renderAbout },
];

async function applyOwnTheme() {
    try {
        const { theme } = await api.getStorage('sync', { theme: 'geek' });
        if (theme === 'custom') { await customTheme.loadAndApplyCustomTheme(); }
        else { applyTheme(theme); }
    } catch (e) { console.warn('options theme apply failed', e); }
}

function buildNav(navEl, contentEl) {
    const sectionEls = {};
    for (const s of SECTIONS) {
        const btn = document.createElement('button');
        btn.className = 'opt-nav__item';
        btn.dataset.section = s.id;
        btn.textContent = api.getMessage(s.labelKey) || s.id;
        btn.addEventListener('click', () => activate(s.id));
        navEl.appendChild(btn);

        const sec = document.createElement('section');
        sec.className = 'opt-section';
        sec.dataset.section = s.id;
        contentEl.appendChild(sec);
        s.render(sec);
        sectionEls[s.id] = { btn, sec };
    }
    function activate(id) {
        for (const [sid, { btn, sec }] of Object.entries(sectionEls)) {
            const on = sid === id;
            btn.classList.toggle('active', on);
            sec.classList.toggle('active', on);
        }
    }
    activate(SECTIONS[0].id);
}

document.addEventListener('DOMContentLoaded', () => {
    applyOwnTheme();
    buildNav(document.getElementById('opt-nav'), document.getElementById('opt-content'));
});
