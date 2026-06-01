/**
 * @file syncEngine.js
 * The sync ENGINE (E3a) — the imperative orchestration core that drives the
 * PURE decision functions in {@link module:modules/sync/syncLogic} against a
 * {@link SyncProvider}. It owns the disk-first op queue, the push/pull flush
 * loop, conflict materialization (conflicted-copy files), and the restorable /
 * status surfaces.
 *
 * ## Dependency injection
 * EVERY external effect — provider I/O, local workspace state, the persisted
 * queue, time, and the device id — is injected via `deps`. The engine NEVER
 * touches `chrome`, `fetch`, `Date.now`, or `crypto` directly. This is what
 * lets the integration tests run the whole engine end-to-end against the
 * in-memory {@link createFakeSyncProvider} with no OAuth / network. In
 * `background.js` the same `deps` are wired to real chrome / workspaceManager
 * backends.
 *
 * ## Remote state authority: list-first, NOT the index file
 * The design mentions an advisory `appdata-index.json`. For v1 we deliberately
 * treat `provider.list()` + reading each `ws_<id>.json` as the AUTHORITATIVE
 * source of remote state (the index is only an optimization). This keeps the
 * engine simple and correct even if the index is stale or missing. The index
 * can be layered on later as a read cache without changing this contract.
 *
 * ## rev vs. version
 * `provider`'s `version` is the storage-layer (Drive) optimistic-lock detector
 * only. The cross-device ORDERING key is our app-controlled `rev` carried in the
 * file payload. All conflict/sync decisions use payload `rev`, never `version`.
 *
 * @module modules/sync/syncEngine
 */

import {
    SCHEMA_VERSION,
    decideSync,
    resolveConflict,
    decidePull,
    reconcile,
    coalesceQueue,
    tombstonesToGC,
    isSchemaTooNew,
} from './syncLogic.js';

/** Default tombstone GC grace window: 60 days in ms. */
const DEFAULT_GRACE_MS = 60 * 24 * 60 * 60 * 1000;

/**
 * @typedef {Object} SyncEngineDeps
 * @property {import('./syncProvider.js').SyncProvider} provider
 *           The backend seam (Noop / Fake / GoogleDrive).
 * @property {() => string} getDeviceId   Stable per-install device id.
 * @property {() => number} now           Epoch ms. Injected so tests are
 *           deterministic; the engine NEVER calls Date.now directly.
 * @property {() => Promise<Array<{id:string, rev:number, syncEnabled:boolean, metadata:any, tabSnapshot:any}>>} listLocalWorkspaces
 *           ALL local workspaces (the engine filters to syncEnabled itself).
 * @property {(id:string) => Promise<number>} getBaseRev
 *           Per-device last-synced rev for a workspace (0 if never synced).
 * @property {(id:string, rev:number) => Promise<void>} setBaseRev
 * @property {(id:string, fileJson:any) => Promise<void>} applyRemoteSnapshot
 *           Write a pulled metadata+tabSnapshot into the local workspace WITHOUT
 *           opening tabs. The engine calls setBaseRev afterwards.
 * @property {(id:string) => Promise<void>} removeLocalWorkspace
 *           Remove a materialized local workspace (confirmed remote tombstone).
 * @property {(id:string) => Promise<boolean>} isWorkspaceLiveBound
 *           True if the workspace is currently bound to a live window.
 * @property {() => Promise<Array<{type:'push'|'delete', workspaceId:string}>>} readQueue
 * @property {(ops:Array<{type:'push'|'delete', workspaceId:string}>) => Promise<void>} writeQueue
 * @property {(list:Array<{id:string, rev:number, metadata?:any}>) => Promise<void>} setRestorable
 *           Remote workspaces not materialized locally → "available to restore".
 * @property {(status:SyncStatus) => Promise<void>} setStatus
 * @property {number} [graceMs]  Tombstone GC window (default 60 days).
 *
 * @typedef {Object} SyncStatus
 * @property {'idle'|'syncing'|'error'|'conflict'|'offline'|'needs-auth'|'drive-full'|'needs-update'} state
 * @property {number} [lastSyncedAt]
 * @property {string} [message]
 * @property {string[]} [conflicts]  workspace ids in conflict.
 */

/** @param {string} id */
function wsName(id) {
    return `ws_${id}.json`;
}

