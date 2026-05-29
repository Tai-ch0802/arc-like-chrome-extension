/**
 * @file syncLogic.js
 * PURE sync-decision logic for the Drive-sync feature — the deterministic core
 * the imperative engine (E3) drives. Every function here is a pure function of
 * its arguments: NO chrome, NO fetch, NO Date.now / Math.random, NO module
 * state. All time is passed in via `now` arguments so the logic is fully
 * unit-testable in plain Node.
 *
 * Sync model (per the approved design):
 *   - Each synced workspace is one Drive file `ws_<id>.json`.
 *   - The file carries an app-controlled monotonic `rev` — the cross-device
 *     ordering key. A device also remembers `baseRev`: the `rev` it last
 *     successfully synced from, used to detect that the remote advanced beneath
 *     it (read-before-write conflict detection; the Drive server `version`
 *     handles the lower-level optimistic-lock and lives in syncProvider).
 *   - Conflicts are resolved by rev-based last-writer-wins with a deterministic
 *     deviceId tiebreak; the LOSER is never discarded — it's preserved as a
 *     conflicted copy `ws_<id>.conflict-<loserDeviceId>.json`.
 *   - Deletions are soft (tombstones with `deletedAt`) and GC'd after a grace
 *     window.
 *   - A new device does NOT auto-create local workspaces from remote — remote-
 *     only workspaces are surfaced as "available to restore".
 *
 * @module modules/sync/syncLogic
 */

/**
 * Current workspace-file schema version this client writes/understands.
 * @type {number}
 */
export const SCHEMA_VERSION = 1;

/**
 * Decide what to do when PUSHING a local synced workspace to Drive.
 *
 * @param {{rev:number, baseRev:number}} local  baseRev = the rev this device
 *        last synced from (0 if never synced).
 * @param {{rev:number}|null} remote  current remote state (null = no remote
 *        file yet).
 * @returns {'create'|'update'|'conflict'}
 *   - 'create'   no remote file exists; create it.
 *   - 'conflict' remote advanced beyond our baseRev (someone wrote since we
 *                synced).
 *   - 'update'   safe to write (remote unchanged since our base, or we're
 *                ahead).
 */
export function decidePush(local, remote) {
    if (remote == null) return 'create';
    if (remote.rev > local.baseRev) return 'conflict';
    return 'update';
}

/**
 * Resolve a detected push/pull conflict for one workspace via rev-based
 * last-writer-wins with a deterministic tiebreak. The loser is preserved as a
 * conflicted copy (never discarded).
 *
 * Determinism note: the winner is a pure function of (rev, deviceId) on each
 * side, independent of which side is labelled "local" vs "remote". Swapping the
 * two operands yields the same winning *device* and the same loser conflict
 * file name — so two devices resolving the same pair converge.
 *
 * @param {string} workspaceId  caller-supplied workspace id (embedded in the
 *        conflict file name).
 * @param {{rev:number, deviceId:string}} local
 * @param {{rev:number, deviceId:string}} remote
 * @returns {{winner:'local'|'remote', loser:'local'|'remote', loserConflictName:string}}
 *   winner = higher rev; tie -> higher deviceId (lexical) wins.
 *   loserConflictName = `ws_<workspaceId>.conflict-<loserDeviceId>.json`.
 */
export function resolveConflict(workspaceId, local, remote) {
    let localWins;
    if (local.rev !== remote.rev) {
        localWins = local.rev > remote.rev;
    } else {
        // Tie on rev -> higher deviceId (lexical) wins. deviceIds are assumed
        // unique per device, so strict > is well-defined here.
        localWins = local.deviceId > remote.deviceId;
    }

    const winner = localWins ? 'local' : 'remote';
    const loser = localWins ? 'remote' : 'local';
    const loserDeviceId = localWins ? remote.deviceId : local.deviceId;

    return {
        winner,
        loser,
        loserConflictName: `ws_${workspaceId}.conflict-${loserDeviceId}.json`,
    };
}

/**
 * Decide what to do when PULLING one workspace's remote state to this device.
 *
 * @param {{rev:number}|null} local  null = workspace not materialized on this
 *        device.
 * @param {{rev:number, deleted?:boolean}} remote
 * @returns {'available'|'update-local'|'in-sync'|'delete-local'|'ignore'}
 *   - 'delete-local' remote tombstoned AND local present (remove local copy).
 *   - 'ignore'       remote tombstoned AND no local (nothing to do).
 *   - 'available'    no local (not deleted): list as restorable; do NOT
 *                    auto-create.
 *   - 'update-local' remote rev newer than local.
 *   - 'in-sync'      remote equal or older than local.
 */
export function decidePull(local, remote) {
    if (remote.deleted) {
        return local ? 'delete-local' : 'ignore';
    }
    if (!local) return 'available';
    if (remote.rev > local.rev) return 'update-local';
    return 'in-sync';
}

