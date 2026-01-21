function applyTranslations() {
    // Set the language of the page
    const lang = chrome.i18n.getUILanguage();
    document.documentElement.lang = lang;

    // Localize elements with data-i18n attribute
    const i18nElements = document.querySelectorAll('[data-i18n]');
    i18nElements.forEach(element => {
        const key = element.dataset.i18n;
        const translation = chrome.i18n.getMessage(key);
        if (translation) {
            // Use textContent for most elements, but value for buttons/inputs if needed
            if (element.tagName === 'INPUT' || element.tagName === 'BUTTON') {
                 if (element.type !== 'color' && element.type !== 'range') {
                    element.value = translation;
                }
                 element.textContent = translation;

            } else {
                element.textContent = translation;
            }
        }
    });

    // Localize elements with data-i18n-placeholder attribute
    const i18nPlaceholderElements = document.querySelectorAll('[data-i18n-placeholder]');
    i18nPlaceholderElements.forEach(element => {
        const key = element.dataset.i18nPlaceholder;
        const translation = chrome.i18n.getMessage(key);
        if (translation) {
            element.placeholder = translation;
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    applyTranslations();
    const colorPickers = document.querySelectorAll('input[type="color"]');
    const backgroundUrlInput = document.getElementById('background-image-url');
    const backgroundOpacitySlider = document.getElementById('background-opacity');
    const saveButton = document.getElementById('save-button');
    const resetButton = document.getElementById('reset-button');
    const previewPanel = document.getElementById('sidepanel-preview');

    const defaultTheme = {
        '--main-bg-color': '#1e1e2e',
        '--text-color-primary': '#a0e8a0',
        '--accent-color': '#00ff41',
        '--element-bg-color': '#282a36',
        '--element-bg-hover-color': '#383a4a',
        '--border-color': '#45475a',
        'background-image-url': '',
        '--background-opacity': 1.0,
    };
    // For preview only
    previewPanel.style.setProperty('--element-bg-active-color', '#44475a');

    function hexToRgba(hex, alpha) {
        let r = 0, g = 0, b = 0;
        if (hex.length === 4) {
            r = parseInt(hex[1] + hex[1], 16);
            g = parseInt(hex[2] + hex[2], 16);
            b = parseInt(hex[3] + hex[3], 16);
        } else if (hex.length === 7) {
            r = parseInt(hex[1] + hex[2], 16);
            g = parseInt(hex[3] + hex[4], 16);
            b = parseInt(hex[5] + hex[6], 16);
        }
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    function updatePreview() {
        colorPickers.forEach(picker => {
            previewPanel.style.setProperty(picker.dataset.cssVar, picker.value);
        });

        const bgUrl = backgroundUrlInput.value;
        const opacity = backgroundOpacitySlider.value;
        const bgColor = previewPanel.style.getPropertyValue('--main-bg-color') || defaultTheme['--main-bg-color'];

        // Update the CSS variable for opacity on the preview element itself
        previewPanel.style.setProperty('--background-opacity', opacity);

        // Also update the main background color variable
        previewPanel.style.setProperty('--main-bg-color', bgColor);


        if (bgUrl) {
            previewPanel.style.backgroundImage = `url('${bgUrl}')`;
        } else {
            previewPanel.style.backgroundImage = 'none';
        }
    }

    function loadSettings() {
        chrome.storage.sync.get('customTheme', (data) => {
            const theme = data.customTheme || {};

            colorPickers.forEach(picker => {
                const varName = picker.dataset.cssVar;
                picker.value = theme[varName] || defaultTheme[varName];
            });

            backgroundUrlInput.value = theme['background-image-url'] || defaultTheme['background-image-url'];
            backgroundOpacitySlider.value = theme['--background-opacity'] === undefined ? defaultTheme['--background-opacity'] : theme['--background-opacity'];

            updatePreview();
        });
    }

    function saveSettings() {
        const customTheme = {};
        colorPickers.forEach(picker => {
            customTheme[picker.dataset.cssVar] = picker.value;
        });
        customTheme['background-image-url'] = backgroundUrlInput.value;
        customTheme['--background-opacity'] = backgroundOpacitySlider.value; // Store as CSS var

        chrome.storage.sync.set({ customTheme: customTheme }, () => {
            chrome.storage.sync.set({ theme: 'custom' }, () => {
                alert(chrome.i18n.getMessage('settingsSavedAlert'));
            });
        });
    }

    function resetSettings() {
        if (confirm(chrome.i18n.getMessage('resetConfirm'))) {
            chrome.storage.sync.remove('customTheme', () => {
                chrome.storage.sync.set({ theme: 'geek' }, () => {
                    loadSettings();
                    alert(chrome.i18n.getMessage('settingsResetAlert'));
                });
            });
        }
    }

    colorPickers.forEach(picker => picker.addEventListener('input', updatePreview));
    backgroundUrlInput.addEventListener('input', updatePreview);
    backgroundOpacitySlider.addEventListener('input', updatePreview);

    saveButton.addEventListener('click', saveSettings);
    resetButton.addEventListener('click', resetSettings);

    loadSettings();
});