/**
 * Classify a provider error into an engine status state, deciding whether to
 * keep the queue and stop. The provider/driveAuth layer is expected to surface
 * an HTTP-ish `status` and (for 403s) a Drive `reason`.
 *
 * - 401 → 'needs-auth' (auth expired/revoked; stop, keep queue).
 * - 403 storageQuotaExceeded → 'drive-full' (stop, keep queue).
 * - 403 rateLimit / 429 / 5xx / anything else → 'error' (stop, keep queue for
 *   the alarm to retry; we do NOT sleep/backoff in-loop — background owns
 *   cadence).
 *
 * @param {any} err
 * @returns {'needs-auth'|'drive-full'|'error'}
 */
function classifyError(err) {
    const status = err?.status ?? err?.code;
    if (status === 401) return 'needs-auth';
    if (status === 403) {
        const reason = (err?.reason || err?.message || '').toString();
        if (/storageQuotaExceeded|quota/i.test(reason)) return 'drive-full';
        return 'error';
    }
    return 'error';
}

/**
 * Create the sync engine.
 *
 * @param {SyncEngineDeps} deps
 * @returns {{
 *   enqueuePush(workspaceId: string): Promise<void>,
 *   enqueueDelete(workspaceId: string): Promise<void>,
 *   flushQueue(): Promise<void>,
 *   pullRemote(): Promise<void>,
 *   runOnce(): Promise<void>,
 *   restoreWorkspace(workspaceId: string): Promise<{ok: boolean, error?: string}>,
 * }}
 */
