/**
 * @fileoverview Custom theme manager for user-defined color schemes.
 * Handles color picker UI, theme storage, and JSON export/import.
 * @module customThemeManager
 */

import * as api from '../apiManager.js';
import { showCustomDialog } from '../modalManager.js';
import {
    calculateDerivedColors,
    DEFAULT_CORE_COLORS,
    hexToHsl,
    meetsWcagAA
} from '../utils/colorUtils.js';
import { debounce } from '../utils/functionUtils.js';

// Storage keys
const CUSTOM_THEME_STORAGE_KEY = 'customTheme';
const THEME_SCHEMA_VERSION = '1.0';

// In-memory cache of current custom theme
let currentCustomTheme = null;

/**
 * Loads the custom theme from chrome.storage.sync.
 * @returns {Promise<Object|null>} The saved custom theme or null.
 */
export async function loadCustomTheme() {
    try {
        const result = await api.getStorage('sync', { [CUSTOM_THEME_STORAGE_KEY]: null });
        currentCustomTheme = result[CUSTOM_THEME_STORAGE_KEY];
        return currentCustomTheme;
    } catch (error) {
        console.error('[customThemeManager] Error loading custom theme:', error);
        return null;
    }
}

/**
 * Saves the custom theme to chrome.storage.sync.
 * @param {Object} themeData - The theme data to save.
 */
async function saveCustomTheme(themeData) {
    try {
        currentCustomTheme = themeData;
        await api.setStorage('sync', { [CUSTOM_THEME_STORAGE_KEY]: themeData });
    } catch (error) {
        console.error('[customThemeManager] Error saving custom theme:', error);
    }
}

/**
 * Applies custom colors to the document body.
 * @param {Object} colors - CSS variable key-value pairs.
 */
export function applyCustomColors(colors) {
    Object.entries(colors).forEach(([key, value]) => {
        document.body.style.setProperty(key, value);
    });
}

/**
 * Removes all custom CSS variables from document body.
 */
export function clearCustomColors() {
    const cssVars = [
        '--main-bg-color', '--text-color-primary', '--text-color-secondary',
        '--text-color-header', '--text-color-inverted', '--text-color-placeholder',
        '--text-color-light', '--element-bg-color', '--element-bg-hover-color',
        '--element-bg-active-color', '--border-color', '--border-color-accent',
        '--accent-color', '--accent-color-hover', '--danger-color', '--danger-color-hover',
        '--info-color', '--warning-color', '--modal-overlay-bg-color', '--modal-shadow-color',
        '--search-match-title', '--search-match-url', '--link-color', '--link-color-hover'
    ];

    cssVars.forEach(varName => {
        document.body.style.removeProperty(varName);
    });
}

/**
 * Loads and applies the saved custom theme if it exists.
 * @returns {Promise<boolean>} True if custom theme was applied.
 */
export async function loadAndApplyCustomTheme() {
    const theme = await loadCustomTheme();
    if (theme && theme.colors) {
        const derivedColors = calculateDerivedColors(theme.colors);
        applyCustomColors(derivedColors);
        return true;
    }
    return false;
}

/**
 * Creates the color picker panel HTML.
 * @param {Object} currentColors - Current color values.
 * @returns {string} HTML string for the color picker panel.
 */
function createColorPickerPanelHtml(currentColors) {
    const colors = currentColors || DEFAULT_CORE_COLORS;

    return `
        <div class="custom-theme-panel">
            <div class="color-picker-row">
                <label for="color-main-bg">${api.getMessage('labelMainBgColor') || 'Main Background'}</label>
                <input type="color" id="color-main-bg" value="${colors.mainBgColor}" />
            </div>
            <div class="color-picker-row">
                <label for="color-accent">${api.getMessage('labelAccentColor') || 'Accent Color'}</label>
                <input type="color" id="color-accent" value="${colors.accentColor}" />
            </div>
            <div class="color-picker-row">
                <label for="color-text-primary">${api.getMessage('labelPrimaryTextColor') || 'Primary Text'}</label>
                <input type="color" id="color-text-primary" value="${colors.primaryTextColor}" />
            </div>
            <div id="contrast-warning" class="contrast-warning hidden">
                ⚠️ ${api.getMessage('warningLowContrast') || 'Low contrast detected. Colors will be auto-adjusted.'}
            </div>
            <div class="custom-theme-buttons">
                <button id="btn-export-theme" class="modal-button">${api.getMessage('buttonExportTheme') || 'Export'}</button>
                <button id="btn-import-theme" class="modal-button">${api.getMessage('buttonImportTheme') || 'Import'}</button>
                <button id="btn-reset-theme" class="modal-button danger">${api.getMessage('buttonResetTheme') || 'Reset'}</button>
            </div>
            <input type="file" id="theme-file-input" accept=".json" class="hidden" />
        </div>
    `;
}



/**
 * Gets current color values from the color pickers.
 * @param {HTMLElement} container - The container element.
 * @returns {Object} Current color values.
 */
function getColorsFromPickers(container) {
    return {
        mainBgColor: container.querySelector('#color-main-bg').value,
        accentColor: container.querySelector('#color-accent').value,
        primaryTextColor: container.querySelector('#color-text-primary').value
    };
}

/**
 * Updates the contrast warning visibility.
 * @param {HTMLElement} container - The container element.
 * @param {Object} colors - Current color values.
 */
