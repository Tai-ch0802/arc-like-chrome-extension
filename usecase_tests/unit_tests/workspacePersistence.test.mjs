/**
 * ISSUE-162 WP1 — storage schema v2 持久化測試。
 *
 * 核心手法:以 jest.resetModules + dynamic import 取得「兩個獨立的
 * workspaceManager module 實例」(各持自己的 in-memory mirror),共用同一個
 * fake chrome.storage —— 模擬 sidepanel 與 background SW 兩個 context 的
 * 交錯寫入(AC-01/AC-02),驗證 per-id keys + read→merge→write 不再互踩。
 */

let fakeTabsByWindow = {};

function createFakeChrome() {
    const store = { sync: {}, local: {} };
    const counts = { sync: { set: 0, remove: 0 }, local: { set: 0, remove: 0 } };
    const clone = (v) => JSON.parse(JSON.stringify(v));
    const makeArea = (name) => ({
        get(keys, cb) {
            const src = store[name];
            let out = {};
            if (keys === null || keys === undefined) {
                out = clone(src);
            } else {
                const arr = Array.isArray(keys) ? keys : [keys];
                for (const k of arr) if (k in src) out[k] = clone(src[k]);
            }
            cb(out);
        },
        set(items, cb) {
            counts[name].set++;
            for (const [k, v] of Object.entries(items)) store[name][k] = clone(v);
            if (cb) cb();
        },
        remove(keys, cb) {
            counts[name].remove++;
            for (const k of [].concat(keys)) delete store[name][k];
            if (cb) cb();
        },
    });
    return {
        store,
        counts,
        chrome: {
            storage: { sync: makeArea('sync'), local: makeArea('local'), onChanged: { addListener() {} } },
            runtime: {},
            i18n: { getMessage: () => '' },
            tabs: { query: async ({ windowId }) => (fakeTabsByWindow[windowId] || []) },
            tabGroups: { query: async () => [] },
            windows: { getAll: async () => [], get: async () => { throw new Error('no window'); } },
        },
    };
}

/**
 * 取得一個全新的 workspaceManager module 實例(獨立 in-memory mirror)。
 * 注意:用 require 而非 dynamic import — jest 未開 --experimental-vm-modules,
 * 而 esbuild transform 已把測試轉成 CJS,require 走 jest registry,
 * 配合 resetModules 可重複實例化。
 */
async function loadManagerInstance() {
    jest.resetModules();
    // eslint-disable-next-line global-require
    return require('../../modules/workspace/workspaceManager.js');
}

/** 直接灌一筆 v2 工作區到 fake store。 */
function seedV2(store, id, { name = 'WS', tabs = [], rev = 1, updatedAt = 1000 } = {}) {
    store.sync['wsMeta_' + id] = {
        id, name, color: 'blue', icon: 'work', syncEnabled: false, lastActiveAt: 1000,
    };
    store.local['wsSnap_' + id] = { tabs, rev, updatedAt };
}

let fake;
beforeEach(() => {
    fake = createFakeChrome();
    globalThis.chrome = fake.chrome;
    fakeTabsByWindow = {};
});

