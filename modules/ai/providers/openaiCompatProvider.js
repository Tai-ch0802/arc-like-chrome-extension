/**
 * OpenAI-compatible provider.
 *
 * Targets any /chat/completions endpoint speaking the OpenAI wire format:
 * api.openai.com itself, or gateways like LiteLLM / one-api / OpenRouter /
 * LM Studio / llama.cpp. The base URL is user-supplied
 * (e.g. https://api.openai.com/v1). API key is optional — keyless local
 * gateways are common.
 */
import { fetchJson, toTestFailure, normalizeBaseUrl, HttpError } from './httpUtils.js';

/**
 * Builds the chat/completions request. Pure — unit-testable without fetch.
 * @param {{apiKey?: string, model: string, baseUrl: string}} config
 * @param {{system?: string, prompt: string, maxTokens?: number, tokenParam?: string}} params
 *        tokenParam: 'max_tokens' (default, widest gateway compat) or
 *        'max_completion_tokens' (required by newer OpenAI reasoning models).
 * @returns {{url: string, init: RequestInit}}
 */
export function buildChatRequest(config, { system, prompt, maxTokens = 1024, tokenParam = 'max_tokens' }) {
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
                [tokenParam]: maxTokens,
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
 * Sends the chat request, retrying once with `max_completion_tokens` when
 * the server rejects `max_tokens` (newer OpenAI models require the former;
 * older models and most compat gateways only accept the latter).
 * @returns {Promise<any>} Raw response JSON.
 */
async function requestChat(config, params) {
    const first = buildChatRequest(config, params);
    if (params.signal) first.init.signal = params.signal;
    try {
        return await fetchJson(first.url, first.init);
    } catch (err) {
        const needsCompletionParam = err instanceof HttpError
            && err.status === 400
            && /max_completion_tokens/.test(err.message);
        if (!needsCompletionParam) throw err;
        const retry = buildChatRequest(config, { ...params, tokenParam: 'max_completion_tokens' });
        if (params.signal) retry.init.signal = params.signal;
        return fetchJson(retry.url, retry.init);
    }
}

/**
 * @param {{apiKey?: string, model: string, baseUrl: string}} config
 * @param {{system?: string, prompt: string, maxTokens?: number, signal?: AbortSignal}} params
 * @returns {Promise<string>}
 */
export async function chat(config, params) {
    return parseChatResponse(await requestChat(config, params));
}

/**
 * GET {base}/models; some compat servers don't implement it (404/405), so
 * fall back to a minimal chat call. Any HTTP-200 chat response counts as
 * success — reasoning models may return empty text on a 1-token probe.
 * @param {{apiKey?: string, model: string, baseUrl: string}} config
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
        await requestChat(config, { prompt: 'ping', maxTokens: 1 });
        return { ok: true };
    } catch (err) {
        return toTestFailure(err);
    }
}
