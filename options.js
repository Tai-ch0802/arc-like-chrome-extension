import * as api from './modules/apiManager.js';
import { applyTheme } from './modules/ui/settingManager.js';
import * as customTheme from './modules/ui/customThemeManager.js';
import * as bgImage from './modules/ui/backgroundImageManager.js';

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

const SECTIONS = [
    { id: 'appearance', labelKey: 'settingsNavAppearance', render: renderAppearance },
    { id: 'language',   labelKey: 'settingsNavLanguage',   render: renderLanguage },
    { id: 'features',   labelKey: 'settingsNavFeatures',   render: renderFeatures },
    { id: 'ai',         labelKey: 'settingsNavAi',         render: c => placeholder(c, 'AI & Experimental') },
    { id: 'rss',        labelKey: 'settingsNavRss',        render: c => placeholder(c, 'RSS') },
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