describe('v1 → v2 migration (AC-06)', () => {
    it('v1 兩張大表拆成 per-id keys;legacy sync key 移除、local 備份保留', async () => {
        fake.store.sync.workspaceMetadata = {
            ws1: { id: 'ws1', name: 'Alpha', color: 'red', icon: 'work', lastActiveAt: 111, rev: 7, updatedAt: 222, syncEnabled: true },
        };
        fake.store.local.workspaceSnapshots = { ws1: [{ url: 'https://a.com/', title: 'A', pinned: false }] };

        const m = await loadManagerInstance();
        await m.initWorkspaces();

        expect(fake.store.sync['wsMeta_ws1']).toMatchObject({ id: 'ws1', name: 'Alpha', syncEnabled: true });
        expect(fake.store.sync['wsMeta_ws1'].rev).toBeUndefined();          // rev 移入 local
        expect(fake.store.local['wsSnap_ws1']).toEqual({
            tabs: [{ url: 'https://a.com/', title: 'A', pinned: false }], rev: 7, updatedAt: 222,
        });
        expect(fake.store.sync.workspaceMetadata).toBeUndefined();          // 防混版互寫
        expect(fake.store.local.workspaceSnapshots).toBeDefined();          // local 備份保留

        const ws = m.getWorkspace('ws1');
        expect(ws.name).toBe('Alpha');
        expect(ws.rev).toBe(7);
        expect(ws.tabSnapshot).toHaveLength(1);
    });

    it('Phase-6 unified key 也能一步遷到 v2', async () => {
        fake.store.local.workspaces = {
            old1: { id: 'old1', name: 'Legacy', color: 'grey', icon: 'work', lastActiveAt: 50, tabSnapshot: [{ url: 'https://l.com/', title: 'L', pinned: false }] },
        };
        const m = await loadManagerInstance();
        await m.initWorkspaces();
        expect(fake.store.sync['wsMeta_old1'].name).toBe('Legacy');
        expect(fake.store.local['wsSnap_old1'].tabs).toHaveLength(1);
        expect(m.getWorkspace('old1').rev).toBe(1);
    });

    it('全新安裝:無任何資料 → 空狀態,不誤寫', async () => {
        const m = await loadManagerInstance();
        await m.initWorkspaces();
        expect(m.getAllWorkspaces()).toEqual([]);
        expect(Object.keys(fake.store.sync)).toHaveLength(0);
    });
});

describe('雙 context 互踩防護 (AC-01 / AC-02)', () => {
    it('AC-01:B 先快照、A 用過期 mirror rename → 名稱與新快照皆保留,rev 單調遞增', async () => {
        seedV2(fake.store, 'X', { name: 'Old', tabs: [{ url: 'https://t0.com/', title: 'T0', pinned: false }], rev: 3 });
        const A = await loadManagerInstance(); // sidepanel
        const B = await loadManagerInstance(); // background SW
        await A.initWorkspaces();
        await B.initWorkspaces();

        // B(background)拍到新快照 → wsSnap_X.tabs 更新、rev 4
        fakeTabsByWindow[1] = [{ url: 'https://new.com/', title: 'N', pinned: false, groupId: -1 }];
        await B.snapshotIntoWorkspace('X', 1);
        expect(fake.store.local['wsSnap_X'].rev).toBe(4);

        // A(sidepanel)mirror 仍是 rev 3 / 舊 tabs → rename
        await A.updateWorkspace('X', { name: 'Renamed' });

        // v1 行為:A 會把整張 snapshots 表(含舊 tabs)寫回 → B 的快照被回滾。
        // v2:rename 的 snap 寫入走 read→merge → B 的 tabs 保留、rev 續 bump。
        expect(fake.store.sync['wsMeta_X'].name).toBe('Renamed');
        expect(fake.store.local['wsSnap_X'].tabs).toEqual([{ url: 'https://new.com/', title: 'N', pinned: false }]);
        expect(fake.store.local['wsSnap_X'].rev).toBe(5);
    });

    it('AC-02:A 編輯 X、B 快照 Y,互不影響', async () => {
        seedV2(fake.store, 'X', { name: 'XX', tabs: [{ url: 'https://x.com/', title: 'X', pinned: false }], rev: 2 });
        seedV2(fake.store, 'Y', { name: 'YY', tabs: [{ url: 'https://y.com/', title: 'Y', pinned: false }], rev: 9 });
        const A = await loadManagerInstance();
        const B = await loadManagerInstance();
        await A.initWorkspaces();
        await B.initWorkspaces();

        fakeTabsByWindow[2] = [{ url: 'https://y2.com/', title: 'Y2', pinned: false, groupId: -1 }];
        await B.snapshotIntoWorkspace('Y', 2);
        await A.updateWorkspace('X', { name: 'XX2' });

        expect(fake.store.sync['wsMeta_X'].name).toBe('XX2');
        expect(fake.store.sync['wsMeta_Y'].name).toBe('YY');
        expect(fake.store.local['wsSnap_Y'].tabs[0].url).toBe('https://y2.com/');
        expect(fake.store.local['wsSnap_Y'].rev).toBe(10);
        expect(fake.store.local['wsSnap_X'].rev).toBe(3); // rename bump
    });
});