function updateContrastWarning(container, colors) {
    const warning = container.querySelector('#contrast-warning');
    const hasGoodContrast = meetsWcagAA(colors.primaryTextColor, colors.mainBgColor);
    warning.classList.toggle('hidden', hasGoodContrast);
}

/**
 * Handles color change events with debouncing.
 * @param {HTMLElement} container - The container element.
 */
function setupColorChangeHandlers(container) {
    const colorInputs = container.querySelectorAll('input[type="color"]');

    const handleColorChange = debounce(() => {
        const colors = getColorsFromPickers(container);
        updateContrastWarning(container, colors);

        // Calculate and apply derived colors
        const derivedColors = calculateDerivedColors(colors);
        applyCustomColors(derivedColors);

        // Auto-save
        saveCustomTheme({
            version: THEME_SCHEMA_VERSION,
            colors: colors
        });
    }, 100);

    colorInputs.forEach(input => {
        input.addEventListener('input', handleColorChange);
    });
}

/**
 * Exports the current custom theme as a JSON file.
 */
export function exportTheme() {
    if (!currentCustomTheme || !currentCustomTheme.colors) {
        console.warn('[customThemeManager] No custom theme to export');
        return;
    }

    const themeData = {
        version: THEME_SCHEMA_VERSION,
        name: currentCustomTheme.name || 'My Custom Theme',
        colors: currentCustomTheme.colors,
        backgroundImage: null // Reserved for future
    };

    const blob = new Blob([JSON.stringify(themeData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `arc-sidebar-theme-${timestamp}.json`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
}

/**
 * Validates imported theme JSON against the schema.
 * @param {Object} data - Parsed JSON data.
 * @returns {boolean} True if valid.
 */
function validateThemeJson(data) {
    if (!data || typeof data !== 'object') return false;
    if (!data.version || !data.colors) return false;

    const { colors } = data;
    const hexPattern = /^#[0-9a-fA-F]{6}$/;

    return (
        hexPattern.test(colors.mainBgColor) &&
        hexPattern.test(colors.accentColor) &&
        hexPattern.test(colors.primaryTextColor)
    );
}

/**
 * Imports a theme from a JSON file.
 * @param {File} file - The JSON file to import.
 * @param {HTMLElement} container - The container element to update pickers.
 * @returns {Promise<boolean>} True if import was successful.
 */
export async function importTheme(file, container) {
    return new Promise((resolve) => {
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);

                if (!validateThemeJson(data)) {
                    alert(api.getMessage('errorInvalidThemeFile') || 'Invalid theme file format');
                    resolve(false);
                    return;
                }

                // Update color pickers
                if (container) {
                    container.querySelector('#color-main-bg').value = data.colors.mainBgColor;
                    container.querySelector('#color-accent').value = data.colors.accentColor;
                    container.querySelector('#color-text-primary').value = data.colors.primaryTextColor;
                    updateContrastWarning(container, data.colors);
                }

                // Apply and save
                const derivedColors = calculateDerivedColors(data.colors);
                applyCustomColors(derivedColors);
                await saveCustomTheme({
                    version: THEME_SCHEMA_VERSION,
                    name: data.name,
                    colors: data.colors
                });

                resolve(true);
            } catch (error) {
                console.error('[customThemeManager] Error parsing theme file:', error);
                alert(api.getMessage('errorInvalidThemeFile') || 'Invalid theme file format');
                resolve(false);
            }
        };

        reader.onerror = () => {
            console.error('[customThemeManager] Error reading file');
            resolve(false);
        };

        reader.readAsText(file);
    });
}

/**
 * Resets the custom theme to default values.
 * @param {HTMLElement} container - The container element to update pickers.
 */
export async function resetCustomTheme(container) {
    const defaultColors = DEFAULT_CORE_COLORS;

    if (container) {
        container.querySelector('#color-main-bg').value = defaultColors.mainBgColor;
        container.querySelector('#color-accent').value = defaultColors.accentColor;
        container.querySelector('#color-text-primary').value = defaultColors.primaryTextColor;
        updateContrastWarning(container, defaultColors);
    }

    const derivedColors = calculateDerivedColors(defaultColors);
    applyCustomColors(derivedColors);
    await saveCustomTheme({
        version: THEME_SCHEMA_VERSION,
        colors: defaultColors
    });
}

/**
 * Sets up the custom theme panel within a modal or settings dialog.
 * @param {HTMLElement} container - The container element where panel will be placed.
 */
export function setupCustomThemePanel(container) {
    setupColorChangeHandlers(container);

    // Export button
    const exportBtn = container.querySelector('#btn-export-theme');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportTheme);
    }

    // Import button
    const importBtn = container.querySelector('#btn-import-theme');
    const fileInput = container.querySelector('#theme-file-input');
    if (importBtn && fileInput) {
        importBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                await importTheme(e.target.files[0], container);
                fileInput.value = ''; // Reset for future imports
            }
        });
    }

    // Reset button
    const resetBtn = container.querySelector('#btn-reset-theme');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => resetCustomTheme(container));
    }
}

/**
 * Gets the HTML for the custom theme panel section.
 * @returns {Promise<string>} HTML string.
 */
export async function getCustomThemePanelHtml() {
    const theme = await loadCustomTheme();
    return createColorPickerPanelHtml(theme?.colors);
}

/**
 * Gets the current custom theme colors (or defaults).
 * @returns {Object} Current colors.
 */
export function getCurrentColors() {
    return currentCustomTheme?.colors || DEFAULT_CORE_COLORS;
}
