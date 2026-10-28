/**
 * @file readingListSync.js
 * One reading-list sync cycle against a SyncProvider (ISSUE-257 WP4).
 *
 * read reading-list-sync.json → export local (chrome.readingList + sidecar)
 * → mergeReadingListState (commutative, idempotent, tombstone-aware)
 * → apply the diff to chrome.readingList (echo-guarded) → write the file
 * back only when it differs (no-op guard → converges in <= 2 cycles).
 * A remote file with a newer schema is imported but never overwritten.
 */
import {
    mergeReadingListState,
    diffReadingList,
    readingListStateEqual,
    isReadingListSchemaTooNew,
    RL_SYNC_SCHEMA,
} from './readingListSyncLogic.js';

/** Drive appDataFolder file name (safely skipped by the workspace `/^ws_/` pull filter). */
export const READING_LIST_SYNC_FILE = 'reading-list-sync.json';

/**
 * @param {Object} deps
 * @param {import('../sync/syncProvider.js').SyncProvider} deps.provider
 * @param {ReturnType<import('./readingListSyncStore.js').createReadingListSyncStore>} deps.store
 * @param {() => number} [deps.now]
 * @param {string} [deps.fileName]
 * @param {() => boolean} [deps.isOnline]
 * @returns {Promise<{applied: {add:number, update:number, remove:number}, pushed: boolean}>}
 */
export async function runReadingListSync({ provider, store, now = () => Date.now(), fileName = READING_LIST_SYNC_FILE, isOnline = () => true }) {
    const result = { applied: { add: 0, update: 0, remove: 0 }, pushed: false };
    if (!(await provider.isConnected())) return result;
    if (!isOnline()) return result;

    const remoteFile = await provider.read(fileName);
    const remote = (remoteFile && remoteFile.json) || { schema: RL_SYNC_SCHEMA, entries: {}, tombstones: {} };
    const local = await store.exportState();
    const merged = mergeReadingListState(local, remote, { now: now() });

    if (!readingListStateEqual(merged, local)) {
        const diff = diffReadingList(await store.currentByUrl(), merged);
        await store.applyMerged(diff, merged);
        result.applied = { add: diff.add.length, update: diff.update.length, remove: diff.remove.length };
    }
    if (isReadingListSchemaTooNew(remote)) return result;
    if (!readingListStateEqual(merged, remote)) {
        await provider.write(fileName, merged);
        result.pushed = true;
    }
    return result;
}
