/**
 * Anthropic Claude API provider (api.anthropic.com).
 *
 * Called directly from the browser with the user's own key, which requires
 * the `anthropic-dangerous-direct-browser-access: true` opt-in header.
 * Sampling params (temperature/top_p/top_k) are intentionally never sent —
 * current Claude models (Opus 4.7+/Sonnet 5) reject them with a 400.
 */
import { fetchJson, toTestFailure } from './httpUtils.js';

const API_ROOT = 'https://api.anthropic.com/v1';

/** @param {{apiKey: string}} config */
function buildHeaders(config) {
    return {
        'content-type': 'application/json',
        'x-api-key': config.apiKey || '',
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
    };
}

/**
 * Builds the /v1/messages request. Pure — unit-testable without fetch.
 * @param {{apiKey: string, model: string}} config
 * @param {{system?: string, prompt: string, maxTokens?: number}} params
 * @returns {{url: string, init: RequestInit}}
 */
export function buildChatRequest(config, { system, prompt, maxTokens = 1024 }) {
    const body = {
        model: (config.model || '').trim(),
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
    };
    if (system) {
        body.system = system;
    }
    return {
        url: `${API_ROOT}/messages`,
        init: {
            method: 'POST',
            headers: buildHeaders(config),
            body: JSON.stringify(body),
        },
    };
}

/**
 * @param {any} json - Messages API response body.
 * @returns {string} The generated text.
 */
export function parseChatResponse(json) {
    if (json?.stop_reason === 'refusal') {
        throw new Error('Anthropic API refused the request');
    }
    const blocks = Array.isArray(json?.content) ? json.content : [];
    const text = blocks
        .filter(b => b?.type === 'text')
        .map(b => b.text || '')
        .join('');
    if (!text.trim()) {
        throw new Error('Empty response from Anthropic API');
    }
    if (json?.stop_reason === 'max_tokens') {
        console.warn('[ai] Anthropic response hit max_tokens; output may be truncated');
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
        const json = await fetchJson(`${API_ROOT}/models?limit=50`, {
            headers: buildHeaders(config),
        });
        const models = (json?.data || []).map(m => m?.id).filter(Boolean);
        return { ok: true, models };
    } catch (err) {
        return toTestFailure(err);
    }
}
