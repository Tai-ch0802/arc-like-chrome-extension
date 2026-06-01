/**
 * Integration tests for the sync engine (E3a).
 *
 * These exercise the engine END-TO-END against the in-memory FakeSyncProvider
 * with fully injected deps (no chrome, no OAuth, no Date.now). The harness wires
 * a Map for baseRev, an array for local workspaces, a captured queue, captured
 * status/restorable, a fixed `now`, and a fixed deviceId.
 */
import { createFakeSyncProvider, NoopSyncProvider } from '../../modules/sync/syncProvider.js';
import { createSyncEngine } from '../../modules/sync/syncEngine.js';
import { SCHEMA_VERSION } from '../../modules/sync/syncLogic.js';

const NOW = 1_700_000_000_000;
const DEVICE = 'deviceA';

/**
 * Build an in-memory harness. Returns the assembled deps + spy-able captures and
 * a couple of convenience mutators for arranging local/remote state.
 *
 * @param {Object} [opts]
 * @param {SyncProvider} [opts.provider]
 * @param {Array} [opts.localWorkspaces]
 * @param {string} [opts.deviceId]
 * @param {number} [opts.now]
 */
function makeHarness(opts = {}) {
    const provider = opts.provider ?? createFakeSyncProvider();
    const deviceId = opts.deviceId ?? DEVICE;
    const now = opts.now ?? NOW;

    // ALL local workspaces (synced + not). Each: {id, rev, syncEnabled, metadata, tabSnapshot}.
    const local = new Map();
    for (const ws of opts.localWorkspaces ?? []) {
        local.set(ws.id, { ...ws });
    }

    const baseRevs = new Map();
    let queue = [];

    const captures = {
        status: [],
        restorable: [],
        applied: [],          // {id, fileJson}
        removed: [],          // id
        setBaseRevCalls: [],  // {id, rev}
    };

    const deps = {
        provider,
        getDeviceId: () => deviceId,
        now: () => now,
        async listLocalWorkspaces() {
            return Array.from(local.values()).map((w) => ({ ...w }));
        },
        async getBaseRev(id) {
            return baseRevs.get(id) ?? 0;
        },
        async setBaseRev(id, rev) {
            baseRevs.set(id, rev);
            captures.setBaseRevCalls.push({ id, rev });
        },
        async applyRemoteSnapshot(id, fileJson) {
            captures.applied.push({ id, fileJson });
            // Simulate materializing the local workspace from the snapshot.
            const existing = local.get(id) ?? { id, syncEnabled: true };
            local.set(id, {
                ...existing,
                id,
                rev: fileJson.rev,
                syncEnabled: true,
                metadata: fileJson.metadata,
                tabSnapshot: fileJson.tabSnapshot,
            });
        },
        async removeLocalWorkspace(id) {
            captures.removed.push(id);
            local.delete(id);
        },
        async isWorkspaceLiveBound(id) {
            return (opts.liveBound ?? new Set()).has(id);
        },
        async readQueue() {
            return queue.map((op) => ({ ...op }));
        },
        async writeQueue(ops) {
            queue = ops.map((op) => ({ ...op }));
        },
        async setRestorable(list) {
            captures.restorable.push(list);
        },
        async setStatus(status) {
            captures.status.push(status);
        },
        graceMs: opts.graceMs,
    };

    return {
        provider,
        deps,
        captures,
        local,
        baseRevs,
        getQueue: () => queue,
        lastStatus: () => captures.status[captures.status.length - 1],
        lastRestorable: () => captures.restorable[captures.restorable.length - 1],
    };
}

/** Seed a remote ws_<id>.json file directly into a fake provider. */
async function seedRemote(provider, id, { rev, deviceId = 'other', deleted = false, metadata = {}, tabSnapshot = [], deletedAt } = {}) {
    const body = {
        schemaVersion: SCHEMA_VERSION,
        workspaceId: id,
        rev,
        deviceId,
        updatedAt: NOW,
        metadata,
        tabSnapshot,
    };
    if (deleted) {
        body.deleted = true;
        body.deletedAt = deletedAt ?? NOW;
    }
    await provider.write(`ws_${id}.json`, body);
}

