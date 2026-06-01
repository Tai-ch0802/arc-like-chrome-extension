import {
    SCHEMA_VERSION,
    decideSync,
    resolveConflict,
    decidePull,
    reconcile,
    coalesceQueue,
    tombstonesToGC,
    isSchemaTooNew,
    removedSyncedIds,
} from '../../modules/sync/syncLogic.js';

// Helper: order-independent comparison of reconcile result arrays.
const byId = (arr) => Object.fromEntries(arr.map((e) => [e.id, e.action]));

describe('syncLogic — pure sync-decision logic', () => {
    describe('SCHEMA_VERSION', () => {
        it('is the current schema version constant (1)', () => {
            expect(SCHEMA_VERSION).toBe(1);
        });
    });

    describe('decideSync(local, remote)', () => {
        it('remote == null -> create', () => {
            expect(decideSync({ rev: 5, baseRev: 5 }, null)).toBe('create');
        });

        it('localChanged && remoteChanged -> conflict (BOTH diverged from base)', () => {
            // local advanced 5->6, remote advanced to 7, both beyond base 5.
            expect(decideSync({ rev: 6, baseRev: 5 }, { rev: 7 })).toBe('conflict');
        });

        it('only remote advanced (local clean) -> pull (fast-forward, NOT conflict)', () => {
            // THE bug being fixed: local synced at base 5 and made no local
            // change (rev 5); remote advanced to 6. This is a clean
            // fast-forward, not a conflict.
            expect(decideSync({ rev: 5, baseRev: 5 }, { rev: 6 })).toBe('pull');
        });

        it('only local advanced (remote unchanged since base) -> push', () => {
            expect(decideSync({ rev: 6, baseRev: 5 }, { rev: 5 })).toBe('push');
        });

        it('neither side advanced beyond base -> in-sync', () => {
            expect(decideSync({ rev: 5, baseRev: 5 }, { rev: 5 })).toBe('in-sync');
        });

        it('remote.rev < baseRev (stale remote) with local clean -> in-sync', () => {
            // Neither changed relative to base (remote behind, we didn't edit).
            expect(decideSync({ rev: 5, baseRev: 5 }, { rev: 4 })).toBe('in-sync');
        });

        it('local advanced, remote behind base -> push (only we changed)', () => {
            expect(decideSync({ rev: 6, baseRev: 5 }, { rev: 4 })).toBe('push');
        });

        it('fresh local never synced (baseRev 0), local edited, remote ahead -> conflict', () => {
            // local rev 1 > base 0 (we edited) AND remote rev 3 > base 0.
            expect(decideSync({ rev: 1, baseRev: 0 }, { rev: 3 })).toBe('conflict');
        });

        it('fresh local never synced (baseRev 0), local unchanged, remote ahead -> pull', () => {
            // local rev 0 == base 0 (no local edit); remote rev 3 > base 0.
            expect(decideSync({ rev: 0, baseRev: 0 }, { rev: 3 })).toBe('pull');
        });

        it('baseRev 0 with no remote -> create', () => {
            expect(decideSync({ rev: 1, baseRev: 0 }, null)).toBe('create');
        });
    });

    describe('resolveConflict(workspaceId, local, remote)', () => {
        it('higher rev wins — local wins', () => {
            const r = resolveConflict('w1', { rev: 10, deviceId: 'A' }, { rev: 5, deviceId: 'B' });
            expect(r.winner).toBe('local');
            expect(r.loser).toBe('remote');
            expect(r.loserConflictName).toBe('ws_w1.conflict-B.json');
        });

        it('higher rev wins — remote wins', () => {
            const r = resolveConflict('w1', { rev: 5, deviceId: 'A' }, { rev: 10, deviceId: 'B' });
            expect(r.winner).toBe('remote');
            expect(r.loser).toBe('local');
            expect(r.loserConflictName).toBe('ws_w1.conflict-A.json');
        });

        it('equal rev -> higher deviceId (lexical) wins — local higher', () => {
            const r = resolveConflict('w1', { rev: 7, deviceId: 'zeta' }, { rev: 7, deviceId: 'alpha' });
            expect(r.winner).toBe('local');
            expect(r.loser).toBe('remote');
            expect(r.loserConflictName).toBe('ws_w1.conflict-alpha.json');
        });

        it('equal rev -> higher deviceId (lexical) wins — remote higher', () => {
            const r = resolveConflict('w1', { rev: 7, deviceId: 'alpha' }, { rev: 7, deviceId: 'zeta' });
            expect(r.winner).toBe('remote');
            expect(r.loser).toBe('local');
            expect(r.loserConflictName).toBe('ws_w1.conflict-alpha.json');
        });

        it('deterministic + symmetric: swapping local/remote yields the SAME winning deviceId', () => {
            const a = { rev: 7, deviceId: 'dev-1' };
            const b = { rev: 7, deviceId: 'dev-2' };
            const r1 = resolveConflict('w1', a, b);
            const r2 = resolveConflict('w1', b, a);
            const winnerDevice1 = r1.winner === 'local' ? a.deviceId : b.deviceId;
            const winnerDevice2 = r2.winner === 'local' ? b.deviceId : a.deviceId;
            expect(winnerDevice1).toBe(winnerDevice2);
            expect(winnerDevice1).toBe('dev-2'); // higher lexical
            // loser conflict name is identical regardless of arg order
            expect(r1.loserConflictName).toBe('ws_w1.conflict-dev-1.json');
            expect(r2.loserConflictName).toBe('ws_w1.conflict-dev-1.json');
        });

        it('symmetric on differing revs too: swapping args keeps same winning device + loser name', () => {
            const a = { rev: 3, deviceId: 'A' };
            const b = { rev: 9, deviceId: 'B' };
            const r1 = resolveConflict('ws-x', a, b);
            const r2 = resolveConflict('ws-x', b, a);
            const winner1 = r1.winner === 'local' ? a.deviceId : b.deviceId;
            const winner2 = r2.winner === 'local' ? b.deviceId : a.deviceId;
            expect(winner1).toBe('B');
            expect(winner2).toBe('B');
            expect(r1.loserConflictName).toBe('ws_ws-x.conflict-A.json');
            expect(r2.loserConflictName).toBe('ws_ws-x.conflict-A.json');
        });

        it('loserConflictName embeds the caller-supplied workspaceId', () => {
            const r = resolveConflict('abc123', { rev: 1, deviceId: 'A' }, { rev: 2, deviceId: 'B' });
            expect(r.loserConflictName).toBe('ws_abc123.conflict-A.json');
        });

        it('same-deviceId is a precondition violation but stays deterministic (documented)', () => {
            // A device cannot conflict with itself — callers MUST pass distinct
            // deviceIds. If they don't, behavior is meaningless but deterministic:
            // on a rev tie, `local.deviceId > remote.deviceId` is false, so
            // 'remote' wins and the loser file is named after the shared id.
            const r = resolveConflict('w1', { rev: 7, deviceId: 'same' }, { rev: 7, deviceId: 'same' });
            expect(r.winner).toBe('remote');
            expect(r.loser).toBe('local');
            expect(r.loserConflictName).toBe('ws_w1.conflict-same.json');
            // Idempotent: same inputs always yield the same result.
            const r2 = resolveConflict('w1', { rev: 7, deviceId: 'same' }, { rev: 7, deviceId: 'same' });
            expect(r2).toEqual(r);
        });
    });

    describe('decidePull(local, remote)', () => {
        it('remote.deleted && local present -> delete-local', () => {
            expect(decidePull({ rev: 5 }, { rev: 6, deleted: true })).toBe('delete-local');
        });

        it('remote.deleted && no local -> ignore', () => {
            expect(decidePull(null, { rev: 6, deleted: true })).toBe('ignore');
        });

        it('no local (not deleted) -> available (restorable, not auto-created)', () => {
            expect(decidePull(null, { rev: 3 })).toBe('available');
        });

        it('remote newer than local -> update-local', () => {
            expect(decidePull({ rev: 2 }, { rev: 3 })).toBe('update-local');
        });

        it('remote equal local -> in-sync', () => {
            expect(decidePull({ rev: 3 }, { rev: 3 })).toBe('in-sync');
        });

        it('remote older than local -> in-sync (nothing to pull)', () => {
            expect(decidePull({ rev: 5 }, { rev: 3 })).toBe('in-sync');
        });

        it('deleted flag dominates even when local rev is higher', () => {
            expect(decidePull({ rev: 99 }, { rev: 1, deleted: true })).toBe('delete-local');
        });
    });

    describe('reconcile(localList, remoteList)', () => {
        it('local-only id -> push-create', () => {
            const res = reconcile([{ id: 'a', rev: 1, baseRev: 0 }], []);
            expect(byId(res)).toEqual({ a: 'push-create' });
        });

        it('remote-only id -> available', () => {
            const res = reconcile([], [{ id: 'b', rev: 4 }]);
            expect(byId(res)).toEqual({ b: 'available' });
        });

        it('remote-only tombstone -> ignore (nothing local to delete)', () => {
            const res = reconcile([], [{ id: 'b', rev: 4, deleted: true }]);
            expect(byId(res)).toEqual({ b: 'ignore' });
        });

        it('both present, remote tombstoned -> delete-local', () => {
            const res = reconcile(
                [{ id: 'c', rev: 3, baseRev: 3 }],
                [{ id: 'c', rev: 4, deleted: true }],
            );
            expect(byId(res)).toEqual({ c: 'delete-local' });
        });

        it('both present, remote advanced while local is CLEAN -> update-local (fast-forward, no phantom conflict)', () => {
            // THE bug being fixed. local synced at base 3 and made NO local
            // change (rev 3 == baseRev 3); remote advanced to 5. Only the remote
            // diverged, so this is a clean fast-forward, NOT a conflict.
            const res = reconcile(
                [{ id: 'd', rev: 3, baseRev: 3 }],
                [{ id: 'd', rev: 5 }],
            );
            expect(byId(res)).toEqual({ d: 'update-local' });
        });

        it('both present, remote newer with local clean at base -> update-local', () => {
            // local synced from rev 5 (baseRev 5), local hasn't changed (rev 5);
            // remote advanced to 7. Only remote diverged -> fast-forward.
            const res = reconcile(
                [{ id: 'e', rev: 5, baseRev: 5 }],
                [{ id: 'e', rev: 7 }],
            );
            expect(byId(res)).toEqual({ e: 'update-local' });
        });

        it('both present, local newer (no remote advance) -> push-update', () => {
            const res = reconcile(
                [{ id: 'f', rev: 6, baseRev: 5 }],
                [{ id: 'f', rev: 5 }],
            );
            expect(byId(res)).toEqual({ f: 'push-update' });
        });

        it('both present, equal revs and no divergence -> in-sync', () => {
            const res = reconcile(
                [{ id: 'g', rev: 5, baseRev: 5 }],
                [{ id: 'g', rev: 5 }],
            );
            expect(byId(res)).toEqual({ g: 'in-sync' });
        });

        it('both present, BOTH sides advanced beyond baseRev -> conflict (genuine divergence)', () => {
            // local edited 5->6 (rev 6 > base 5) AND remote advanced to 7 (> base 5).
            const res = reconcile(
                [{ id: 'h', rev: 6, baseRev: 5 }],
                [{ id: 'h', rev: 7 }],
            );
            expect(byId(res)).toEqual({ h: 'conflict' });
        });

        it('headline fix: first action for a clean fast-forward is update-local, not conflict', () => {
            const res = reconcile(
                [{ id: 'a', rev: 5, baseRev: 5 }],
                [{ id: 'a', rev: 6 }],
            );
            expect(res[0].action).toBe('update-local');
        });

        it('mixed list exercising several ids at once (order-independent)', () => {
            const local = [
                { id: 'local-only', rev: 2, baseRev: 0 },
                { id: 'tomb', rev: 3, baseRev: 3 },
                { id: 'pull-me', rev: 5, baseRev: 5 }, // clean: remote advances -> fast-forward
                { id: 'push-me', rev: 6, baseRev: 5 },
                { id: 'same', rev: 4, baseRev: 4 },
                { id: 'clash', rev: 6, baseRev: 5 }, // both diverged from base 5 -> conflict
            ];
            const remote = [
                { id: 'remote-only', rev: 9 },
                { id: 'tomb', rev: 4, deleted: true },
                { id: 'pull-me', rev: 7 },
                { id: 'push-me', rev: 5 },
                { id: 'same', rev: 4 },
                { id: 'clash', rev: 8 },
                { id: 'ghost-tomb', rev: 2, deleted: true },
            ];
            const res = reconcile(local, remote);
            expect(byId(res)).toEqual({
                'local-only': 'push-create',
                'remote-only': 'available',
                tomb: 'delete-local',
                'pull-me': 'update-local',
                'push-me': 'push-update',
                same: 'in-sync',
                clash: 'conflict',
                'ghost-tomb': 'ignore',
            });
            // every union id present exactly once
            expect(res.length).toBe(8);
            const ids = res.map((e) => e.id).sort();
            expect(new Set(ids).size).toBe(ids.length);
        });
    });

    describe('coalesceQueue(ops)', () => {
        it('empty -> empty', () => {
            expect(coalesceQueue([])).toEqual([]);
        });

        it('multiple pushes same id -> single push', () => {
            const out = coalesceQueue([
                { type: 'push', workspaceId: 'a' },
                { type: 'push', workspaceId: 'a' },
                { type: 'push', workspaceId: 'a' },
            ]);
            expect(out).toEqual([{ type: 'push', workspaceId: 'a' }]);
        });

        it('push then delete same id -> delete only', () => {
            const out = coalesceQueue([
                { type: 'push', workspaceId: 'a' },
                { type: 'delete', workspaceId: 'a' },
            ]);
            expect(out).toEqual([{ type: 'delete', workspaceId: 'a' }]);
        });

        it('delete then push same id -> delete only (delete is terminal)', () => {
            const out = coalesceQueue([
                { type: 'delete', workspaceId: 'a' },
                { type: 'push', workspaceId: 'a' },
            ]);
            expect(out).toEqual([{ type: 'delete', workspaceId: 'a' }]);
        });

        it('push, delete, push (same id) -> delete only (terminal regardless of later push)', () => {
            const out = coalesceQueue([
                { type: 'push', workspaceId: 'a' },
                { type: 'delete', workspaceId: 'a' },
                { type: 'push', workspaceId: 'a' },
            ]);
            expect(out).toEqual([{ type: 'delete', workspaceId: 'a' }]);
        });

        it('independent ids preserved in first-seen order', () => {
            const out = coalesceQueue([
                { type: 'push', workspaceId: 'b' },
                { type: 'push', workspaceId: 'a' },
                { type: 'delete', workspaceId: 'c' },
                { type: 'push', workspaceId: 'a' }, // dup of a -> collapses
            ]);
            expect(out).toEqual([
                { type: 'push', workspaceId: 'b' },
                { type: 'push', workspaceId: 'a' },
                { type: 'delete', workspaceId: 'c' },
            ]);
        });

        it('first-seen order anchored to the surviving op even when delete arrives later', () => {
            const out = coalesceQueue([
                { type: 'push', workspaceId: 'x' }, // first seen at index 0
                { type: 'push', workspaceId: 'y' },
                { type: 'delete', workspaceId: 'x' }, // x becomes delete but keeps slot 0
            ]);
            expect(out).toEqual([
                { type: 'delete', workspaceId: 'x' },
                { type: 'push', workspaceId: 'y' },
            ]);
        });
    });

    describe('tombstonesToGC(indexEntries, now, graceMs)', () => {
        const now = 1_000_000_000_000;
        const grace = 60 * 24 * 60 * 60 * 1000; // 60 days

        it('returns ids of deleted entries older than grace window', () => {
            const entries = [
                { id: 'old', deleted: true, deletedAt: now - grace - 1 },
                { id: 'recent', deleted: true, deletedAt: now - 1000 },
            ];
            expect(tombstonesToGC(entries, now, grace)).toEqual(['old']);
        });

        it('exactly at the boundary is NOT GC-able (strictly older required)', () => {
            const entries = [{ id: 'edge', deleted: true, deletedAt: now - grace }];
            expect(tombstonesToGC(entries, now, grace)).toEqual([]);
        });

        it('non-deleted entries are ignored even if very old', () => {
            const entries = [
                { id: 'live', deleted: false, deletedAt: now - grace - 99999 },
                { id: 'live2', deletedAt: now - grace - 99999 },
            ];
            expect(tombstonesToGC(entries, now, grace)).toEqual([]);
        });

        it('deleted entry with missing deletedAt is treated as NOT GC-able (safe default)', () => {
            const entries = [{ id: 'nodate', deleted: true }];
            expect(tombstonesToGC(entries, now, grace)).toEqual([]);
        });

        it('mixed list returns only the eligible ids', () => {
            const entries = [
                { id: 'gc1', deleted: true, deletedAt: now - grace - 1 },
                { id: 'keep-recent', deleted: true, deletedAt: now },
                { id: 'keep-live', deleted: false, deletedAt: now - grace - 1 },
                { id: 'keep-nodate', deleted: true },
                { id: 'gc2', deleted: true, deletedAt: 0 },
            ];
            expect(tombstonesToGC(entries, now, grace).sort()).toEqual(['gc1', 'gc2']);
        });

        it('empty input -> empty output', () => {
            expect(tombstonesToGC([], now, grace)).toEqual([]);
        });
    });

    describe('isSchemaTooNew(remoteSchemaVersion, supportedSchemaVersion)', () => {
        it('remote > supported -> true', () => {
            expect(isSchemaTooNew(2, 1)).toBe(true);
        });

        it('remote == supported -> false', () => {
            expect(isSchemaTooNew(1, 1)).toBe(false);
        });

        it('remote < supported -> false', () => {
            expect(isSchemaTooNew(1, 2)).toBe(false);
        });
    });

    describe('removedSyncedIds(oldMeta, newMeta)', () => {
        it('id removed and was syncEnabled -> included', () => {
            const oldMeta = { a: { syncEnabled: true } };
            const newMeta = {};
            expect(removedSyncedIds(oldMeta, newMeta)).toEqual(['a']);
        });

        it('id removed but was NOT syncEnabled -> excluded', () => {
            const oldMeta = { a: { syncEnabled: false } };
            const newMeta = {};
            expect(removedSyncedIds(oldMeta, newMeta)).toEqual([]);
        });

        it('id removed with no syncEnabled flag (undefined) -> excluded', () => {
            const oldMeta = { a: { name: 'X' } };
            const newMeta = {};
            expect(removedSyncedIds(oldMeta, newMeta)).toEqual([]);
        });

        it('id still present (synced) -> excluded', () => {
            const oldMeta = { a: { syncEnabled: true } };
            const newMeta = { a: { syncEnabled: true } };
            expect(removedSyncedIds(oldMeta, newMeta)).toEqual([]);
        });

        it('id still present but sync turned OFF -> excluded (disable is not a delete)', () => {
            const oldMeta = { a: { syncEnabled: true } };
            const newMeta = { a: { syncEnabled: false } };
            expect(removedSyncedIds(oldMeta, newMeta)).toEqual([]);
        });

        it('id added (only in newMeta) -> excluded', () => {
            const oldMeta = {};
            const newMeta = { a: { syncEnabled: true } };
            expect(removedSyncedIds(oldMeta, newMeta)).toEqual([]);
        });

        it('mixed: only removed-and-synced ids returned', () => {
            const oldMeta = {
                gone: { syncEnabled: true },
                goneUnsynced: { syncEnabled: false },
                kept: { syncEnabled: true },
                turnedOff: { syncEnabled: true },
            };
            const newMeta = {
                kept: { syncEnabled: true },
                turnedOff: { syncEnabled: false },
                added: { syncEnabled: true },
            };
            expect(removedSyncedIds(oldMeta, newMeta)).toEqual(['gone']);
        });

        it('empty / missing inputs -> []', () => {
            expect(removedSyncedIds({}, {})).toEqual([]);
            expect(removedSyncedIds(null, null)).toEqual([]);
            expect(removedSyncedIds(undefined, undefined)).toEqual([]);
            expect(removedSyncedIds(null, { a: { syncEnabled: true } })).toEqual([]);
            expect(removedSyncedIds({ a: { syncEnabled: true } }, null)).toEqual(['a']);
        });

        it('null entry value in oldMeta -> excluded (no crash)', () => {
            const oldMeta = { a: null };
            const newMeta = {};
            expect(removedSyncedIds(oldMeta, newMeta)).toEqual([]);
        });
    });
});
