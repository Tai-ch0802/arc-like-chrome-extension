/**
 * @file syncProvider.js
 * SyncProvider seam — a thin "versioned key-value store" abstraction over a
 * sync backend (eventually Google Drive's appDataFolder). The sync engine talks
 * ONLY to this interface, so:
 *   - {@link NoopSyncProvider} keeps local-only behavior unchanged (sync off).
 *   - {@link createFakeSyncProvider} makes conflict/bootstrap logic testable in
 *     plain Node, with no chrome/network/OAuth dependencies.
 *
 * This module is intentionally pure JS (just a Map): no chrome, no fetch, no
 * imports — so it loads cleanly in unit tests.
 *
 * @typedef {Object} FileEntry
 * @property {string} name     Drive file name, e.g. `ws_<workspaceId>.json`,
 *                             `appdata-index.json`,
 *                             `ws_<id>.conflict-<deviceId>.json`.
 * @property {string} fileId   Backend file id.
 * @property {number} version  Monotonically-increasing server version (mirrors
 *                             Drive v3's server-side `version` field), bumped on
 *                             every write.
 *
 * @typedef {Object} ReadResult
 * @property {any}    json     Parsed JSON content of the file.
 * @property {number} version  Current version of the file.
 * @property {string} fileId   Backend file id.
 *
 * @typedef {Object} WriteResult
 * @property {number} version  The NEW version after the write (bumped).
 * @property {string} fileId   Backend file id.
 *
 * SyncProvider interface (all methods async):
 * @typedef {Object} SyncProvider
 * @property {() => Promise<boolean>}                     isConnected
 *           Is the backend connected/authed.
 * @property {() => Promise<FileEntry[]>}                 list
 *           List all stored files.
 * @property {(name: string) => Promise<ReadResult|null>} read
 *           Read a file's parsed JSON + current version; null if absent.
 * @property {(name: string, json: any) => Promise<WriteResult>} write
 *           Create or replace the file with `json`; returns the NEW version
 *           (bumped on every write).
 * @property {(name: string) => Promise<void>}            remove
 *           Permanently delete the file (no-op if absent).
 */

/**
 * Default provider when sync is disabled. Everything is inert and never throws.
 * The engine checks `isConnected()` first, so Noop simply makes all calls safe
 * no-ops while preserving local-only behavior.
 *
 * @implements {SyncProvider}
 */
export class NoopSyncProvider {
    /** @returns {Promise<boolean>} always false. */
    async isConnected() {
        return false;
    }

    /** @returns {Promise<FileEntry[]>} always empty. */
    async list() {
        return [];
    }

    /**
     * @param {string} _name
     * @returns {Promise<null>} always null.
     */
    async read(_name) {
        return null;
    }

    /**
     * @param {string} _name
     * @param {any} _json
     * @returns {Promise<WriteResult>} inert result `{ version: 0, fileId: '' }`.
     */
    async write(_name, _json) {
        return { version: 0, fileId: '' };
    }

    /**
     * @param {string} _name
     * @returns {Promise<void>}
     */
    async remove(_name) {
        // no-op
    }
}

/**
 * Deep clone via JSON round-trip. Used so callers can't mutate stored state and
 * stored state can't leak mutable references back to callers.
 *
 * @param {any} value
 * @returns {any}
 */
function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
}

/**
 * Create an in-memory fake SyncProvider for tests. Backed by a
 * `Map<name, { json, version, fileId }>`.
 *
 * @param {Object} [opts]
 * @param {boolean} [opts.connected=true] Value returned by `isConnected()`.
 * @returns {SyncProvider & { __failNext(method: string, error: Error): void }}
 *          A SyncProvider plus a test-only `__failNext` fault-injection helper.
 */
export function createFakeSyncProvider(opts = {}) {
    const connected = opts.connected ?? true;
    /** @type {Map<string, { json: any, version: number, fileId: string }>} */
    const store = new Map();
    let idSeq = 0;

    /** @type {Map<string, Error>} pending one-shot failures keyed by method. */
    const pendingFailures = new Map();

    /**
     * Throw (and clear) a queued one-shot failure for `method`, if any.
     * @param {string} method
     */
    function maybeFail(method) {
        if (pendingFailures.has(method)) {
            const error = pendingFailures.get(method);
            pendingFailures.delete(method);
            throw error;
        }
    }

    return {
        async isConnected() {
            return connected;
        },

        async list() {
            maybeFail('list');
            return Array.from(store.entries()).map(([name, entry]) => ({
                name,
                fileId: entry.fileId,
                version: entry.version,
            }));
        },

        async read(name) {
            maybeFail('read');
            const entry = store.get(name);
            if (!entry) return null;
            return {
                json: deepClone(entry.json),
                version: entry.version,
                fileId: entry.fileId,
            };
        },

        async write(name, json) {
            maybeFail('write');
            const cloned = deepClone(json);
            const existing = store.get(name);
            if (existing) {
                existing.version += 1;
                existing.json = cloned;
                return { version: existing.version, fileId: existing.fileId };
            }
            idSeq += 1;
            const fileId = `fake_${name}_${idSeq}`;
            store.set(name, { json: cloned, version: 1, fileId });
            return { version: 1, fileId };
        },

        async remove(name) {
            maybeFail('remove');
            store.delete(name);
        },

        /**
         * TEST-ONLY fault injection. Make the next call to `method` reject once
         * with `error` (e.g. to simulate a 401/quota error); the following call
         * succeeds normally.
         *
         * @param {'list'|'read'|'write'|'remove'} method
         * @param {Error} error
         * @returns {void}
         */
        __failNext(method, error) {
            pendingFailures.set(method, error);
        },
    };
}