describe('syncEngine — orchestration (DI integration)', () => {
    // ---- Scenario 1: fresh push (create) ----
    it('fresh push: one local synced ws, empty remote -> creates ws_<id>.json, baseRev advances', async () => {
        const h = makeHarness({
            localWorkspaces: [
                { id: 'w1', rev: 3, syncEnabled: true, metadata: { name: 'Work' }, tabSnapshot: [{ url: 'https://a' }] },
            ],
        });
        const engine = createSyncEngine(h.deps);

        await engine.enqueuePush('w1');
        await engine.runOnce();

        const file = await h.provider.read('ws_w1.json');
        expect(file).not.toBeNull();
        expect(file.json.workspaceId).toBe('w1');
        expect(file.json.rev).toBe(3);
        expect(file.json.deviceId).toBe(DEVICE);
        expect(file.json.schemaVersion).toBe(SCHEMA_VERSION);
        expect(file.json.metadata).toEqual({ name: 'Work' });
        expect(file.json.tabSnapshot).toEqual([{ url: 'https://a' }]);
        expect(h.baseRevs.get('w1')).toBe(3);
        expect(h.getQueue()).toEqual([]);
    });

    // ---- Scenario 2: clean fast-forward pull ----
    it('clean fast-forward pull: local base=rev=5, remote rev 6 -> applyRemoteSnapshot, baseRev=6, no conflict file', async () => {
        const provider = createFakeSyncProvider();
        await seedRemote(provider, 'w1', { rev: 6, deviceId: 'other', metadata: { name: 'New' }, tabSnapshot: [{ url: 'https://b' }] });
        const h = makeHarness({
            provider,
            localWorkspaces: [{ id: 'w1', rev: 5, syncEnabled: true, metadata: { name: 'Old' }, tabSnapshot: [] }],
        });
        h.baseRevs.set('w1', 5);
        const engine = createSyncEngine(h.deps);

        await engine.runOnce();

        expect(h.captures.applied.map((a) => a.id)).toContain('w1');
        expect(h.baseRevs.get('w1')).toBe(6);
        // No conflict file should have been created.
        const names = (await provider.list()).map((f) => f.name);
        expect(names.some((n) => n.includes('.conflict-'))).toBe(false);
    });

    // ---- Scenario 3: genuine conflict ----
    it('genuine conflict: local rev6 base5, remote rev7 (other device) -> conflicted-copy preserves loser, winner applied, no data lost', async () => {
        const provider = createFakeSyncProvider();
        await seedRemote(provider, 'w1', { rev: 7, deviceId: 'deviceZ', metadata: { name: 'Remote' }, tabSnapshot: [{ url: 'https://remote' }] });
        const h = makeHarness({
            provider,
            localWorkspaces: [{ id: 'w1', rev: 6, syncEnabled: true, metadata: { name: 'Local' }, tabSnapshot: [{ url: 'https://local' }] }],
        });
        h.baseRevs.set('w1', 5);
        const engine = createSyncEngine(h.deps);

        await engine.enqueuePush('w1');
        await engine.runOnce();

        const names = (await provider.list()).map((f) => f.name);
        // Loser (local, rev6 < remote rev7) preserved as conflicted copy.
        expect(names).toContain('ws_w1.conflict-deviceA.json');
        const conflictFile = await provider.read('ws_w1.conflict-deviceA.json');
        expect(conflictFile.json.tabSnapshot).toEqual([{ url: 'https://local' }]);
        // Winner (remote rev7) is the canonical ws_w1.json AND applied locally.
        const winnerFile = await provider.read('ws_w1.json');
        expect(winnerFile.json.rev).toBe(7);
        expect(winnerFile.json.tabSnapshot).toEqual([{ url: 'https://remote' }]);
        expect(h.captures.applied.some((a) => a.id === 'w1' && a.fileJson.rev === 7)).toBe(true);
        expect(h.baseRevs.get('w1')).toBe(7);
        // Conflict surfaced in status.
        const conflictStatus = h.captures.status.find((s) => s.state === 'conflict');
        expect(conflictStatus).toBeTruthy();
        expect(conflictStatus.conflicts).toContain('w1');
    });

    // ---- Scenario 4: new device "available" ----
    it('new device available: remote-only ws -> setRestorable includes it, NOT auto-created', async () => {
        const provider = createFakeSyncProvider();
        await seedRemote(provider, 'wRemote', { rev: 2, deviceId: 'other' });
        const h = makeHarness({ provider, localWorkspaces: [] });
        const engine = createSyncEngine(h.deps);

        await engine.runOnce();

        const restorable = h.lastRestorable();
        expect(restorable.some((r) => r.id === 'wRemote')).toBe(true);
        // Must NOT have materialized it.
        expect(h.captures.applied.some((a) => a.id === 'wRemote')).toBe(false);
        expect(h.captures.removed).not.toContain('wRemote');
        expect(h.local.has('wRemote')).toBe(false);
    });

    // ---- Scenario 5: remote tombstone -> delete-local ----
    it('remote tombstone (deleted, rev>baseRev) with local materialized -> removeLocalWorkspace called', async () => {
        const provider = createFakeSyncProvider();
        await seedRemote(provider, 'w1', { rev: 9, deviceId: 'other', deleted: true });
        const h = makeHarness({
            provider,
            localWorkspaces: [{ id: 'w1', rev: 5, syncEnabled: true, metadata: {}, tabSnapshot: [] }],
        });
        h.baseRevs.set('w1', 5);
        const engine = createSyncEngine(h.deps);

        await engine.runOnce();

        expect(h.captures.removed).toContain('w1');
        expect(h.local.has('w1')).toBe(false);
    });

    // ---- Scenario 6: delete enqueues tombstone ----
    it('enqueueDelete then flush -> remote file has deleted:true', async () => {
        const provider = createFakeSyncProvider();
        await seedRemote(provider, 'w1', { rev: 4, deviceId: DEVICE, metadata: { name: 'X' }, tabSnapshot: [] });
        const h = makeHarness({
            provider,
            localWorkspaces: [{ id: 'w1', rev: 4, syncEnabled: true, metadata: { name: 'X' }, tabSnapshot: [] }],
        });
        h.baseRevs.set('w1', 4);
        const engine = createSyncEngine(h.deps);

        await engine.enqueueDelete('w1');
        await engine.flushQueue();

        const file = await provider.read('ws_w1.json');
        expect(file.json.deleted).toBe(true);
        expect(file.json.rev).toBeGreaterThan(4);
        expect(typeof file.json.deletedAt).toBe('number');
        expect(h.getQueue()).toEqual([]);
    });

    // ---- Scenario 7: queue coalesce + idempotent ack on provider error ----
    it('enqueuePush twice -> one push; provider write fails first -> op stays, second flush clears queue', async () => {
        const provider = createFakeSyncProvider();
        const h = makeHarness({
            provider,
            localWorkspaces: [{ id: 'w1', rev: 1, syncEnabled: true, metadata: {}, tabSnapshot: [] }],
        });
        const engine = createSyncEngine(h.deps);

        await engine.enqueuePush('w1');
        await engine.enqueuePush('w1');
        // Coalesced to a single op on disk.
        expect(h.getQueue().length).toBe(1);

        // Inject a write failure on the first flush.
        const err = new Error('boom');
        err.status = 500;
        provider.__failNext('write', err);

        await engine.flushQueue();
        // Failed op stays in the queue; status error.
        expect(h.getQueue().length).toBe(1);
        expect(h.lastStatus().state).toBe('error');
        expect(await provider.read('ws_w1.json')).toBeNull();

        // Second flush succeeds and clears the queue.
        await engine.flushQueue();
        expect(h.getQueue()).toEqual([]);
        const file = await provider.read('ws_w1.json');
        expect(file).not.toBeNull();
        expect(file.json.rev).toBe(1);
    });

    // ---- Scenario 8: schema too new ----
    it('schema too new on update-local path -> applyRemoteSnapshot NOT called, status needs-update', async () => {
        const provider = createFakeSyncProvider();
        await provider.write('ws_w1.json', {
            schemaVersion: SCHEMA_VERSION + 1,
            workspaceId: 'w1',
            rev: 9,
            deviceId: 'other',
            updatedAt: NOW,
            metadata: {},
            tabSnapshot: [],
        });
        const h = makeHarness({
            provider,
            localWorkspaces: [{ id: 'w1', rev: 5, syncEnabled: true, metadata: {}, tabSnapshot: [] }],
        });
        h.baseRevs.set('w1', 5);
        const engine = createSyncEngine(h.deps);

        await engine.runOnce();

        expect(h.captures.applied.some((a) => a.id === 'w1')).toBe(false);
        const needsUpdate = h.captures.status.find((s) => s.state === 'needs-update');
        expect(needsUpdate).toBeTruthy();
    });

    // ---- Scenario 9: not connected ----
    it('provider not connected -> runOnce sets offline/needs-auth, no writes, queue intact', async () => {
        const provider = new NoopSyncProvider();
        const h = makeHarness({
            provider,
            localWorkspaces: [{ id: 'w1', rev: 1, syncEnabled: true, metadata: {}, tabSnapshot: [] }],
        });
        const engine = createSyncEngine(h.deps);

        await engine.enqueuePush('w1');
        await engine.runOnce();

        expect(h.getQueue().length).toBe(1); // queue untouched
        const offlineish = h.captures.status.find((s) => s.state === 'offline' || s.state === 'needs-auth');
        expect(offlineish).toBeTruthy();
        // Noop provider stores nothing.
        expect(await provider.read('ws_w1.json')).toBeNull();
    });

    // ---- Scenario 10: restoreWorkspace ----
    it('restoreWorkspace: reads remote, applyRemoteSnapshot (no tab open), sets baseRev, returns success', async () => {
        const provider = createFakeSyncProvider();
        await seedRemote(provider, 'wR', { rev: 8, deviceId: 'other', metadata: { name: 'Restored' }, tabSnapshot: [{ url: 'https://r' }] });
        const h = makeHarness({ provider, localWorkspaces: [] });
        const engine = createSyncEngine(h.deps);

        const result = await engine.restoreWorkspace('wR');

        expect(result.ok).toBe(true);
        const applied = h.captures.applied.find((a) => a.id === 'wR');
        expect(applied).toBeTruthy();
        expect(applied.fileJson.tabSnapshot).toEqual([{ url: 'https://r' }]);
        expect(h.baseRevs.get('wR')).toBe(8);
    });

    // ---- Extra: needs-auth classification on 401 during flush ----
    it('flush: provider write 401 -> status needs-auth, queue intact', async () => {
        const provider = createFakeSyncProvider();
        const h = makeHarness({
            provider,
            localWorkspaces: [{ id: 'w1', rev: 1, syncEnabled: true, metadata: {}, tabSnapshot: [] }],
        });
        const engine = createSyncEngine(h.deps);
        await engine.enqueuePush('w1');

        const err = new Error('unauthorized');
        err.status = 401;
        provider.__failNext('write', err);
        await engine.flushQueue();

        expect(h.lastStatus().state).toBe('needs-auth');
        expect(h.getQueue().length).toBe(1);
    });

    // ---- Extra: 403 quota -> drive-full ----
    it('flush: provider write 403 storageQuotaExceeded -> status drive-full, queue intact', async () => {
        const provider = createFakeSyncProvider();
        const h = makeHarness({
            provider,
            localWorkspaces: [{ id: 'w1', rev: 1, syncEnabled: true, metadata: {}, tabSnapshot: [] }],
        });
        const engine = createSyncEngine(h.deps);
        await engine.enqueuePush('w1');

        const err = new Error('storageQuotaExceeded');
        err.status = 403;
        err.reason = 'storageQuotaExceeded';
        provider.__failNext('write', err);
        await engine.flushQueue();

        expect(h.lastStatus().state).toBe('drive-full');
        expect(h.getQueue().length).toBe(1);
    });

    // ---- Extra: idempotent re-push (same rev) is harmless ----
    it('flush twice with same rev -> second is in-sync no-op (baseRev unchanged, no duplicate harm)', async () => {
        const provider = createFakeSyncProvider();
        const h = makeHarness({
            localWorkspaces: [{ id: 'w1', rev: 2, syncEnabled: true, metadata: {}, tabSnapshot: [] }],
            provider,
        });
        const engine = createSyncEngine(h.deps);

        await engine.enqueuePush('w1');
        await engine.flushQueue();
        expect(h.baseRevs.get('w1')).toBe(2);

        // Re-enqueue same push; remote already at rev2, baseRev2 -> in-sync.
        await engine.enqueuePush('w1');
        await engine.flushQueue();
        const file = await provider.read('ws_w1.json');
        expect(file.json.rev).toBe(2);
        expect(h.getQueue()).toEqual([]);
    });

    // ---- Extra: tombstone GC ----
    it('pullRemote GCs tombstones older than graceMs via provider.remove', async () => {
        const provider = createFakeSyncProvider();
        // An old tombstone (deletedAt well beyond grace) with no local copy.
        await seedRemote(provider, 'wOld', {
            rev: 3, deviceId: 'other', deleted: true, deletedAt: NOW - (100 * 24 * 60 * 60 * 1000),
        });
        const h = makeHarness({ provider, localWorkspaces: [], graceMs: 60 * 24 * 60 * 60 * 1000 });
        const engine = createSyncEngine(h.deps);

        await engine.runOnce();

        const names = (await provider.list()).map((f) => f.name);
        expect(names).not.toContain('ws_wOld.json');
    });
});
