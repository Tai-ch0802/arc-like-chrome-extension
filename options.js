import * as api from './modules/apiManager.js';
import { applyTheme } from './modules/ui/settingManager.js';
import * as customTheme from './modules/ui/customThemeManager.js';

const SECTIONS = [
    { id: 'appearance', labelKey: 'settingsNavAppearance', render: c => placeholder(c, 'Appearance') },
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
