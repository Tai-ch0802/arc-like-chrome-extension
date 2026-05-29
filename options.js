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

const SECTIONS = [
    { id: 'appearance', labelKey: 'settingsNavAppearance', render: renderAppearance },
    { id: 'language',   labelKey: 'settingsNavLanguage',   render: c => placeholder(c, 'Language') },
    { id: 'features',   labelKey: 'settingsNavFeatures',   render: c => placeholder(c, 'Features') },
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