export function createSyncEngine(deps) {
    const {
        provider,
        getDeviceId,
        now,
        listLocalWorkspaces,
        getBaseRev,
        setBaseRev,
        applyRemoteSnapshot,
        removeLocalWorkspace,
        isWorkspaceLiveBound,
        readQueue,
        writeQueue,
        setRestorable,
        setStatus,
    } = deps;
    const graceMs = deps.graceMs ?? DEFAULT_GRACE_MS;

    // ---- queue helpers -----------------------------------------------------

    /**
     * Append an op, coalesce, and persist. We coalesce on every enqueue so the
     * on-disk queue stays minimal (at most one effective op per workspace).
     * @param {'push'|'delete'} type
     * @param {string} workspaceId
     */
    async function enqueue(type, workspaceId) {
        const ops = await readQueue();
        ops.push({ type, workspaceId });
        await writeQueue(coalesceQueue(ops));
    }

    async function enqueuePush(workspaceId) {
        await enqueue('push', workspaceId);
    }

    async function enqueueDelete(workspaceId) {
        await enqueue('delete', workspaceId);
    }

    // ---- local lookup helpers ---------------------------------------------

    /** @returns {Promise<Map<string, any>>} id -> local workspace record. */
    async function localById() {
        const all = await listLocalWorkspaces();
        return new Map(all.map((w) => [w.id, w]));
    }

    /**
     * Read a remote workspace file and normalize to {rev, deviceId, deleted,
     * schemaVersion, json} or null if absent.
     * @param {string} id
     */
    async function readRemote(id) {
        const res = await provider.read(wsName(id));
        if (!res || !res.json) return null;
        const j = res.json;
        return {
            rev: j.rev,
            deviceId: j.deviceId,
            deleted: j.deleted === true,
            schemaVersion: j.schemaVersion,
            json: j,
        };
    }

    /**
     * Build the file payload for pushing a local workspace.
     * @param {{id:string, rev:number, metadata:any, tabSnapshot:any}} ws
     */
    function buildPushPayload(ws) {
        return {
            schemaVersion: SCHEMA_VERSION,
            workspaceId: ws.id,
            rev: ws.rev,
            deviceId: getDeviceId(),
            updatedAt: now(),
            metadata: ws.metadata,
            tabSnapshot: ws.tabSnapshot,
        };
    }

    /**
     * Materialize a detected conflict: preserve the LOSER as a conflicted-copy
     * file (never discarded), install the WINNER as the canonical ws_<id>.json,
     * and if the remote won, apply it locally. Advances baseRev to the winner.
     *
     * @param {string} id
     * @param {{rev:number, metadata:any, tabSnapshot:any}} localWs
     * @param {{rev:number, deviceId:string, json:any}} remote
     * @param {Set<string>} conflictIds  accumulates ids for status reporting.
     */
    async function materializeConflict(id, localWs, remote, conflictIds) {
        const deviceId = getDeviceId();
        const localPayload = buildPushPayload(localWs);
        const { winner, loserConflictName } = resolveConflict(
            id,
            { rev: localWs.rev, deviceId },
            { rev: remote.rev, deviceId: remote.deviceId },
        );

        // Preserve the loser as a conflicted copy. The winner is whichever side
        // resolveConflict picked; the loser is the other side's payload.
        const loserPayload = winner === 'local' ? remote.json : localPayload;
        await provider.write(loserConflictName, loserPayload);

        if (winner === 'local') {
            // Local wins → publish our payload as canonical; baseRev = our rev.
            await provider.write(wsName(id), localPayload);
            await setBaseRev(id, localWs.rev);
        } else {
            // Remote wins → canonical stays the remote payload (already there,
            // but rewrite to be explicit/idempotent), apply it locally.
            await provider.write(wsName(id), remote.json);
            await applyRemoteSnapshot(id, remote.json);
            await setBaseRev(id, remote.rev);
        }
        conflictIds.add(id);
    }

    // ---- flush (push side) -------------------------------------------------

    /**
     * Process the persisted op queue idempotently. Connection is checked first;
     * if disconnected we set the appropriate status and leave the queue intact.
     * Each op is removed from the queue ONLY after its provider write acks. On a
     * provider error we classify it, set status, and STOP — keeping the failed
     * op (and the rest) for the next alarm-driven retry. No in-loop backoff.
     */
    async function flushQueue() {
        if (!(await provider.isConnected())) {
            await setStatus({ state: 'needs-auth' });
            return;
        }

        const ops = coalesceQueue(await readQueue());
        if (ops.length === 0) return;

        const conflictIds = new Set();
        const local = await localById();
        // Remaining ops we have NOT yet acked (start as the full list; shift off
        // as each succeeds). On error we persist this remainder and stop.
        const remaining = [...ops];

        for (const op of ops) {
            try {
                if (op.type === 'delete') {
                    await processDelete(op.workspaceId, local);
                } else {
                    await processPush(op.workspaceId, local, conflictIds);
                }
                // Ack: drop this op from the remaining queue.
                remaining.shift();
            } catch (err) {
                const state = classifyError(err);
                await writeQueue(remaining); // keep failed op + the rest
                await setStatus({ state, message: err?.message });
                return;
            }
        }

        await writeQueue(remaining); // should be empty here
        if (conflictIds.size > 0) {
            await setStatus({ state: 'conflict', conflicts: [...conflictIds] });
        }
    }

    /**
     * Push one workspace. Decides create/push/pull/conflict/in-sync via the pure
     * decideSync against the remote payload rev + our baseRev.
     * @param {string} id
     * @param {Map<string, any>} local
     * @param {Set<string>} conflictIds
     */
    async function processPush(id, local, conflictIds) {
        const ws = local.get(id);
        if (!ws) {
            // Local workspace gone (e.g. deleted before flush). Nothing to push;
            // a separate delete op handles tombstoning. Treat as ack.
            return;
        }
        const remote = await readRemote(id);
        const baseRev = await getBaseRev(id);
        const decision = decideSync(
            { rev: ws.rev, baseRev },
            remote ? { rev: remote.rev } : null,
        );

        switch (decision) {
            case 'create':
            case 'push': {
                await provider.write(wsName(id), buildPushPayload(ws));
                await setBaseRev(id, ws.rev);
                break;
            }
            case 'pull': {
                // Remote advanced while we were clean → fast-forward; don't push
                // stale. Apply remote unless its schema is too new.
                if (remote && isSchemaTooNew(remote.schemaVersion, SCHEMA_VERSION)) {
                    await setStatus({ state: 'needs-update', message: `ws ${id} schema ${remote.schemaVersion}` });
                    break;
                }
                await applyRemoteSnapshot(id, remote.json);
                await setBaseRev(id, remote.rev);
                break;
            }
            case 'conflict': {
                if (remote && isSchemaTooNew(remote.schemaVersion, SCHEMA_VERSION)) {
                    await setStatus({ state: 'needs-update', message: `ws ${id} schema ${remote.schemaVersion}` });
                    break;
                }
                await materializeConflict(id, ws, remote, conflictIds);
                break;
            }
            case 'in-sync':
            default:
                // No-op (idempotent re-push lands here once baseRev caught up).
                break;
        }
    }

    /**
     * Process a delete op by writing a tombstone file the OTHER devices will see
     * via decidePull. The tombstone rev advances past the last known rev so it
     * wins ordering.
     *
     * The local workspace is typically GONE here: a user delete removes the
     * workspace from local state, and only THEN does background.js enqueue the
     * delete (C1). So `local.get(id)` is usually undefined. We recover the last
     * known rev from, in priority order: the remote file's rev (if still
     * present), the local record's rev (if somehow still here), or the persisted
     * per-device baseRev (which survives the local delete) — guaranteeing a valid
     * `baseRev+1` tombstone even with no local workspace object.
     * @param {string} id
     * @param {Map<string, any>} local
     */
    async function processDelete(id, local) {
        const remote = await readRemote(id);
        if (remote && remote.deleted) {
            // Already tombstoned remotely — idempotent ack.
            return;
        }
        const ws = local.get(id);
        const knownRev = remote?.rev ?? ws?.rev ?? (await getBaseRev(id));
        const tombstone = {
            schemaVersion: SCHEMA_VERSION,
            workspaceId: id,
            rev: knownRev + 1,
            deviceId: getDeviceId(),
            updatedAt: now(),
            deleted: true,
            deletedAt: now(),
        };
        await provider.write(wsName(id), tombstone);
        await setBaseRev(id, tombstone.rev);
    }

    // ---- pull (read-mostly) -----------------------------------------------

    /**
     * Reconcile remote state into local. Reads ALL remote ws_<id>.json files via
     * list() (authoritative), builds the remote/local lists, and applies the
     * pure reconcile() decisions. Pull is read-mostly: push-create/push-update/
     * in-sync are left for flushQueue. Collects restorable, GCs old tombstones,
     * and finishes with an idle + lastSyncedAt status (unless an error/conflict
     * state was raised).
     */
    async function pullRemote() {
        if (!(await provider.isConnected())) {
            await setStatus({ state: 'needs-auth' });
            return;
        }

        let entries;
        try {
            entries = await provider.list();
        } catch (err) {
            await setStatus({ state: classifyError(err), message: err?.message });
            return;
        }

        // Read every ws_<id>.json into a remote model. Conflict-copy files are
        // ignored here (they are preserved artifacts, not authoritative state).
        const remoteList = [];   // {id, rev, deleted}
        const remoteJson = new Map(); // id -> full json (for apply)
        const remoteMeta = new Map(); // id -> {schemaVersion, deviceId, deletedAt}
        for (const entry of entries) {
            const m = /^ws_([^.]+)\.json$/.exec(entry.name);
            if (!m) continue; // skip index / conflict-copy files
            const id = m[1];
            let res;
            try {
                res = await provider.read(entry.name);
            } catch (err) {
                await setStatus({ state: classifyError(err), message: err?.message });
                return;
            }
            if (!res || !res.json) continue;
            const j = res.json;
            remoteList.push({ id, rev: j.rev, deleted: j.deleted === true });
            remoteJson.set(id, j);
            remoteMeta.set(id, {
                schemaVersion: j.schemaVersion,
                deviceId: j.deviceId,
                deletedAt: j.deletedAt,
            });
        }

        const local = await localById();
        const localList = [];
        for (const ws of local.values()) {
            if (!ws.syncEnabled) continue;
            localList.push({ id: ws.id, rev: ws.rev, baseRev: await getBaseRev(ws.id) });
        }

        const decisions = reconcile(localList, remoteList);
        const restorable = [];
        const conflictIds = new Set();
        let needsUpdate = false;

        for (const { id, action } of decisions) {
            const j = remoteJson.get(id);
            const meta = remoteMeta.get(id);
            switch (action) {
                case 'available': {
                    restorable.push({ id, rev: j?.rev, metadata: j?.metadata });
                    break;
                }
                case 'update-local': {
                    if (meta && isSchemaTooNew(meta.schemaVersion, SCHEMA_VERSION)) {
                        needsUpdate = true;
                        break;
                    }
                    // Whether or not it's live-bound, applyRemoteSnapshot only
                    // writes the stored snapshot — it NEVER opens tabs. So the
                    // "defer until Restore" guarantee (no auto tab replacement)
                    // holds in both cases; we apply + advance baseRev either way.
                    // (isWorkspaceLiveBound is still consulted so the contract is
                    // explicit and future destructive ops can branch on it.)
                    await isWorkspaceLiveBound(id);
                    await applyRemoteSnapshot(id, j);
                    await setBaseRev(id, j.rev);
                    break;
                }
                case 'delete-local': {
                    await removeLocalWorkspace(id);
                    break;
                }
                case 'conflict': {
                    if (meta && isSchemaTooNew(meta.schemaVersion, SCHEMA_VERSION)) {
                        needsUpdate = true;
                        break;
                    }
                    const ws = local.get(id);
                    await materializeConflict(
                        id,
                        ws,
                        { rev: j.rev, deviceId: j.deviceId, json: j },
                        conflictIds,
                    );
                    break;
                }
                // push-create / push-update / in-sync / ignore → handled by
                // flushQueue (push) or nothing to do.
                default:
                    break;
            }
        }

        await setRestorable(restorable);

        // GC old tombstones (remove the remote files).
        const gcCandidates = remoteList
            .filter((r) => r.deleted)
            .map((r) => ({ id: r.id, deleted: true, deletedAt: remoteMeta.get(r.id)?.deletedAt }));
        const toGC = tombstonesToGC(gcCandidates, now(), graceMs);
        for (const id of toGC) {
            try {
                await provider.remove(wsName(id));
            } catch (err) {
                // GC is best-effort; surface as error but keep going.
                await setStatus({ state: classifyError(err), message: err?.message });
            }
        }

        if (conflictIds.size > 0) {
            await setStatus({ state: 'conflict', conflicts: [...conflictIds], lastSyncedAt: now() });
        } else if (needsUpdate) {
            await setStatus({ state: 'needs-update', lastSyncedAt: now() });
        } else {
            await setStatus({ state: 'idle', lastSyncedAt: now() });
        }
    }

    // ---- top-level entry points -------------------------------------------

    /**
     * The periodic / onStartup / manual entry point. Flush pending pushes, then
     * pull remote. Status starts 'syncing'; ends 'idle' unless flush/pull raised
     * a terminal state (error/needs-auth/drive-full/conflict/needs-update/
     * offline).
     */
    async function runOnce() {
        await setStatus({ state: 'syncing' });

        if (!(await provider.isConnected())) {
            await setStatus({ state: 'needs-auth' });
            return;
        }

        await flushQueue();
        await pullRemote();
        // flushQueue/pullRemote set their own terminal status; pullRemote already
        // sets idle+lastSyncedAt on the clean path, so no extra status here.
    }

    /**
     * Explicit user "Restore from Drive" action: read the remote file and write
     * its snapshot locally (does NOT open tabs — applyRemoteSnapshot contract),
     * then advance baseRev. The workspace is now materialized locally.
     *
     * @param {string} workspaceId
     * @returns {Promise<{ok:boolean, error?:string}>}
     */
    async function restoreWorkspace(workspaceId) {
        if (!(await provider.isConnected())) {
            await setStatus({ state: 'needs-auth' });
            return { ok: false, error: 'not-connected' };
        }
        let res;
        try {
            res = await provider.read(wsName(workspaceId));
        } catch (err) {
            const state = classifyError(err);
            await setStatus({ state, message: err?.message });
            return { ok: false, error: state };
        }
        if (!res || !res.json) {
            return { ok: false, error: 'not-found' };
        }
        const j = res.json;
        if (j.deleted) {
            return { ok: false, error: 'tombstoned' };
        }
        if (isSchemaTooNew(j.schemaVersion, SCHEMA_VERSION)) {
            await setStatus({ state: 'needs-update' });
            return { ok: false, error: 'needs-update' };
        }
        await applyRemoteSnapshot(workspaceId, j);
        await setBaseRev(workspaceId, j.rev);
        return { ok: true };
    }

    return {
        enqueuePush,
        enqueueDelete,
        flushQueue,
        pullRemote,
        runOnce,
        restoreWorkspace,
    };
}
