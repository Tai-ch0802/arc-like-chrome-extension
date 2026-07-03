/**
 * OpenAI-compatible provider.
 *
 * Targets any /chat/completions endpoint speaking the OpenAI wire format:
 * api.openai.com itself, or gateways like LiteLLM / one-api / OpenRouter.
 * The base URL is user-supplied (e.g. https://api.openai.com/v1).
 */
import { fetchJson, toTestFailure, normalizeBaseUrl, HttpError } from './httpUtils.js';

/**
 * Builds the chat/completions request. Pure — unit-testable without fetch.
 * @param {{apiKey: string, model: string, baseUrl: string}} config
 * @param {{system?: string, prompt: string, maxTokens?: number}} params
 * @returns {{url: string, init: RequestInit}}
 */
export function buildChatRequest(config, { system, prompt, maxTokens = 1024 }) {
    const base = normalizeBaseUrl(config.baseUrl);
    const messages = [];
    if (system) {
        messages.push({ role: 'system', content: system });
    }
    messages.push({ role: 'user', content: prompt });
    const headers = { 'content-type': 'application/json' };
    if (config.apiKey) {
        headers.authorization = `Bearer ${config.apiKey}`;
    }
    return {
        url: `${base}/chat/completions`,
        init: {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: (config.model || '').trim(),
                messages,
                max_tokens: maxTokens,
            }),
        },
    };
}

/**
 * @param {any} json - chat/completions response body.
 * @returns {string} The generated text.
 */
export function parseChatResponse(json) {
    const text = json?.choices?.[0]?.message?.content || '';
    if (!text.trim()) {
        throw new Error('Empty response from OpenAI-compatible API');
    }
    return text;
}

/**
 * @param {{apiKey: string, model: string, baseUrl: string}} config
 * @param {{system?: string, prompt: string, maxTokens?: number}} params
 * @returns {Promise<string>}
 */
export async function chat(config, params) {
    const { url, init } = buildChatRequest(config, params);
    return parseChatResponse(await fetchJson(url, init));
}

/**
 * GET {base}/models; some compat servers don't implement it (404/405), so
 * fall back to a minimal 1-token chat call before declaring failure.
 * @param {{apiKey: string, model: string, baseUrl: string}} config
 * @returns {Promise<{ok: boolean, code?: string, message?: string, models?: string[]}>}
 */
export async function testConnection(config) {
    const base = normalizeBaseUrl(config.baseUrl);
    const headers = {};
    if (config.apiKey) {
        headers.authorization = `Bearer ${config.apiKey}`;
    }
    try {
        const json = await fetchJson(`${base}/models`, { headers });
        const models = (json?.data || []).map(m => m?.id).filter(Boolean);
        return { ok: true, models };
    } catch (err) {
        const listUnsupported = err instanceof HttpError && (err.status === 404 || err.status === 405);
        if (!listUnsupported) return toTestFailure(err);
    }
    try {
        await chat(config, { prompt: 'ping', maxTokens: 1 });
        return { ok: true };
    } catch (err) {
        return toTestFailure(err);
    }
}
