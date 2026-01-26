/**
 * @fileoverview Background image manager for custom sidebar backgrounds.
 * Handles image storage, loading, and CSS application.
 * Separate from customThemeManager to avoid contaminating theme logic.
 * @module backgroundImageManager
 */

import * as api from '../apiManager.js';
import { processImage } from '../utils/imageUtils.js';

// Storage keys
const BG_IMAGE_DATA_KEY = 'custom_bg_image_data';  // chrome.storage.local
const BG_CONFIG_KEY = 'backgroundImageConfig';      // chrome.storage.sync

// CSS variable names (per SA_spec.md Section 2.3)
const CSS_VARS = {
    IMAGE: '--bg-image-url',
    OPACITY: '--bg-image-opacity',
    BLUR: '--bg-image-blur',
    POS_X: '--bg-image-pos-x',
    POS_Y: '--bg-image-pos-y'
};

// Default configuration
const DEFAULT_CONFIG = {
    hasImage: false,
    storageType: 'file',  // 'file' or 'url'
    sourceUrl: '',
    opacity: 0.5,
    blur: 0,
    positionX: 'center',
    positionY: 'center',
    updatedAt: 0
};

// In-memory cache
let currentConfig = null;

/**
 * Loads background config from chrome.storage.sync.
 * @returns {Promise<Object>} The config object.
 */
export async function loadBackgroundConfig() {
    try {
        const result = await api.getStorage('sync', { [BG_CONFIG_KEY]: DEFAULT_CONFIG });
        currentConfig = result[BG_CONFIG_KEY] || DEFAULT_CONFIG;
        return currentConfig;
    } catch (error) {
        console.error('[backgroundImageManager] Error loading config:', error);
        return DEFAULT_CONFIG;
    }
}

/**
 * Saves background config to chrome.storage.sync.
 * @param {Object} config - The config to save.
 */
async function saveBackgroundConfig(config) {
    try {
        currentConfig = { ...config, updatedAt: Date.now() };
        await api.setStorage('sync', { [BG_CONFIG_KEY]: currentConfig });
    } catch (error) {
        console.error('[backgroundImageManager] Error saving config:', error);
    }
}

/**
 * Loads background image data from chrome.storage.local.
 * @returns {Promise<string|null>} Base64 image data or null.
 */
async function loadImageData() {
    try {
        const result = await api.getStorage('local', { [BG_IMAGE_DATA_KEY]: null });
        return result[BG_IMAGE_DATA_KEY];
    } catch (error) {
        console.error('[backgroundImageManager] Error loading image data:', error);
        return null;
    }
}

/**
 * Saves background image data to chrome.storage.local.
 * @param {string} base64Data - The Base64 image data.
 */
async function saveImageData(base64Data) {
    try {
        await api.setStorage('local', { [BG_IMAGE_DATA_KEY]: base64Data });
    } catch (error) {
        console.error('[backgroundImageManager] Error saving image data:', error);
    }
}

/**
 * Clears background image data from storage.
 */
async function clearImageData() {
    try {
        await chrome.storage.local.remove(BG_IMAGE_DATA_KEY);
    } catch (error) {
        console.error('[backgroundImageManager] Error clearing image data:', error);
    }
}

/**
 * Applies background image CSS variables to the document body.
 * @param {Object} config - The background config.
 * @param {string|null} imageData - Base64 image data.
 */
function applyBackgroundStyles(config, imageData) {
    const body = document.body;

    if (config.hasImage && imageData) {
        body.style.setProperty(CSS_VARS.IMAGE, `url("${imageData}")`);
        body.style.setProperty(CSS_VARS.OPACITY, config.opacity);
        body.style.setProperty(CSS_VARS.BLUR, `${config.blur}px`);
        body.style.setProperty(CSS_VARS.POS_X, config.positionX);
        body.style.setProperty(CSS_VARS.POS_Y, config.positionY);
    } else {
        // Clear background
        body.style.setProperty(CSS_VARS.IMAGE, 'none');
        body.style.removeProperty(CSS_VARS.OPACITY);
        body.style.removeProperty(CSS_VARS.BLUR);
        body.style.removeProperty(CSS_VARS.POS_X);
        body.style.removeProperty(CSS_VARS.POS_Y);
    }
}

/**
 * Clears all background CSS variables.
 */
export function clearBackgroundStyles() {
    const body = document.body;
    Object.values(CSS_VARS).forEach(varName => {
        body.style.removeProperty(varName);
    });
}

/**
 * Loads and applies the background image on extension startup.
 * Should be called early in sidepanel.js initialization.
 * @returns {Promise<boolean>} True if background was applied.
 */
export async function loadAndApplyBackgroundImage() {
    const config = await loadBackgroundConfig();

    if (!config.hasImage) {
        return false;
    }

    const imageData = await loadImageData();
    applyBackgroundStyles(config, imageData);
    return !!imageData;
}

