/**
 * @file googleDriveProvider.js
 * A {@link module:syncProvider~SyncProvider} backed by Google Drive v3 REST over
 * the hidden `appDataFolder` space, authed via {@link module:driveAuth~authedFetch}.
 *
 * The Drive `appDataFolder` is app-private, hidden from the user's Drive UI, and
 * auto-deleted on uninstall — exactly the persistence layer we want for the heavy
 * tab snapshots (metadata stays in chrome.storage.sync; see design batch E).
 *
 * Responsibilities are intentionally narrow: build the right Drive requests, parse
 * responses, and throw on unexpected non-ok statuses. The 401→refresh→retry-once is
 * handled inside `authedFetch`; backoff / quota classification lives in the engine (E3).
 *
 * `authedFetch` and `isConnected` are INJECTABLE so this is unit-testable with a
 * mock fetch — no live OAuth needed. They default to the real ones from `./driveAuth.js`.
 *
 * SECURITY: never log the token or full file bodies.
 */

import * as driveAuth from './driveAuth.js';

const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

/** Fixed multipart boundary for `multipart/related` create bodies. */
const MULTIPART_BOUNDARY = 'arc_sidebar_drive_boundary_2f1d';

/**
 * Read a response body as text and throw a descriptive (token-free) error.
 * @param {Response} res
 * @param {string} op  short label for the failing operation
 * @returns {Promise<never>}
 */
async function throwNonOk(res, op) {
    // Best-effort detail; never include the request URL/token in the message.
    let detail = '';
    try {
        detail = await res.text();
    } catch {
        /* ignore */
    }
    // Keep detail short to avoid leaking full file bodies into logs.
    const snippet = detail ? ` ${detail.slice(0, 200)}` : '';
    const err = new Error(`drive-provider: ${op} failed (status ${res.status})${snippet}`);
    err.status = res.status;
    throw err;
}

/**
 * Create a SyncProvider over the Drive appDataFolder.
 *
 * @param {{authedFetch?: Function, isConnected?: Function}} [deps] inject for tests
 * @returns {import('./syncProvider.js').SyncProvider} SyncProvider over appDataFolder
 */