/**
 * Three-way bootstrap/reconcile over the union of local and remote workspace
 * ids. Composes {@link decidePush} / {@link decidePull} per id.
 *
 * @param {Array<{id:string, rev:number, baseRev:number}>} localList  synced
 *        workspaces present locally.
 * @param {Array<{id:string, rev:number, deleted?:boolean}>} remoteList  entries
 *        from the remote index/list.
 * @returns {Array<{id:string, action:string}>} one entry per union id, where
 *   action is one of: 'push-create' (local-only) | 'available' (remote-only,
 *   restorable) | 'ignore' (remote-only tombstone) | 'delete-local' (remote
 *   tombstone, local present) | 'update-local' | 'push-update' | 'conflict' |
 *   'in-sync'.
 *
 * Interpretation note (contract slightly under-specified): the spec lists
 * 'available' for remote-only but does not name the remote-only-AND-tombstoned
 * case. We delegate to decidePull(null, remote), which returns 'ignore' there
 * (a remote-only tombstone has nothing local to restore or delete) — see the
 * matching test.
 */
export function reconcile(localList, remoteList) {
    const localById = new Map(localList.map((w) => [w.id, w]));
    const remoteById = new Map(remoteList.map((w) => [w.id, w]));

    const ids = [];
    const seen = new Set();
    for (const w of localList) {
        if (!seen.has(w.id)) { seen.add(w.id); ids.push(w.id); }
    }
    for (const w of remoteList) {
        if (!seen.has(w.id)) { seen.add(w.id); ids.push(w.id); }
    }

    return ids.map((id) => {
        const local = localById.get(id) || null;
        const remote = remoteById.get(id) || null;

        // Local-only.
        if (remote == null) {
            return { id, action: 'push-create' };
        }

        // Remote-only -> defer to pull semantics (available / ignore-if-tombstone).
        if (local == null) {
            return { id, action: decidePull(null, remote) };
        }

        // Present on both sides.
        if (remote.deleted) {
            return { id, action: 'delete-local' };
        }

        const push = decidePush(local, remote);
        if (push === 'conflict') {
            return { id, action: 'conflict' };
        }
        // push === 'update': remote did not advance beyond our base, so it's
        // safe to order by rev.
        if (remote.rev > local.rev) return { id, action: 'update-local' };
        if (local.rev > remote.rev) return { id, action: 'push-update' };
        return { id, action: 'in-sync' };
    });
}

/**
 * Collapse a queue of pending sync ops so each workspace has at most one
 * effective op. Latest-wins, EXCEPT a 'delete' is terminal: once seen for an
 * id it wins over any push for that id regardless of order (a deleted workspace
 * must not be re-pushed). The surviving op for an id keeps that id's
 * first-seen position.
 *
 * @param {Array<{type:'push'|'delete', workspaceId:string}>} ops  chronological.
 * @returns {Array<{type:'push'|'delete', workspaceId:string}>} deduped.
 */
export function coalesceQueue(ops) {
    /** @type {Map<string, {type:'push'|'delete', workspaceId:string}>} */
    const effective = new Map();
    const order = [];

    for (const op of ops) {
        const id = op.workspaceId;
        if (!effective.has(id)) {
            order.push(id);
            effective.set(id, { type: op.type, workspaceId: id });
            continue;
        }
        const cur = effective.get(id);
        if (cur.type === 'delete') {
            // delete is terminal — ignore subsequent ops for this id.
            continue;
        }
        // current is a push; a later delete upgrades it (terminal), a later
        // push collapses into the existing push (no-op change).
        if (op.type === 'delete') {
            effective.set(id, { type: 'delete', workspaceId: id });
        }
    }

    return order.map((id) => effective.get(id));
}

/**
 * Which tombstones are old enough to garbage-collect. Only entries that are
 * deleted AND have a `deletedAt` strictly older than (now - graceMs) qualify.
 * A deleted entry with a missing `deletedAt` is treated as NOT GC-able (safe
 * default — we don't drop history we can't age).
 *
 * @param {Array<{id:string, deleted?:boolean, deletedAt?:number}>} indexEntries
 * @param {number} now  epoch ms.
 * @param {number} graceMs  grace window (e.g. 60 days).
 * @returns {string[]} ids whose tombstone is older than the grace window.
 */
export function tombstonesToGC(indexEntries, now, graceMs) {
    const cutoff = now - graceMs;
    return indexEntries
        .filter((e) => e.deleted === true
            && typeof e.deletedAt === 'number'
            && e.deletedAt < cutoff)
        .map((e) => e.id);
}

/**
 * Whether a pulled file's schema is newer than this client understands, so it
 * must NOT be written back / downgraded — the caller should surface "update
 * extension" instead.
 *
 * @param {number} remoteSchemaVersion
 * @param {number} supportedSchemaVersion
 * @returns {boolean} true iff remote schema is strictly newer.
 */
export function isSchemaTooNew(remoteSchemaVersion, supportedSchemaVersion) {
    return remoteSchemaVersion > supportedSchemaVersion;
}