/**
 * Processes and saves a new background image.
 * @param {File|string} source - File object or URL string.
 * @param {'file'|'url'} storageType - Source type.
 * @returns {Promise<boolean>} True if successful.
 */
export async function setBackgroundImage(source, storageType) {
    try {
        const base64Data = await processImage(source);
        await saveImageData(base64Data);

        const newConfig = {
            ...currentConfig,
            hasImage: true,
            storageType: storageType,
            sourceUrl: storageType === 'url' ? source : ''
        };
        await saveBackgroundConfig(newConfig);

        applyBackgroundStyles(newConfig, base64Data);
        return true;
    } catch (error) {
        console.error('[backgroundImageManager] Error setting background:', error);
        throw error;
    }
}

/**
 * Updates background config (opacity, blur, position) without changing the image.
 * @param {Object} updates - Partial config updates.
 */
export async function updateBackgroundConfig(updates) {
    const newConfig = { ...currentConfig, ...updates };
    await saveBackgroundConfig(newConfig);

    if (newConfig.hasImage) {
        const imageData = await loadImageData();
        applyBackgroundStyles(newConfig, imageData);
    }
}

/**
 * Removes the background image.
 */
export async function removeBackgroundImage() {
    await clearImageData();
    await saveBackgroundConfig({ ...DEFAULT_CONFIG });
    applyBackgroundStyles(DEFAULT_CONFIG, null);
}

/**
 * Gets the current background config.
 * @returns {Object} Current config.
 */
export function getCurrentConfig() {
    return currentConfig || DEFAULT_CONFIG;
}

// ============================================
// UI Panel Functions
// ============================================

/**
 * Creates the background image settings panel HTML.
 * @param {Object} config - Current background config.
 * @returns {string} HTML string.
 */
export function createBackgroundPanelHtml(config) {
    const cfg = config || DEFAULT_CONFIG;
    const isUpload = cfg.storageType === 'file';

    return `
        <div class="bg-image-panel">
            <!-- Source Toggle -->
            <div class="control-group">
                <label>${api.getMessage('labelBgSource') || 'Source'}</label>
                <div class="toggle-group" id="bg-source-toggle">
                    <button class="toggle-btn ${isUpload ? 'active' : ''}" data-value="file">${api.getMessage('optionUpload') || 'Upload'}</button>
                    <button class="toggle-btn ${!isUpload ? 'active' : ''}" data-value="url">${api.getMessage('optionUrl') || 'URL'}</button>
                </div>
            </div>

            <!-- Upload Section -->
            <div id="bg-upload-section" class="${isUpload ? '' : 'hidden'}">
                <button id="btn-upload-bg" class="modal-button secondary full-width">
                    ${api.getMessage('buttonUploadImage') || 'Choose Image...'}
                </button>
                <input type="file" id="bg-file-input" accept="image/*" class="hidden" />
            </div>

            <!-- URL Section -->
            <div id="bg-url-section" class="${!isUpload ? '' : 'hidden'}">
                <div class="input-with-button">
                    <input type="text" id="bg-url-input" placeholder="https://example.com/image.jpg" value="${cfg.sourceUrl || ''}" />
                    <button id="btn-apply-url" class="modal-button small">${api.getMessage('buttonApply') || 'Apply'}</button>
                </div>
            </div>

            <!-- Controls (shown only when image exists) -->
            <div id="bg-controls" class="${cfg.hasImage ? '' : 'hidden'}">
                <div class="control-group">
                    <label>${api.getMessage('labelOpacity') || 'Opacity'}: <span id="opacity-value">${cfg.opacity}</span></label>
                    <input type="range" id="bg-opacity" min="0.1" max="1" step="0.1" value="${cfg.opacity}" />
                </div>

                <div class="control-group">
                    <label>${api.getMessage('labelBlur') || 'Blur'}: <span id="blur-value">${cfg.blur}px</span></label>
                    <input type="range" id="bg-blur" min="0" max="20" step="1" value="${cfg.blur}" />
                </div>

                <div class="control-group">
                    <label>${api.getMessage('labelPositionX') || 'Horizontal'}</label>
                    <div class="toggle-group" id="bg-pos-x">
                        <button class="toggle-btn ${cfg.positionX === 'left' ? 'active' : ''}" data-value="left">L</button>
                        <button class="toggle-btn ${cfg.positionX === 'center' ? 'active' : ''}" data-value="center">C</button>
                        <button class="toggle-btn ${cfg.positionX === 'right' ? 'active' : ''}" data-value="right">R</button>
                    </div>
                </div>

                <div class="control-group">
                    <label>${api.getMessage('labelPositionY') || 'Vertical'}</label>
                    <div class="toggle-group" id="bg-pos-y">
                        <button class="toggle-btn ${cfg.positionY === 'top' ? 'active' : ''}" data-value="top">T</button>
                        <button class="toggle-btn ${cfg.positionY === 'center' ? 'active' : ''}" data-value="center">C</button>
                        <button class="toggle-btn ${cfg.positionY === 'bottom' ? 'active' : ''}" data-value="bottom">B</button>
                    </div>
                </div>

                <button id="btn-remove-bg" class="modal-button danger full-width">
                    ${api.getMessage('buttonRemoveImage') || 'Remove Image'}
                </button>
            </div>
        </div>
    `;
}