export function createGoogleDriveProvider(deps = {}) {
    const authedFetch = deps.authedFetch || driveAuth.authedFetch;
    const isConnectedFn = deps.isConnected || driveAuth.isConnected;
    /** @type {Map<string,string>} name -> fileId cache (avoids repeated lookups) */
    const idCache = new Map();

    /**
     * Resolve a file's id by name: cache first, else a `files.list` q-lookup
     * scoped to appDataFolder. Returns `{ fileId, version }` (version may be
     * undefined when only the id was cached without a version), or null if absent.
     *
     * @param {string} name
     * @returns {Promise<{fileId: string, version?: number}|null>}
     */
    async function resolveByName(name) {
        const cachedId = idCache.get(name);
        if (cachedId) return { fileId: cachedId };

        const q = encodeURIComponent(`name='${name}'`);
        const url = `${DRIVE_FILES}?q=${q}&spaces=appDataFolder&fields=${encodeURIComponent('files(id,version)')}`;
        const res = await authedFetch(url, { method: 'GET' });
        if (!res.ok) await throwNonOk(res, 'lookup');
        const data = await res.json();
        const file = data && Array.isArray(data.files) ? data.files[0] : undefined;
        if (!file) return null;
        idCache.set(name, file.id);
        return { fileId: file.id, version: file.version != null ? Number(file.version) : undefined };
    }

    /**
     * Build a `multipart/related` body: part 1 = JSON metadata, part 2 = JSON content.
     * @param {object} metadata
     * @param {any} json
     * @returns {string}
     */
    function buildMultipartBody(metadata, json) {
        const delimiter = `--${MULTIPART_BOUNDARY}`;
        const closeDelimiter = `--${MULTIPART_BOUNDARY}--`;
        return [
            delimiter,
            'Content-Type: application/json; charset=UTF-8',
            '',
            JSON.stringify(metadata),
            delimiter,
            'Content-Type: application/json; charset=UTF-8',
            '',
            JSON.stringify(json),
            closeDelimiter,
            '',
        ].join('\r\n');
    }

    return {
        /** @returns {Promise<boolean>} */
        async isConnected() {
            return isConnectedFn();
        },

        /** @returns {Promise<import('./syncProvider.js').FileEntry[]>} */
        async list() {
            /** @type {import('./syncProvider.js').FileEntry[]} */
            const out = [];
            const fields = encodeURIComponent('files(id,name,version),nextPageToken');
            let pageToken = '';
            do {
                let url = `${DRIVE_FILES}?spaces=appDataFolder&fields=${fields}&pageSize=100`;
                if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;
                const res = await authedFetch(url, { method: 'GET' });
                if (!res.ok) await throwNonOk(res, 'list');
                const data = await res.json();
                const files = (data && data.files) || [];
                for (const f of files) {
                    idCache.set(f.name, f.id);
                    out.push({ name: f.name, fileId: f.id, version: Number(f.version) });
                }
                pageToken = (data && data.nextPageToken) || '';
            } while (pageToken);
            return out;
        },

        /**
         * @param {string} name
         * @returns {Promise<import('./syncProvider.js').ReadResult|null>}
         */
        async read(name) {
            const resolved = await resolveByName(name);
            if (!resolved) return null;
            const { fileId } = resolved;

            // alt=media body carries no version; ensure we have one via metadata.
            let { version } = resolved;
            if (version == null) {
                const metaUrl = `${DRIVE_FILES}/${fileId}?fields=version`;
                const metaRes = await authedFetch(metaUrl, { method: 'GET' });
                if (!metaRes.ok) await throwNonOk(metaRes, 'read-metadata');
                const meta = await metaRes.json();
                version = Number(meta.version);
            }

            const mediaUrl = `${DRIVE_FILES}/${fileId}?alt=media`;
            const mediaRes = await authedFetch(mediaUrl, { method: 'GET' });
            if (!mediaRes.ok) await throwNonOk(mediaRes, 'read-media');
            const json = await mediaRes.json();

            idCache.set(name, fileId);
            return { json, version: Number(version), fileId };
        },

        /**
         * @param {string} name
         * @param {any} json
         * @returns {Promise<import('./syncProvider.js').WriteResult>}
         */
        async write(name, json) {
            const resolved = await resolveByName(name);
            const fields = encodeURIComponent('id,version');

            let res;
            if (resolved && resolved.fileId) {
                // Update existing content via a simple media upload.
                const url = `${DRIVE_UPLOAD}/${resolved.fileId}?uploadType=media&fields=${fields}`;
                res = await authedFetch(url, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(json),
                });
            } else {
                // Create a new file in appDataFolder via multipart upload.
                const url = `${DRIVE_UPLOAD}?uploadType=multipart&fields=${fields}`;
                const metadata = { name, parents: ['appDataFolder'] };
                res = await authedFetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': `multipart/related; boundary=${MULTIPART_BOUNDARY}` },
                    body: buildMultipartBody(metadata, json),
                });
            }

            if (!res.ok) await throwNonOk(res, 'write');
            const data = await res.json();
            idCache.set(name, data.id);
            return { version: Number(data.version), fileId: data.id };
        },

        /**
         * @param {string} name
         * @returns {Promise<void>}
         */
        async remove(name) {
            const resolved = await resolveByName(name);
            if (!resolved || !resolved.fileId) return; // already gone

            const url = `${DRIVE_FILES}/${resolved.fileId}`;
            const res = await authedFetch(url, { method: 'DELETE' });
            // 404 = already gone (idempotent). 2xx (incl. 204) = deleted.
            if (res.status === 404) {
                idCache.delete(name);
                return;
            }
            if (!res.ok) await throwNonOk(res, 'remove');
            idCache.delete(name);
        },
    };
}
