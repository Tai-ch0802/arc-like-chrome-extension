/**
 * Shared HTTP helpers for cloud AI provider clients.
 */

export class HttpError extends Error {
    /**
     * @param {number} status
     * @param {string} message
     */
    constructor(status, message) {
        super(message);
        this.name = 'HttpError';
        this.status = status;
    }
}

/**
 * Builds an HttpError from a non-2xx response, with a truncated body excerpt
 * for diagnosis. Scrubs key-shaped tokens — some providers echo (masked)
 * keys in 401 bodies and this message surfaces in the UI and console.
 * @param {Response} res
 * @returns {Promise<HttpError>}
 */
async function errorFromResponse(res) {
    let detail = '';
    try {
        detail = (await res.text())
            .slice(0, 200)
            .replace(/\bsk-[A-Za-z0-9_-]{8,}/g, 'sk-***');
    } catch { /* body unreadable — status alone will do */ }
    return new HttpError(res.status, `HTTP ${res.status}${detail ? `: ${detail}` : ''}`);
}

/**
 * fetch() a JSON endpoint; throws HttpError on non-2xx. Network/CORS
 * failures propagate as the original TypeError so callers can distinguish
 * them.
 * @param {string} url
 * @param {RequestInit} [init]
 * @returns {Promise<any>}
 */
export async function fetchJson(url, init) {
    const res = await fetch(url, init);
    if (!res.ok) {
        throw await errorFromResponse(res);
    }
    return res.json();
}

/**
 * fetch() a streaming endpoint and yield response-body lines as they
 * arrive. Suits both SSE (`data: {...}` lines) and NDJSON (bare JSON
 * lines) — callers strip their own framing.
 *
 * - Non-2xx throws HttpError through the same scrubbed path as fetchJson
 *   (the error body is fully buffered — error responses aren't streams).
 * - Lines split on \n with trailing \r trimmed; blank lines are skipped
 *   (SSE uses them as event separators, NDJSON never emits them).
 * - The decoder runs in streaming mode so multi-byte UTF-8 sequences split
 *   across network chunks decode correctly; an unterminated final line is
 *   flushed when the stream ends.
 * - Early exit (break / abort) cancels the underlying reader.
 * @param {string} url
 * @param {RequestInit} [init]
 * @returns {AsyncGenerator<string>}
 */
export async function* readStreamLines(url, init) {
    const res = await fetch(url, init);
    if (!res.ok) {
        throw await errorFromResponse(res);
    }
    if (!res.body) {
        throw new Error('Streaming not supported: response has no body');
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let newlineAt;
            while ((newlineAt = buffer.indexOf('\n')) !== -1) {
                const line = buffer.slice(0, newlineAt).replace(/\r$/, '');
                buffer = buffer.slice(newlineAt + 1);
                if (line.trim()) yield line;
            }
        }
        buffer += decoder.decode(); // flush any buffered partial code point
        const tail = buffer.replace(/\r$/, '');
        if (tail.trim()) yield tail;
    } finally {
        // Reached on early generator return (consumer break) too — release
        // the connection instead of letting the download run to completion.
        try { await reader.cancel(); } catch { /* already closed/errored */ }
    }
}

/**
 * Drives a streaming request to completion: feeds each body line through
 * the provider's parseLine, forwards text deltas to onChunk, and stops at
 * the provider's done sentinel. Returns the accumulated text (possibly
 * empty — the provider owns its "empty response" error message).
 * @param {string} url
 * @param {RequestInit} init
 * @param {(line: string) => ({text?: string, done?: boolean}|null)} parseLine
 * @param {(chunk: string) => void} [onChunk]
 * @returns {Promise<string>}
 */
export async function consumeStreamText(url, init, parseLine, onChunk) {
    let full = '';
    for await (const line of readStreamLines(url, init)) {
        const evt = parseLine(line);
        if (!evt) continue;
        if (evt.text) {
            full += evt.text;
            if (onChunk) onChunk(evt.text);
        }
        if (evt.done) break;
    }
    return full;
}

/**
 * Maps a caught error to a testConnection result.
 * `code: 'network'` marks fetch-level failures (unreachable host, CORS
 * rejection) so the UI can show provider-specific hints (e.g. Ollama's
 * OLLAMA_ORIGINS requirement).
 * @param {unknown} err
 * @returns {{ok: false, code: 'network'|'http', message: string}}
 */
export function toTestFailure(err) {
    const isNetwork = err instanceof TypeError;
    return {
        ok: false,
        code: isNetwork ? 'network' : 'http',
        message: (err && err.message) || String(err),
    };
}

/**
 * Normalizes a user-supplied base URL: trims whitespace and trailing slashes.
 * @param {string} baseUrl
 * @returns {string}
 */
export function normalizeBaseUrl(baseUrl) {
    return (baseUrl || '').trim().replace(/\/+$/, '');
}

/**
 * True when a base URL uses cleartext http: toward a NON-local host —
 * i.e. the API key would travel unencrypted over the network. Local hosts
 * (localhost, 127.x, ::1, *.localhost) are exempt: that's Ollama's default.
 * Unparsable URLs return false (other validation owns that case).
 * @param {string} baseUrl
 * @returns {boolean}
 */
export function isInsecureRemoteBaseUrl(baseUrl) {
    let url;
    try {
        url = new URL((baseUrl || '').trim());
    } catch {
        return false;
    }
    if (url.protocol !== 'http:') return false;
    const host = url.hostname.toLowerCase();
    const isLocal = host === 'localhost'
        || host === '[::1]'
        || host.endsWith('.localhost')
        || /^127(\.\d{1,3}){3}$/.test(host);
    return !isLocal;
}
