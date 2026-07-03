/**
 * Google Gemini API provider (generativelanguage.googleapis.com).
 */
import { fetchJson, toTestFailure } from './httpUtils.js';

const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * Builds the generateContent request. Pure — unit-testable without fetch.
 * The API key travels in the `x-goog-api-key` header (never the URL, which
 * would leak it into logs and error messages).
 * @param {{apiKey: string, model: string}} config
 * @param {{system?: string, prompt: string, maxTokens?: number}} params
 * @returns {{url: string, init: RequestInit}}
 */
export function buildChatRequest(config, { system, prompt, maxTokens = 1024 }) {
    const modelName = (config.model || '').trim();
    const model = encodeURIComponent(modelName);
    const generationConfig = { maxOutputTokens: maxTokens };
    // Gemini 2.5 Flash models think by default and thought tokens count
    // against maxOutputTokens — small budgets would return empty text.
    // thinkingBudget: 0 disables thinking (only Flash models allow 0; Pro
    // rejects it, so gate on the model name).
    if (/^gemini-2\.5-flash/.test(modelName)) {
        generationConfig.thinkingConfig = { thinkingBudget: 0 };
    }
    const body = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig,
    };
    if (system) {
        body.systemInstruction = { parts: [{ text: system }] };
    }
    return {
        url: `${API_ROOT}/models/${model}:generateContent`,
        init: {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-goog-api-key': config.apiKey || '',
            },
            body: JSON.stringify(body),
        },
    };
}

/**
 * @param {any} json - generateContent response body.
 * @returns {string} The generated text.
 */
export function parseChatResponse(json) {
    const candidate = json?.candidates?.[0];
    const parts = candidate?.content?.parts;
    const text = Array.isArray(parts) ? parts.map(p => p?.text || '').join('') : '';
    if (!text.trim()) {
        const reason = candidate?.finishReason;
        throw new Error(`Empty response from Gemini API${reason ? ` (finishReason: ${reason})` : ''}`);
    }
    return text;
}

/**
 * @param {{apiKey: string, model: string}} config
 * @param {{system?: string, prompt: string, maxTokens?: number, signal?: AbortSignal}} params
 * @returns {Promise<string>}
 */
export async function chat(config, params) {
    const { url, init } = buildChatRequest(config, params);
    if (params.signal) init.signal = params.signal;
    return parseChatResponse(await fetchJson(url, init));
}

/**
 * Lists models as a cheap auth + reachability check.
 * @param {{apiKey: string}} config
 * @returns {Promise<{ok: boolean, code?: string, message?: string, models?: string[]}>}
 */
export async function testConnection(config) {
    try {
        const json = await fetchJson(`${API_ROOT}/models?pageSize=50`, {
            headers: { 'x-goog-api-key': config.apiKey || '' },
        });
        const models = (json?.models || [])
            .map(m => (m?.name || '').replace(/^models\//, ''))
            .filter(Boolean);
        return { ok: true, models };
    } catch (err) {
        return toTestFailure(err);
    }
}
