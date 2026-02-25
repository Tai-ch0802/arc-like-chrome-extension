const i18n = {
    currentLang: 'en',
    translations: {},
    supportedLangs: {
        'en': 'English',
        'zh_TW': '繁體中文',
        'zh_CN': '简体中文',
        'ja': '日本語',
        'ko': '한국어',
        'de': 'Deutsch',
        'es': 'Español',
        'fr': 'Français',
        'pt_BR': 'Português (BR)',
        'ru': 'Русский',
        'hi': 'हिन्दी',
        'th': 'ไทย',
        'vi': 'Tiếng Việt',
        'id': 'Bahasa Indonesia'
    },

    // Maps browser locale prefixes to our supported locale keys
    langMap: {
        'zh-TW': 'zh_TW', 'zh-HK': 'zh_TW', 'zh-Hant': 'zh_TW',
        'zh-CN': 'zh_CN', 'zh-SG': 'zh_CN', 'zh-Hans': 'zh_CN', 'zh': 'zh_CN',
        'ja': 'ja', 'ko': 'ko', 'de': 'de', 'es': 'es', 'fr': 'fr',
        'pt-BR': 'pt_BR', 'pt': 'pt_BR', 'ru': 'ru', 'hi': 'hi',
        'th': 'th', 'vi': 'vi', 'id': 'id'
    },

    async init() {
        // Detect browser language or get from localStorage
        const savedLang = localStorage.getItem('i18n_lang');
        if (savedLang && this.supportedLangs[savedLang]) {
            this.currentLang = savedLang;
        } else {
            const browserLang = navigator.language || navigator.userLanguage || 'en';
            // Try exact match first (e.g. zh-TW), then prefix (e.g. zh)
            this.currentLang = this.langMap[browserLang]
                || this.langMap[browserLang.split('-')[0]]
                || 'en';
        }

        // Init language switcher UI
        this.setupSwitcher();

        // Load translations and apply
        await this.loadTranslations(this.currentLang);
        this.applyTranslations();
    },

    setupSwitcher() {
        const switcherList = document.querySelector('.lang-switcher-list');
        if (!switcherList) return;

        switcherList.innerHTML = '';
        Object.entries(this.supportedLangs).forEach(([code, name]) => {
            const li = document.createElement('li');
            li.textContent = name;
            li.className = code === this.currentLang ? 'active' : '';
            li.addEventListener('click', async () => {
                if (this.currentLang === code) return;

                // Update UI state
                switcherList.querySelectorAll('li').forEach(el => el.classList.remove('active'));
                li.classList.add('active');

                // Change language
                this.currentLang = code;
                localStorage.setItem('i18n_lang', code);
                document.documentElement.lang = code.replace('_', '-');

                await this.loadTranslations(code);
                this.applyTranslations();
            });
            switcherList.appendChild(li);
        });
    },

    async loadTranslations(lang) {
        try {
            const response = await fetch(`locales/${lang}.json`);
            if (!response.ok) throw new Error('Network response was not ok');
            this.translations = await response.json();
        } catch (error) {
            console.error('Failed to load translations for', lang, error);
            // Fallback to empty to prevent breaking
            this.translations = {};
        }
    },

    applyTranslations() {
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translation = this.translations[key];
            if (translation) {
                // Check if it should be parsed as HTML (some hero titles have <br> and <span>)
                if (translation.includes('<')) {
                    el.innerHTML = translation;
                } else {
                    el.textContent = translation;
                }
            }
        });

        // Update document title and meta description
        if (this.translations['page_title']) {
            document.title = this.translations['page_title'];
        }
        if (this.translations['page_desc']) {
            const metaDesc = document.querySelector('meta[name="description"]');
            if (metaDesc) {
                metaDesc.setAttribute('content', this.translations['page_desc']);
            }
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    i18n.init();
});
