import * as api from './modules/apiManager.js';
import { applyTheme } from './modules/ui/settingManager.js';
import * as customTheme from './modules/ui/customThemeManager.js';
import * as bgImage from './modules/ui/backgroundImageManager.js';
import * as rss from './modules/rssManager.js';
import { checkBuiltinModelAvailability, triggerLanguageModelDownload } from './modules/aiManager.js';
import * as providerSettings from './modules/ai/providerSettings.js';
import { getCloudProvider } from './modules/ai/providers/index.js';
import { isInsecureRemoteBaseUrl } from './modules/ai/providers/httpUtils.js';
import * as modalManager from './modules/modalManager.js';
import * as driveAuth from './modules/sync/driveAuth.js';
import * as workspaceManager from './modules/workspace/workspaceManager.js';
import { renderIcon } from './modules/icons.js';

const THEME_OPTIONS = [
    { value: 'geek', labelKey: 'themeOptionGeek' },
    { value: 'google', labelKey: 'themeOptionGoogle' },
    { value: 'darcula', labelKey: 'themeOptionDarcula' },
    { value: 'geek-blue', labelKey: 'themeOptionGeekBlue' },
    { value: 'christmas', labelKey: 'themeOptionChristmas' },
    { value: 'custom', labelKey: 'themeOptionCustom' }
];

