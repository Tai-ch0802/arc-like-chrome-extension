/**
 * AI provider settings storage.
 *
 * Persists which AI provider backs the extension's AI features and each
 * provider's connection config (API key / model / base URL).
 *
 * SECURITY: everything lives in chrome.storage.local ONLY. API keys must
 * never reach chrome.storage.sync (project rule: sensitive data stays on
 * this device). Keeping `activeProvider` local too is deliberate — syncing
 * "anthropic" to a machine whose local storage has no key would silently
 * break AI features there.
 *
 * Works in every extension context (sidepanel, options page, service worker).
 */
import * as api from '../apiManager.js';

export const STORAGE_KEY = 'aiProviderSettings';

export const PROVIDER_IDS = ['builtin', 'gemini', 'anthropic', 'openai', 'ollama'];

export const PROVIDER_DEFAULTS = Object.freeze({
    activeProvider: 'builtin',
    providers: Object.freeze({
        gemini: Object.freeze({ apiKey: '', model: 'gemini-2.5-flash' }),
        anthropic: Object.freeze({ apiKey: '', model: 'claude-opus-4-8' }),
        openai: Object.freeze({ apiKey: '', model: '', baseUrl: 'https://api.openai.com/v1' }),
        ollama: Object.freeze({ apiKey: '', model: '', baseUrl: 'http://localhost:11434' }),
    }),
});

/**
 * Merges a stored (possibly partial / stale) settings blob over the defaults.
 * Absent key = all defaults = current pre-feature behavior, so no migration
 * is needed.
 * @param {object|undefined} stored
 * @returns {{activeProvider: string, providers: Object<string, object>}}
 */
function mergeWithDefaults(stored) {
    const activeProvider = PROVIDER_IDS.includes(stored?.activeProvider)
        ? stored.activeProvider
        : PROVIDER_DEFAULTS.activeProvider;
    const providers = {};
    for (const [id, defaults] of Object.entries(PROVIDER_DEFAULTS.providers)) {
        providers[id] = { ...defaults, ...(stored?.providers?.[id] || {}) };
    }
    return { activeProvider, providers };
}

/** @returns {Promise<{activeProvider: string, providers: Object<string, object>}>} */
export async function getProviderSettings() {
    const result = await api.getStorage('local', [STORAGE_KEY]);
    return mergeWithDefaults(result?.[STORAGE_KEY]);
}

/**
 * Resolves the active provider id plus its config.
 * @returns {Promise<{id: string, config: object}>} config is {} for 'builtin'.
 */
export async function getActiveProvider() {
    const settings = await getProviderSettings();
    const id = settings.activeProvider;
    return { id, config: settings.providers[id] || {} };
}

/**
 * Switches the active provider. Per-provider configs are untouched, so
 * switching back and forth never loses a stored key.
 * @param {string} id
 */
export async function setActiveProvider(id) {
    if (!PROVIDER_IDS.includes(id)) {
        throw new Error(`Unknown AI provider: ${id}`);
    }
    const settings = await getProviderSettings();
    settings.activeProvider = id;
    await api.setStorage('local', { [STORAGE_KEY]: settings });
}

/**
 * Shallow-merges a patch into one provider's config, preserving siblings.
 * @param {string} id - A cloud provider id (not 'builtin').
 * @param {object} patch - e.g. { apiKey: 'sk-...' }
 */
export async function saveProviderConfig(id, patch) {
    if (!PROVIDER_IDS.includes(id) || id === 'builtin') {
        throw new Error(`Cannot save config for provider: ${id}`);
    }
    const settings = await getProviderSettings();
    settings.providers[id] = { ...settings.providers[id], ...patch };
    await api.setStorage('local', { [STORAGE_KEY]: settings });
}

/**
 * Pure check: does this provider have the minimum config to attempt a call?
 * (Not a health check — the options page "test connection" button covers that.)
 * @param {string} id
 * @param {object} [config]
 * @returns {boolean}
 */
export function isProviderConfigured(id, config = {}) {
    switch (id) {
        case 'builtin':
            return true;
        case 'ollama':
            return !!(config.baseUrl && config.model);
        case 'openai':
            return !!(config.apiKey && config.model && config.baseUrl);
        case 'gemini':
        case 'anthropic':
            return !!(config.apiKey && config.model);
        default:
            return false;
    }
}
