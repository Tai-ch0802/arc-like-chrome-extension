/**
 * Google Gemini API provider (generativelanguage.googleapis.com).
 */
import { fetchJson, consumeStreamText, toTestFailure } from './httpUtils.js';

const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * Extra output tokens reserved for the "thinking" phase on Gemini models that
 * can't turn thinking off (2.5 Pro, 3.x). Thought tokens are billed against
 * maxOutputTokens, so without headroom a small caller budget (e.g. a 200-token
 * hover summary) is spent ENTIRELY on thinking and the visible answer comes
 * back empty/truncated (finishReason: MAX_TOKENS). maxOutputTokens is a cap,
 * not a target, so over-reserving costs nothing when thinking is light.
 */
const GEMINI_THINKING_RESERVE = 2048;

/**
 * Builds the generateContent request. Pure — unit-testable without fetch.
 * The API key travels in the `x-goog-api-key` header (never the URL, which
 * would leak it into logs and error messages).
 * Streaming requests hit :streamGenerateContent?alt=sse instead — the key
 * stays in the header either way (`alt` is the only query param).
 * @param {{apiKey: string, model: string}} config
 * @param {{system?: string, prompt: string, maxTokens?: number, stream?: boolean}} params
 * @returns {{url: string, init: RequestInit}}
 */
export function buildChatRequest(config, { system, prompt, maxTokens = 1024, stream = false }) {
    const modelName = (config.model || '').trim();
    const model = encodeURIComponent(modelName);
    const generationConfig = { maxOutputTokens: maxTokens };
    // Gemini thinking models bill thought tokens against maxOutputTokens.
    // Gemini 2.5 Flash lets us turn thinking OFF entirely (thinkingBudget: 0),
    // so the whole budget goes to the answer. Other models (2.5 Pro, 3.x —
    // e.g. gemini-3.5-flash) think by default and REJECT thinkingBudget: 0, so
    // we instead reserve extra output headroom; otherwise a small budget is
    // consumed by thinking and the answer is truncated (finishReason: MAX_TOKENS).
    if (/^gemini-2\.5-flash/.test(modelName)) {
        generationConfig.thinkingConfig = { thinkingBudget: 0 };
    } else {
        generationConfig.maxOutputTokens = maxTokens + GEMINI_THINKING_RESERVE;
    }
    const body = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig,
    };
    if (system) {
        body.systemInstruction = { parts: [{ text: system }] };
    }
    return {
        url: stream
            ? `${API_ROOT}/models/${model}:streamGenerateContent?alt=sse`
            : `${API_ROOT}/models/${model}:generateContent`,
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
 * Parses one SSE line from a streamGenerateContent?alt=sse response.
 * Each data line is a full GenerateContentResponse-shaped delta. Pure.
 * @param {string} line
 * @returns {{text?: string, done?: boolean}|null}
 */
export function parseStreamLine(line) {
    if (!line.startsWith('data:')) return null;
    let json;
    try {
        json = JSON.parse(line.slice(5).trim());
    } catch {
        return null;
    }
    // In-band error frames (HTTP 200 + {"error": ...}) must fail the stream,
    // not silently truncate the summary.
    if (json?.error) {
        throw new Error(`Gemini stream error: ${json.error.message || 'unknown'}`);
    }
    const parts = json?.candidates?.[0]?.content?.parts;
    const text = Array.isArray(parts) ? parts.map(p => p?.text || '').join('') : '';
    return text ? { text } : null;
}

/**
 * Streaming chat: onChunk fires per text delta; resolves with the full text.
 * @param {{apiKey: string, model: string}} config
 * @param {{system?: string, prompt: string, maxTokens?: number, signal?: AbortSignal}} params
 * @param {(chunk: string) => void} [onChunk]
 * @returns {Promise<string>}
 */
export async function chatStream(config, params, onChunk) {
    const { url, init } = buildChatRequest(config, { ...params, stream: true });
    if (params.signal) init.signal = params.signal;
    const full = await consumeStreamText(url, init, parseStreamLine, onChunk);
    if (!full.trim()) {
        throw new Error('Empty response from Gemini API');
    }
    return full;
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