const DENSITY_OPTIONS = [
    { value: 'compact', labelKey: 'densityOptionCompact' },
    { value: 'cozy', labelKey: 'densityOptionCozy' },
    { value: 'comfortable', labelKey: 'densityOptionComfortable' }
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

    // --- List density select ---
    const { listDensity: storedDensity } = await api.getStorage('sync', { listDensity: 'cozy' });
    const densitySelect = document.createElement('select');
    densitySelect.id = 'density-select-dropdown';
    densitySelect.className = 'modal-select';
    for (const opt of DENSITY_OPTIONS) {
        const o = document.createElement('option');
        o.value = opt.value;
        o.textContent = api.getMessage(opt.labelKey) || opt.value;
        if (opt.value === (storedDensity || 'cozy')) o.selected = true;
        densitySelect.appendChild(o);
    }
    // 只寫 storage;側邊欄透過 settingsBridge 的 storage.onChanged 即時套用密度。
    densitySelect.addEventListener('change', async (event) => {
        await api.setStorage('sync', { listDensity: event.target.value });
    });
    container.appendChild(
        makeRow(api.getMessage('densitySectionHeader') || 'List spacing', densitySelect)
    );

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
    spBtn.className = 'modal-button';
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
        key: 'pageReaderVisible',
        defaultVal: true,
        labelKey: 'pageReaderToggleLabel',
        descKey: 'pageReaderDescription',
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

    // Cross-device sync hint: sign in to Google to sync RSS subscriptions and
    // dedup history across devices (and stop re-fetching duplicates).
    const syncHint = document.createElement('p');
    syncHint.className = 'opt-row__desc';
    syncHint.textContent = api.getMessage('rssSyncHint')
        || 'Sign in to Google under Backup & Sync to sync your RSS subscriptions and reading history across devices and avoid re-fetching duplicates.';
    container.appendChild(syncHint);

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
    addBtn.className = 'modal-button';
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
            fetchBtn.innerHTML = renderIcon('refresh', { size: 16 });
            actions.appendChild(fetchBtn);

            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'rss-toggle-btn';
            toggleBtn.dataset.action = sub.enabled ? 'pause' : 'resume';
            toggleBtn.title = sub.enabled
                ? (api.getMessage('rssPauseButton') || 'Pause')
                : (api.getMessage('rssResumeButton') || 'Resume');
            toggleBtn.setAttribute('aria-label', toggleBtn.title);
            toggleBtn.innerHTML = renderIcon(sub.enabled ? 'pause' : 'play_arrow', { size: 16 });
            actions.appendChild(toggleBtn);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'rss-delete-btn';
            deleteBtn.title = api.getMessage('rssDeleteButton') || 'Delete';
            deleteBtn.setAttribute('aria-label', api.getMessage('rssDeleteButton') || 'Delete');
            deleteBtn.innerHTML = renderIcon('close', { size: 16 });
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
            btn.addEventListener('click', async () => {
                // Read state off `btn` (the listener's element), NOT e.target: the
                // button's innerHTML is an inline SVG, so a click lands on the <path>
                // child, whose dataset.action is undefined — which silently coerced
                // every toggle to enabled:false and made "resume" impossible.
                const item = btn.closest('.rss-subscription-item');
                const id = item.dataset.id;
                const action = btn.dataset.action;
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

// Privacy policy (data goes to the user's OWN Drive app-private folder).
const PRIVACY_POLICY_URL = 'https://sidebar-for-tabs-bookmarks.taislife.work/privacy.html';

/**
 * Formats a timestamp as a coarse relative time ("just now", "5 min ago",
 * "3 hr ago", "2 days ago"). Intentionally tiny — used only for the sync
 * status line, so day-level granularity is plenty.
 * @param {number} ts epoch ms
 * @returns {string}
 */
function relativeTime(ts) {
    if (!ts || typeof ts !== 'number') return '';
    const diffSec = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (diffSec < 60) return api.getMessage('syncTimeJustNow') || 'just now';
    const min = Math.round(diffSec / 60);
    if (min < 60) return (api.getMessage('syncTimeMinAgo', String(min)) || `${min} min ago`);
    const hr = Math.round(min / 60);
    if (hr < 24) return (api.getMessage('syncTimeHrAgo', String(hr)) || `${hr} hr ago`);
    const day = Math.round(hr / 24);
    return (api.getMessage('syncTimeDayAgo', String(day)) || `${day} day${day === 1 ? '' : 's'} ago`);
}

/**
 * 渲染「備份與同步」(Backup & Sync) 區塊：Google Drive 連線、同步狀態、
 * 立即同步、每個 workspace 的同步 opt-in、可從 Drive 還原的清單、
 * 衝突提示與隱私聲明。
 *
 * 渲染策略：mirror renderAi —— 同步先畫出 skeleton（不做任何 I/O / identity 呼叫），
 * 然後在 async IIFE 內 hydrate（isConnected / storage 讀取 / workspace 清單）。
 * 這是因為 buildNav 在頁面載入時就 eager 呼叫所有 render()，若在 render 內同步呼叫
 * chrome.identity.getAuthToken，每次開啟 options 都會觸發 OAuth 流程。
 *
 * 持久化：UI 只送 message + 讀 storage，不 dispatch CustomEvent。狀態變更由
 * background → storage 流動（E4b 加入 sidepanel bridge）。
 * @param {HTMLElement} container
 */
function renderSync(container) {
    const h = document.createElement('h2');
    h.textContent = api.getMessage('settingsNavSync') || 'Backup & Sync';
    container.appendChild(h);

    // --- 1. Account block (skeleton) ---
    const accountBlock = document.createElement('div');
    accountBlock.className = 'sync-account-block';
    container.appendChild(accountBlock);

    // --- 2. Status row (skeleton) ---
    const statusBlock = document.createElement('div');
    container.appendChild(statusBlock);

    // --- 3. Actions (skeleton) ---
    const actionsBlock = document.createElement('div');
    container.appendChild(actionsBlock);

    // --- 4. Per-workspace opt-in list (skeleton) ---
    const optInHeader = document.createElement('h4');
    optInHeader.className = 'settings-subsection-header';
    optInHeader.style.marginTop = '12px';
    optInHeader.textContent = api.getMessage('syncWorkspacesHeader') || 'Workspaces to sync';
    container.appendChild(optInHeader);
    const optInBlock = document.createElement('div');
    container.appendChild(optInBlock);

    // --- 5. Restorable list (skeleton) ---
    const restoreHeader = document.createElement('h4');
    restoreHeader.className = 'settings-subsection-header';
    restoreHeader.style.marginTop = '12px';
    restoreHeader.textContent = api.getMessage('syncRestorableHeader') || 'Available on Drive';
    container.appendChild(restoreHeader);
    const restoreBlock = document.createElement('div');
    container.appendChild(restoreBlock);

    // --- 6. Conflict review (skeleton) ---
    const conflictBlock = document.createElement('div');
    container.appendChild(conflictBlock);

    // --- 7. Privacy fine-print (persistent) ---
    const fineprint = document.createElement('p');
    fineprint.className = 'opt-row__desc sync-privacy-note';
    fineprint.style.marginTop = '16px';
    fineprint.appendChild(document.createTextNode(
        (api.getMessage('syncPrivacyNote') ||
            'Your tab URLs, titles, and group info for opted-in workspaces are stored only in your own Google Drive (an app-private folder). ') + ' '
    ));
    const policyLink = document.createElement('a');
    policyLink.href = PRIVACY_POLICY_URL;
    policyLink.target = '_blank';
    policyLink.rel = 'noopener';
    policyLink.textContent = api.getMessage('syncPrivacyPolicyLink') || 'Privacy Policy';
    fineprint.appendChild(policyLink);
    container.appendChild(fineprint);

    /**
     * Hydrate all dynamic blocks from identity + storage + workspace state.
     * Called after the skeleton paints and re-called after any mutating action.
     */
    async function hydrate() {
        let connected = false;
        try {
            connected = await driveAuth.isConnected();
        } catch { connected = false; }

        // workspaceManager runs in its own module instance in this page context;
        // ensure the in-memory store is loaded before getAllWorkspaces().
        try { await workspaceManager.initWorkspaces(); } catch { /* best-effort */ }

        const { driveSyncStatus, driveRestorable } = await api.getStorage('local', {
            driveSyncStatus: { state: 'idle' },
            driveRestorable: [],
        });
        const status = driveSyncStatus || { state: 'idle' };
        const restorable = Array.isArray(driveRestorable) ? driveRestorable : [];

        // ===== 1. Account block =====
        accountBlock.innerHTML = '';
        if (connected) {
            const connectedLabel = document.createElement('div');
            connectedLabel.className = 'opt-row__label';
            connectedLabel.textContent = api.getMessage('syncConnected') || 'Connected to Google Drive';
            const disconnectBtn = document.createElement('button');
            disconnectBtn.className = 'modal-button primary';
            disconnectBtn.textContent = api.getMessage('syncDisconnectButton') || 'Disconnect';
            disconnectBtn.addEventListener('click', async () => {
                const confirmed = await modalManager.showConfirm({
                    title: api.getMessage('syncDisconnectConfirmTitle') || 'Disconnect Google Drive?',
                    message: api.getMessage('syncDisconnectConfirmMessage') ||
                        'Uploads will stop. Workspaces already on Drive are kept; nothing is deleted.',
                    confirmButtonText: api.getMessage('syncDisconnectButton') || 'Disconnect',
                });
                if (!confirmed) return;
                disconnectBtn.disabled = true;
                try {
                    await chrome.runtime.sendMessage({ action: 'driveDisconnect' });
                } catch (err) {
                    console.warn('[sync] disconnect failed:', err);
                }
                await hydrate();
            });
            accountBlock.appendChild(makeRow(connectedLabel.textContent, disconnectBtn));
        } else {
            const connectBtn = document.createElement('button');
            connectBtn.className = 'modal-button primary';
            connectBtn.textContent = api.getMessage('syncConnectButton') || 'Connect Google Drive';
            const connectNote = document.createElement('div');
            connectNote.className = 'opt-row__desc sync-connect-note';
            connectNote.hidden = true;

            connectBtn.addEventListener('click', async () => {
                // Privacy disclosure gated BEFORE any auth call.
                const confirmed = await modalManager.showConfirm({
                    title: api.getMessage('syncConnectDisclosureTitle') || 'Connect Google Drive',
                    message: api.getMessage('syncConnectDisclosureMessage') ||
                        'This uploads tab URLs, titles, and group info for the workspaces you opt in to your own Google Drive (an app-private folder). Sync is opt-in per workspace and OFF by default. Disconnecting stops all uploads.',
                    confirmButtonText: api.getMessage('syncConnectButton') || 'Connect Google Drive',
                });
                if (!confirmed) return;

                connectBtn.disabled = true;
                connectNote.hidden = true;
                let resp;
                try {
                    resp = await chrome.runtime.sendMessage({ action: 'driveConnect' });
                } catch (err) {
                    resp = { ok: false, error: err && err.message };
                }
                connectBtn.disabled = false;

                if (!resp || !resp.ok) {
                    // Graceful failure: most commonly a missing/placeholder OAuth
                    // client_id, or this is not Google Chrome. Surface a note
                    // rather than hanging.
                    connectNote.hidden = false;
                    connectNote.textContent = api.getMessage('syncConnectFailedNote') ||
                        'Could not connect. Google Drive sync requires Google Chrome with sign-in available.';
                }
                await hydrate();
            });

            accountBlock.appendChild(makeRow(
                api.getMessage('syncNotConnected') || 'Not connected',
                connectBtn,
                api.getMessage('syncAccountDesc') || 'Back up and sync your workspaces across devices via your own Google Drive.'
            ));
            accountBlock.appendChild(connectNote);
        }

        // ===== 2. Status row =====
        statusBlock.innerHTML = '';
        let statusText;
        let retryBtn = null;
        if (!connected) {
            statusText = api.getMessage('syncStatusNotConnected') || 'Not connected';
        } else {
            switch (status.state) {
                case 'syncing':
                    statusText = api.getMessage('syncStatusSyncing') || 'Syncing…';
                    break;
                case 'error':
                    statusText = (api.getMessage('syncStatusError') || 'Error') +
                        (status.message ? `: ${status.message}` : '');
                    retryBtn = document.createElement('button');
                    retryBtn.className = 'modal-button';
                    retryBtn.textContent = api.getMessage('syncRetryButton') || 'Retry';
                    break;
                case 'conflict':
                    statusText = api.getMessage('syncStatusConflict') || 'Conflict detected';
                    break;
                case 'offline':
                    statusText = api.getMessage('syncStatusOffline') || 'Offline';
                    break;
                case 'needs-auth':
                    statusText = api.getMessage('syncStatusNeedsAuth') || 'Sign-in required';
                    break;
                case 'drive-full':
                    statusText = api.getMessage('syncStatusDriveFull') || 'Google Drive is full';
                    break;
                case 'idle':
                default: {
                    if (status.lastSyncedAt) {
                        statusText = (api.getMessage('syncStatusLastSynced',
                            relativeTime(status.lastSyncedAt)) ||
                            `Last synced ${relativeTime(status.lastSyncedAt)}`);
                    } else {
                        statusText = api.getMessage('syncStatusIdle') || 'Idle';
                    }
                    break;
                }
            }
        }
        const statusLabel = document.createElement('span');
        statusLabel.className = 'sync-status-label';
        statusLabel.textContent = statusText;
        statusBlock.appendChild(makeRow(
            api.getMessage('syncStatusRowLabel') || 'Status',
            retryBtn || statusLabel,
            retryBtn ? statusText : undefined
        ));
        if (retryBtn) {
            retryBtn.addEventListener('click', async () => {
                retryBtn.disabled = true;
                try {
                    await chrome.runtime.sendMessage({ action: 'driveSyncNow' });
                } catch (err) { console.warn('[sync] retry failed:', err); }
                await hydrate();
            });
        }

        // ===== 3. Actions =====
        actionsBlock.innerHTML = '';
        const syncNowBtn = document.createElement('button');
        syncNowBtn.className = 'modal-button primary';
        syncNowBtn.textContent = api.getMessage('syncNowButton') || 'Sync now';
        syncNowBtn.disabled = !connected;
        syncNowBtn.addEventListener('click', async () => {
            syncNowBtn.disabled = true;
            try {
                await chrome.runtime.sendMessage({ action: 'driveSyncNow' });
            } catch (err) { console.warn('[sync] sync now failed:', err); }
            await hydrate();
        });
        actionsBlock.appendChild(makeRow(
            api.getMessage('syncNowLabel') || 'Manual sync',
            syncNowBtn
        ));

        // ===== 4. Per-workspace opt-in list =====
        optInBlock.innerHTML = '';
        const workspaces = workspaceManager.getAllWorkspaces();
        if (workspaces.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'rss-empty';
            empty.textContent = api.getMessage('syncNoWorkspaces') || 'No workspaces yet.';
            optInBlock.appendChild(empty);
        } else {
            for (const ws of workspaces) {
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = `sync-ws-${ws.id}`;
                checkbox.checked = ws.syncEnabled === true;
                checkbox.disabled = !connected;
                checkbox.addEventListener('change', async (e) => {
                    // UI only sends a message; background persists + flushes.
                    try {
                        await chrome.runtime.sendMessage({
                            action: 'driveSetWorkspaceSync',
                            workspaceId: ws.id,
                            enabled: e.target.checked,
                        });
                    } catch (err) {
                        console.warn('[sync] setWorkspaceSync failed:', err);
                    }
                    // Re-hydrate so the checkbox reflects the actual persisted state
                    // (a failed message would otherwise leave a stale optimistic tick).
                    await hydrate();
                });
                const name = ws.name || ws.id;
                optInBlock.appendChild(makeRow(
                    `${ws.icon ? ws.icon + ' ' : ''}${name}`,
                    checkbox
                ));
            }
        }

        // ===== 5. Restorable list =====
        restoreBlock.innerHTML = '';
        const localIds = new Set(workspaces.map((w) => w.id));
        const restorableNotLocal = restorable.filter((r) => r && r.id && !localIds.has(r.id));
        restoreHeader.hidden = restorableNotLocal.length === 0;
        if (restorableNotLocal.length === 0) {
            restoreBlock.hidden = true;
        } else {
            restoreBlock.hidden = false;
            for (const entry of restorableNotLocal) {
                const name = (entry.metadata && entry.metadata.name) || entry.name || entry.id;
                const restoreBtn = document.createElement('button');
                restoreBtn.className = 'modal-button';
                restoreBtn.textContent = api.getMessage('syncRestoreButton') || 'Restore';
                restoreBtn.addEventListener('click', async () => {
                    restoreBtn.disabled = true;
                    try {
                        await chrome.runtime.sendMessage({
                            action: 'driveRestore',
                            workspaceId: entry.id,
                        });
                    } catch (err) {
                        console.warn('[sync] restore failed:', err);
                    }
                    await hydrate();
                });
                restoreBlock.appendChild(makeRow(name, restoreBtn));
            }
        }

        // ===== 6. Conflict review =====
        conflictBlock.innerHTML = '';
        const conflicts = Array.isArray(status.conflicts) ? status.conflicts : [];
        if (conflicts.length > 0) {
            const wsById = new Map(workspaces.map((w) => [w.id, w]));
            const names = conflicts.map((id) => {
                const w = wsById.get(id);
                return w ? (w.name || id) : id;
            });
            const note = document.createElement('div');
            note.className = 'opt-row__desc';
            note.textContent = (api.getMessage('syncConflictNote', names.join(', ')) ||
                `A conflicting copy was kept on Drive for: ${names.join(', ')}. Your local version was preserved.`);
            conflictBlock.appendChild(makeRow(
                api.getMessage('syncConflictLabel') || 'Sync conflicts',
                null
            ));
            conflictBlock.appendChild(note);
        }
    }

    // Defer ALL I/O (identity / storage / workspace load) to after the skeleton paints.
    hydrate();
}

/**
 * Maps an AI availability status string to a badge display object.
 * Mirrors the same helper in settingManager.js (getStatusBadge).
 * @param {string} status
 * @returns {{icon: string, label: string, className: string}}
 */
function getStatusBadge(status) {
    switch (status) {
        case 'available':   return { icon: 'check_circle',    label: 'Available',    className: 'available' };
        case 'downloading': return { icon: 'hourglass_empty', label: 'Downloading',  className: 'downloading' };
        case 'downloadable':return { icon: 'download',        label: 'Downloadable', className: 'downloadable' };
        default:            return { icon: 'cancel',          label: 'Unavailable',  className: 'unavailable' };
    }
}

/** Provider ids → option labels for the AI provider select. */
const AI_PROVIDER_OPTIONS = [
    { value: 'builtin', labelKey: 'aiProviderBuiltin', fallback: 'Chrome built-in (Gemini Nano)' },
    { value: 'gemini', labelKey: 'aiProviderGemini', fallback: 'Google Gemini API' },
    { value: 'anthropic', labelKey: 'aiProviderAnthropic', fallback: 'Anthropic Claude API' },
    { value: 'openai', labelKey: 'aiProviderOpenAI', fallback: 'OpenAI-compatible endpoint' },
    { value: 'ollama', labelKey: 'aiProviderOllama', fallback: 'Ollama (local)' },
];

/** Which config fields each cloud provider needs. */
const AI_PROVIDER_FIELDS = {
    gemini: ['apiKey', 'model'],
    anthropic: ['apiKey', 'model'],
    openai: ['baseUrl', 'apiKey', 'model'],
    ollama: ['baseUrl', 'model', 'apiKey'],
};

/**
 * 渲染 AI 供應商設定區塊：供應商下拉、各家 API key / 模型 / base URL 欄位、
 * 連線測試按鈕與 inline 狀態。設定僅寫入 chrome.storage.local（API key 屬
 * 敏感資料不進 sync）；aiManager 每次呼叫時讀取，無需事件橋接。
 * @param {HTMLElement} container
 */
async function renderAiProviderBlock(container) {
    const block = document.createElement('div');
    block.className = 'ai-provider-section';

    const settings = await providerSettings.getProviderSettings();

    const select = document.createElement('select');
    select.className = 'modal-select';
    select.id = 'ai-provider-select';
    select.setAttribute('aria-label', api.getMessage('aiProviderLabel') || 'AI model provider');
    for (const p of AI_PROVIDER_OPTIONS) {
        const opt = document.createElement('option');
        opt.value = p.value;
        opt.textContent = api.getMessage(p.labelKey) || p.fallback;
        if (p.value === settings.activeProvider) opt.selected = true;
        select.appendChild(opt);
    }
    block.appendChild(makeRow(api.getMessage('aiProviderLabel') || 'AI model provider', select));

    const configWrap = document.createElement('div');
    configWrap.id = 'ai-provider-config';
    block.appendChild(configWrap);

    const FIELD_LABELS = {
        apiKey: () => api.getMessage('aiProviderApiKeyLabel') || 'API key',
        model: () => api.getMessage('aiProviderModelLabel') || 'Model',
        baseUrl: () => api.getMessage('aiProviderBaseUrlLabel') || 'Base URL',
    };

    async function renderConfigFields() {
        configWrap.innerHTML = '';
        const current = await providerSettings.getProviderSettings();
        const id = current.activeProvider;

        if (id === 'builtin') {
            const desc = document.createElement('div');
            desc.className = 'opt-row__desc';
            desc.textContent = api.getMessage('aiProviderBuiltinDesc')
                || 'Runs entirely on this device. No data leaves your browser.';
            configWrap.appendChild(desc);
            return;
        }

        const config = current.providers[id] || {};
        const modelListId = `ai-provider-models-${id}`;
        const fieldInputs = {};

        for (const field of AI_PROVIDER_FIELDS[id] || []) {
            const input = document.createElement('input');
            input.type = field === 'apiKey' ? 'password' : (field === 'baseUrl' ? 'url' : 'text');
            input.className = 'modal-input';
            // 'new-password' suppresses Chrome's save-password prompt more
            // reliably than 'off' on password fields.
            input.autocomplete = field === 'apiKey' ? 'new-password' : 'off';
            input.value = config[field] || '';
            fieldInputs[field] = input;
            input.setAttribute('aria-label', FIELD_LABELS[field]());
            if (field === 'model') {
                input.setAttribute('list', modelListId);
                const defaults = providerSettings.PROVIDER_DEFAULTS.providers[id];
                if (defaults?.model) input.placeholder = defaults.model;
            }
            input.addEventListener('change', async () => {
                await providerSettings.saveProviderConfig(id, { [field]: input.value.trim() });
            });
            configWrap.appendChild(makeRow(FIELD_LABELS[field](), input));

            // Cleartext warning: http: toward a non-local host sends the API
            // key unencrypted. Hidden for local addresses (Ollama's default).
            if (field === 'baseUrl') {
                const httpWarning = document.createElement('div');
                httpWarning.className = 'opt-row__desc ai-provider-http-warning';
                httpWarning.insertAdjacentHTML('afterbegin', renderIcon('warning', { size: 14 }) + ' ');
                httpWarning.appendChild(document.createTextNode(
                    api.getMessage('aiProviderHttpWarning')
                    || 'This address uses unencrypted http: — your API key would be sent in cleartext.'
                ));
                const syncHttpWarning = () => {
                    httpWarning.hidden = !isInsecureRemoteBaseUrl(input.value);
                };
                syncHttpWarning();
                input.addEventListener('input', syncHttpWarning);
                configWrap.appendChild(httpWarning);
            }
        }

        // Datalist filled by a successful "test connection" (model suggestions).
        const datalist = document.createElement('datalist');
        datalist.id = modelListId;
        configWrap.appendChild(datalist);

        // --- Test connection button + inline status ---
        const testWrap = document.createElement('div');
        testWrap.className = 'ai-provider-test-wrap';
        const testBtn = document.createElement('button');
        testBtn.className = 'modal-button';
        testBtn.textContent = api.getMessage('aiProviderTestBtn') || 'Test connection';
        const statusEl = document.createElement('span');
        statusEl.className = 'ai-provider-test-status';
        statusEl.setAttribute('role', 'status');
        testWrap.appendChild(testBtn);
        testWrap.appendChild(statusEl);
        configWrap.appendChild(testWrap);

        testBtn.addEventListener('click', async () => {
            testBtn.disabled = true;
            statusEl.className = 'ai-provider-test-status';
            statusEl.textContent = api.getMessage('aiProviderTesting') || 'Testing…';
            try {
                // Flush current input values first — the user may click Test
                // right after typing, before the inputs' change events land.
                const patch = {};
                for (const [field, input] of Object.entries(fieldInputs)) {
                    patch[field] = input.value.trim();
                }
                await providerSettings.saveProviderConfig(id, patch);
                const fresh = await providerSettings.getProviderSettings();
                const res = await getCloudProvider(id).testConnection(fresh.providers[id] || {});
                statusEl.innerHTML = '';
                const icon = document.createElement('span');
                icon.innerHTML = renderIcon(res.ok ? 'check_circle' : 'cancel', { size: 14 });
                statusEl.appendChild(icon);
                const text = document.createElement('span');
                if (res.ok) {
                    statusEl.classList.add('ok');
                    text.textContent = api.getMessage('aiProviderTestOk') || 'Connection OK';
                    if (Array.isArray(res.models) && res.models.length) {
                        datalist.innerHTML = '';
                        for (const m of res.models.slice(0, 50)) {
                            const opt = document.createElement('option');
                            opt.value = m;
                            datalist.appendChild(opt);
                        }
                    }
                } else {
                    statusEl.classList.add('fail');
                    const failLabel = api.getMessage('aiProviderTestFail') || 'Connection failed';
                    const hint = (id === 'ollama' && res.code === 'network')
                        ? (api.getMessage('aiProviderOllamaCorsHint')
                            || 'Ollama blocks extensions by default. Start it with OLLAMA_ORIGINS=chrome-extension://* to allow access.')
                        : (res.message || '');
                    text.textContent = hint ? `${failLabel} — ${hint}` : failLabel;
                }
                statusEl.appendChild(text);
            } finally {
                testBtn.disabled = false;
            }
        });

        if (id === 'ollama') {
            const hint = document.createElement('div');
            hint.className = 'opt-row__desc';
            hint.textContent = api.getMessage('aiProviderOllamaCorsHint')
                || 'Ollama blocks extensions by default. Start it with OLLAMA_ORIGINS=chrome-extension://* to allow access.';
            configWrap.appendChild(hint);
        }

        const privacyNote = document.createElement('div');
        privacyNote.className = 'opt-row__desc';
        privacyNote.textContent = api.getMessage('aiProviderKeyStorageNote')
            || 'Your API key is stored only on this device and sent only to the provider you configure.';
        configWrap.appendChild(privacyNote);
    }

    select.addEventListener('change', async () => {
        await providerSettings.setActiveProvider(select.value);
        await renderConfigFields();
    });

    await renderConfigFields();
    container.appendChild(block);
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

    // --- AI provider picker + per-provider config ---
    await renderAiProviderBlock(container);

    // --- Model status header ---
    const statusSection = document.createElement('div');
    statusSection.className = 'ai-model-status-section';

    const statusHeader = document.createElement('div');
    statusHeader.className = 'ai-model-status-header';
    statusHeader.textContent = 'Gemini Nano';
    statusSection.appendChild(statusHeader);

    const nanoNote = document.createElement('div');
    nanoNote.className = 'opt-row__desc';
    nanoNote.textContent = api.getMessage('aiProviderNanoSectionNote')
        || 'This section applies when "Chrome built-in (Gemini Nano)" is selected above.';
    statusSection.appendChild(nanoNote);

    // LanguageModel row
    const lmRow = document.createElement('div');
    lmRow.className = 'ai-model-status-row';
    const lmLabel = document.createElement('span');
    lmLabel.className = 'ai-model-status-label';
    lmLabel.textContent = 'LanguageModel';
    const lmBadge = document.createElement('span');
    lmBadge.id = 'ai-lm-status-badge';
    lmBadge.className = 'ai-status-badge checking';
    lmBadge.innerHTML = renderIcon('hourglass_empty', { size: 14 });
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
    sumBadge.innerHTML = renderIcon('hourglass_empty', { size: 14 });
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
        openBtn.textContent = (api.getMessage('aiSetupOpenLink') || 'Open') + ' ';
        openBtn.insertAdjacentHTML('beforeend', renderIcon('open_in_new', { size: 14 }));
        openBtn.addEventListener('click', () => {
            chrome.tabs.create({ url: step.url });
        });
        li.appendChild(openBtn);
        ol.appendChild(li);
    }
    guide.appendChild(ol);

    const restartNote = document.createElement('div');
    restartNote.className = 'ai-setup-restart-note';
    restartNote.textContent = api.getMessage('aiSetupRestartNote') || 'Restart Chrome after changing the flags above.';
    restartNote.insertAdjacentHTML('afterbegin', renderIcon('warning', { size: 14 }) + ' ');
    guide.appendChild(restartNote);

    container.appendChild(guide);

    // --- Async status detection (builtin Nano status, regardless of active provider) ---
    (async () => {
        // LanguageModel
        const lmStatus = await checkBuiltinModelAvailability();
        const lmBadgeInfo = getStatusBadge(lmStatus);
        lmBadge.innerHTML = renderIcon(lmBadgeInfo.icon, { size: 14 }) + ' ' + lmBadgeInfo.label;
        lmBadge.className = `ai-status-badge ${lmBadgeInfo.className}`;

        // Summarizer — call Summarizer.availability() directly (same as settingManager)
        let sumStatus = 'unavailable';
        if ('Summarizer' in self) {
            try { sumStatus = await Summarizer.availability() || 'unavailable'; } catch { /* ignore */ }
        }
        const sumBadgeInfo = getStatusBadge(sumStatus);
        sumBadge.innerHTML = renderIcon(sumBadgeInfo.icon, { size: 14 }) + ' ' + sumBadgeInfo.label;
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

            const newStatus = await checkBuiltinModelAvailability();
            const newBadge = getStatusBadge(newStatus);
            lmBadge.innerHTML = renderIcon(newBadge.icon, { size: 14 }) + ' ' + newBadge.label;
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
    manageBtn.className = 'modal-button';
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
    { id: 'sync',       labelKey: 'settingsNavSync',       render: renderSync, labelFallback: 'Backup & Sync' },
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
        btn.textContent = api.getMessage(s.labelKey) || s.labelFallback || s.id;
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

document.addEventListener('DOMContentLoaded', async () => {
    // 套用 uiLanguage 覆寫:必須在 buildNav(以 api.getMessage 渲染全頁)前載入自訂字典,
    // 否則 getMessage 會退回瀏覽器語系、忽略使用者選的語言(比照 sidepanel.js / spotlight.js)。
    const { uiLanguage } = await api.getStorage('sync', { uiLanguage: 'auto' });
    await api.loadCustomI18n(uiLanguage);
    applyOwnTheme();
    buildNav(document.getElementById('opt-nav'), document.getElementById('opt-content'));
});
