/**
 * Cloud AI provider registry.
 * 'builtin' (Chrome's Gemini Nano) has no cloud client — aiManager keeps its
 * dedicated LanguageModel/Summarizer code path and this returns null for it.
 */
import * as gemini from './geminiProvider.js';
import * as anthropic from './anthropicProvider.js';
import * as openaiCompat from './openaiCompatProvider.js';
import * as ollama from './ollamaProvider.js';

const CLOUD_PROVIDERS = {
    gemini,
    anthropic,
    openai: openaiCompat,
    ollama,
};

/**
 * @param {string} id - Provider id from providerSettings.PROVIDER_IDS.
 * @returns {{chat: Function, testConnection: Function}|null}
 */
export function getCloudProvider(id) {
    return CLOUD_PROVIDERS[id] || null;
}