/**
 * Sets up event handlers for the background image panel.
 * @param {HTMLElement} container - The panel container.
 */
export function setupBackgroundPanelHandlers(container) {
    // Source toggle
    const sourceToggle = container.querySelector('#bg-source-toggle');
    if (sourceToggle) {
        sourceToggle.addEventListener('click', (e) => {
            if (e.target.classList.contains('toggle-btn')) {
                sourceToggle.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');

                const isUpload = e.target.dataset.value === 'file';
                container.querySelector('#bg-upload-section').classList.toggle('hidden', !isUpload);
                container.querySelector('#bg-url-section').classList.toggle('hidden', isUpload);
            }
        });
    }

    // File upload
    const uploadBtn = container.querySelector('#btn-upload-bg');
    const fileInput = container.querySelector('#bg-file-input');
    if (uploadBtn && fileInput) {
        uploadBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                await handleImageUpload(container, e.target.files[0]);
                fileInput.value = '';
            }
        });
    }

    // URL apply
    const applyUrlBtn = container.querySelector('#btn-apply-url');
    const urlInput = container.querySelector('#bg-url-input');
    if (applyUrlBtn && urlInput) {
        applyUrlBtn.addEventListener('click', async () => {
            const url = urlInput.value.trim();
            if (url) {
                await handleImageUpload(container, url, 'url');
            }
        });
    }

    // Opacity slider
    const opacitySlider = container.querySelector('#bg-opacity');
    if (opacitySlider) {
        opacitySlider.addEventListener('input', async (e) => {
            const value = parseFloat(e.target.value);
            container.querySelector('#opacity-value').textContent = value;
            await updateBackgroundConfig({ opacity: value });
        });
    }

    // Blur slider
    const blurSlider = container.querySelector('#bg-blur');
    if (blurSlider) {
        blurSlider.addEventListener('input', async (e) => {
            const value = parseInt(e.target.value, 10);
            container.querySelector('#blur-value').textContent = `${value}px`;
            await updateBackgroundConfig({ blur: value });
        });
    }

    // Position X toggle
    const posXToggle = container.querySelector('#bg-pos-x');
    if (posXToggle) {
        posXToggle.addEventListener('click', async (e) => {
            if (e.target.classList.contains('toggle-btn')) {
                posXToggle.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                await updateBackgroundConfig({ positionX: e.target.dataset.value });
            }
        });
    }

    // Position Y toggle
    const posYToggle = container.querySelector('#bg-pos-y');
    if (posYToggle) {
        posYToggle.addEventListener('click', async (e) => {
            if (e.target.classList.contains('toggle-btn')) {
                posYToggle.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                await updateBackgroundConfig({ positionY: e.target.dataset.value });
            }
        });
    }

    // Remove button
    const removeBtn = container.querySelector('#btn-remove-bg');
    if (removeBtn) {
        removeBtn.addEventListener('click', async () => {
            await removeBackgroundImage();
            container.querySelector('#bg-controls').classList.add('hidden');
        });
    }
}

/**
 * Handles image upload or URL fetch with UI feedback.
 * @param {HTMLElement} container - Panel container.
 * @param {File|string} source - Image source.
 * @param {'file'|'url'} [type='file'] - Source type.
 */
async function handleImageUpload(container, source, type = 'file') {
    const btn = container.querySelector(type === 'url' ? '#btn-apply-url' : '#btn-upload-bg');
    const originalText = btn.textContent;

    try {
        btn.textContent = api.getMessage('labelProcessing') || 'Processing...';
        btn.disabled = true;

        await setBackgroundImage(source, type);

        // Show controls
        container.querySelector('#bg-controls').classList.remove('hidden');

        btn.textContent = api.getMessage('labelSuccess') || 'Done!';
        setTimeout(() => {
            btn.textContent = originalText;
            btn.disabled = false;
        }, 1500);
    } catch (error) {
        console.error('[backgroundImageManager] Upload failed:', error);
        alert((api.getMessage('errorImageProcessing') || 'Failed to process image.') + ' ' + error.message);
        btn.textContent = originalText;
        btn.disabled = false;
    }
}
