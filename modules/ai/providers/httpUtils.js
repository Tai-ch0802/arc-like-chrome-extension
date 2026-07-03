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
 * fetch() a JSON endpoint; throws HttpError on non-2xx (with a truncated
 * response-body excerpt for diagnosis). Network/CORS failures propagate as
 * the original TypeError so callers can distinguish them.
 * @param {string} url
 * @param {RequestInit} [init]
 * @returns {Promise<any>}
 */
export async function fetchJson(url, init) {
    const res = await fetch(url, init);
    if (!res.ok) {
        let detail = '';
        try {
            // Scrub key-shaped tokens — some providers echo (masked) keys in
            // 401 bodies and this message surfaces in the UI and console.
            detail = (await res.text())
                .slice(0, 200)
                .replace(/\bsk-[A-Za-z0-9_-]{8,}/g, 'sk-***');
        } catch { /* body unreadable — status alone will do */ }
        throw new HttpError(res.status, `HTTP ${res.status}${detail ? `: ${detail}` : ''}`);
    }
    return res.json();
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
