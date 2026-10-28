/**
 * @file prefsSync.js
 * One preferences sync cycle against a SyncProvider (ISSUE-257 WP3).
 *
 * Mirrors the RSS cycle in background.js: read `settings-sync.json`, merge
 * per-key LWW with the local pref_* records (prefsSyncLogic — commutative and
 * idempotent, "absent = no claim"), then write each side back only where it
 * differs. The no-op write guard is what makes the cycle converge in <= 2
 * runs: importing remote values triggers storage.onChanged → one more cycle
 * that finds nothing to write → stop. A remote file with a newer schema is
 * imported (we take what we understand) but never overwritten.
 *
 * Pure orchestration over injected pieces so it runs end-to-end in Node with
 * the in-memory fake provider; background.js wraps it in a single-flight chain.
 */
import { mergePrefsState, prefsStateEqual, isPrefsSchemaTooNew, PREFS_SYNC_SCHEMA } from './prefsSyncLogic.js';

/** Drive appDataFolder file name (safely skipped by the workspace `/^ws_/` pull filter). */
export const PREFS_SYNC_FILE = 'settings-sync.json';

/**
 * @param {Object} deps
 * @param {import('../sync/syncProvider.js').SyncProvider} deps.provider
 * @param {{exportState: () => Promise<Object>, importMerged: (entries: Object) => Promise<string[]>}} deps.store
 * @param {string} [deps.fileName]
 * @param {() => boolean} [deps.isOnline]
 * @returns {Promise<{imported: string[], pushed: boolean}>}
 */
export async function runPrefsSync({ provider, store, fileName = PREFS_SYNC_FILE, isOnline = () => true }) {
    const result = { imported: [], pushed: false };
    if (!(await provider.isConnected())) return result;
    if (!isOnline()) return result;

    const remoteFile = await provider.read(fileName);
    const remote = (remoteFile && remoteFile.json) || { schema: PREFS_SYNC_SCHEMA, entries: {} };
    const local = await store.exportState();
    const merged = mergePrefsState(local, remote);

    if (!prefsStateEqual(merged, local)) {
        result.imported = await store.importMerged(merged.entries);
    }
    if (isPrefsSchemaTooNew(remote)) return result; // a newer client owns the file
    if (!prefsStateEqual(merged, remote)) {
        await provider.write(fileName, merged);
        result.pushed = true;
    }
    return result;
}