describe('快照路徑零 sync 寫入 (AC-05 / FR-02)', () => {
    it('snapshotIntoWorkspace 只寫 local;lastActiveAt 不動', async () => {
        seedV2(fake.store, 'X', { tabs: [{ url: 'https://t0.com/', title: 'T0', pinned: false }], rev: 1 });
        const m = await loadManagerInstance();
        await m.initWorkspaces();

        fake.counts.sync.set = 0;
        fake.counts.local.set = 0;
        fakeTabsByWindow[1] = [{ url: 'https://n.com/', title: 'N', pinned: false, groupId: -1 }];
        await m.snapshotIntoWorkspace('X', 1);

        expect(fake.counts.sync.set).toBe(0);
        expect(fake.counts.local.set).toBeGreaterThan(0);
        expect(fake.store.sync['wsMeta_X'].lastActiveAt).toBe(1000); // 未被快照擾動
    });
});

describe('applyRemoteWorkspace keepLocalSnapshot (AC-04 / F3)', () => {
    it('live-bound:保留本地 tabs、採納遠端 rev/updatedAt 與 metadata', async () => {
        seedV2(fake.store, 'X', { name: 'Local', tabs: [{ url: 'https://local.com/', title: 'L', pinned: false }], rev: 3, updatedAt: 300 });
        const m = await loadManagerInstance();
        await m.initWorkspaces();

        await m.applyRemoteWorkspace('X', {
            metadata: { name: 'RemoteName', color: 'red', syncEnabled: true },
            tabSnapshot: [{ url: 'https://remote.com/', title: 'R', pinned: false }],
            rev: 10,
            updatedAt: 999,
            keepLocalSnapshot: true,
        });

        const ws = m.getWorkspace('X');
        expect(ws.name).toBe('RemoteName');
        expect(ws.tabSnapshot[0].url).toBe('https://local.com/');   // 本地 tabs 保留
        expect(ws.rev).toBe(10);                                     // 採納遠端排序權
        expect(ws.updatedAt).toBe(999);
        expect(fake.store.local['wsSnap_X'].tabs[0].url).toBe('https://local.com/');
        expect(fake.store.local['wsSnap_X'].rev).toBe(10);
    });

    it('未綁定:整顆套用遠端 tabs(原行為)', async () => {
        seedV2(fake.store, 'X', { tabs: [{ url: 'https://local.com/', title: 'L', pinned: false }], rev: 3 });
        const m = await loadManagerInstance();
        await m.initWorkspaces();
        await m.applyRemoteWorkspace('X', {
            metadata: { name: 'R' },
            tabSnapshot: [{ url: 'https://remote.com/', title: 'R', pinned: false }],
            rev: 10,
            updatedAt: 999,
        });
        expect(m.getWorkspace('X').tabSnapshot[0].url).toBe('https://remote.com/');
    });
});

describe('單一綁定不變式 (FR-06 / F5)', () => {
    it('綁定到新視窗時,移除其他視窗對同一工作區的綁定', async () => {
        seedV2(fake.store, 'X', {});
        const m = await loadManagerInstance();
        await m.initWorkspaces();

        await m.setActiveWorkspace(1, 'X');
        expect(m.getActiveWorkspaceId(1)).toBe('X');
        await m.setActiveWorkspace(2, 'X');
        expect(m.getActiveWorkspaceId(2)).toBe('X');
        expect(m.getActiveWorkspaceId(1)).toBeNull();

        const map = fake.store.local.windowWorkspaceMap;
        expect(Object.values(map).filter(v => v === 'X')).toHaveLength(1);
    });

    it('touch:false 不 bump lastActiveAt(rebind 用,不擾動 recency 排序)', async () => {
        seedV2(fake.store, 'X', {});
        const m = await loadManagerInstance();
        await m.initWorkspaces();
        await m.setActiveWorkspace(1, 'X', { touch: false });
        expect(fake.store.sync['wsMeta_X'].lastActiveAt).toBe(1000);
        await m.setActiveWorkspace(2, 'X'); // 預設 touch
        expect(fake.store.sync['wsMeta_X'].lastActiveAt).toBeGreaterThan(1000);
    });
});
