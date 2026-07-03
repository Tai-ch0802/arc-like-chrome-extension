/**
 * Ollama provider (local LLM server, default http://localhost:11434).
 *
 * NOTE: Ollama rejects cross-origin requests from extensions unless started
 * with OLLAMA_ORIGINS=chrome-extension://* — the settings UI surfaces this
 * hint when testConnection reports a network-level failure.
 */
import { fetchJson, consumeStreamText, toTestFailure, normalizeBaseUrl } from './httpUtils.js';

/** @param {{apiKey?: string}} config */
function buildHeaders(config) {
    const headers = { 'content-type': 'application/json' };
    // Optional bearer token for remote/proxied Ollama deployments.
    if (config.apiKey) {
        headers.authorization = `Bearer ${config.apiKey}`;
    }
    return headers;
}

/**
 * Builds the /api/chat request. Pure — unit-testable without fetch.
 * Streaming responses are NDJSON (one JSON object per line), not SSE.
 * @param {{apiKey?: string, model: string, baseUrl: string}} config
 * @param {{system?: string, prompt: string, maxTokens?: number, stream?: boolean}} params
 * @returns {{url: string, init: RequestInit}}
 */
export function buildChatRequest(config, { system, prompt, maxTokens = 1024, stream = false }) {
    const base = normalizeBaseUrl(config.baseUrl);
    const messages = [];
    if (system) {
        messages.push({ role: 'system', content: system });
    }
    messages.push({ role: 'user', content: prompt });
    return {
        url: `${base}/api/chat`,
        init: {
            method: 'POST',
            headers: buildHeaders(config),
            body: JSON.stringify({
                model: (config.model || '').trim(),
                messages,
                stream: !!stream,
                options: { num_predict: maxTokens },
            }),
        },
    };
}

/**
 * @param {any} json - /api/chat response body.
 * @returns {string} The generated text.
 */
export function parseChatResponse(json) {
    const text = json?.message?.content || '';
    if (!text.trim()) {
        throw new Error('Empty response from Ollama');
    }
    return text;
}

/**
 * @param {{apiKey?: string, model: string, baseUrl: string}} config
 * @param {{system?: string, prompt: string, maxTokens?: number, signal?: AbortSignal}} params
 * @returns {Promise<string>}
 */
export async function chat(config, params) {
    const { url, init } = buildChatRequest(config, params);
    if (params.signal) init.signal = params.signal;
    return parseChatResponse(await fetchJson(url, init));
}

/**
 * Parses one NDJSON line from a streaming /api/chat response. Pure.
 * @param {string} line
 * @returns {{text?: string, done?: boolean}|null}
 */
export function parseStreamLine(line) {
    let json;
    try {
        json = JSON.parse(line);
    } catch {
        return null;
    }
    if (json?.error) {
        throw new Error(`Ollama stream error: ${json.error}`);
    }
    const text = json?.message?.content || '';
    const done = json?.done === true;
    if (!text && !done) return null;
    return { ...(text ? { text } : {}), ...(done ? { done: true } : {}) };
}

/**
 * Streaming chat: onChunk fires per token batch; resolves with the full text.
 * @param {{apiKey?: string, model: string, baseUrl: string}} config
 * @param {{system?: string, prompt: string, maxTokens?: number, signal?: AbortSignal}} params
 * @param {(chunk: string) => void} [onChunk]
 * @returns {Promise<string>}
 */
export async function chatStream(config, params, onChunk) {
    const { url, init } = buildChatRequest(config, { ...params, stream: true });
    if (params.signal) init.signal = params.signal;
    const full = await consumeStreamText(url, init, parseStreamLine, onChunk);
    if (!full.trim()) {
        throw new Error('Empty response from Ollama');
    }
    return full;
}

/**
 * GET /api/tags — lists locally installed models.
 * @param {{apiKey?: string, baseUrl: string}} config
 * @returns {Promise<{ok: boolean, code?: string, message?: string, models?: string[]}>}
 */
export async function testConnection(config) {
    const base = normalizeBaseUrl(config.baseUrl);
    try {
        const json = await fetchJson(`${base}/api/tags`, { headers: buildHeaders(config) });
        const models = (json?.models || []).map(m => m?.name).filter(Boolean);
        return { ok: true, models };
    } catch (err) {
        return toTestFailure(err);
    }
}
