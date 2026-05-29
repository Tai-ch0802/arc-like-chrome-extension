import * as api from './modules/apiManager.js';
import { applyTheme } from './modules/ui/settingManager.js';
import * as customTheme from './modules/ui/customThemeManager.js';
import * as bgImage from './modules/ui/backgroundImageManager.js';
import * as rss from './modules/rssManager.js';

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

        container.appendChild(makeRow(labelText, checkbox, descText));

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
                    await rss.fetchNow(id);
                    statusMsg.textContent = api.getMessage('labelSuccess') || 'Success!';
                    statusMsg.classList.add('success');
                    // NOTE: no CustomEvent('readingListUpdated') dispatch — options page
                    // and sidepanel run in separate contexts; CustomEvent cannot cross them.
                    // The sidepanel will reflect new items on next open via storage.
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

const SECTIONS = [
    { id: 'appearance', labelKey: 'settingsNavAppearance', render: renderAppearance },
    { id: 'language',   labelKey: 'settingsNavLanguage',   render: renderLanguage },
    { id: 'features',   labelKey: 'settingsNavFeatures',   render: renderFeatures },
    { id: 'ai',         labelKey: 'settingsNavAi',         render: c => placeholder(c, 'AI & Experimental') },
    { id: 'rss',        labelKey: 'settingsNavRss',        render: renderRss },
    { id: 'shortcuts',  labelKey: 'settingsNavShortcuts',  render: c => placeholder(c, 'Shortcuts') },
    { id: 'about',      labelKey: 'settingsNavAbout',      render: c => placeholder(c, 'About') },
];

function placeholder(container, text) {
    const h = document.createElement('h2');
    h.textContent = text;
    container.appendChild(h);
}

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
