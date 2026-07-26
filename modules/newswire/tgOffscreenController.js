// tgOffscreenController.js — offscreen 端 Telegram 控制（BASE-018 TG2b）。
//
// 從 offscreen.js 抽出以可單元測試(offscreen.js 依賴 chrome.runtime global 難直接測)。
// 職責:管理 tgAdapter 生命週期、generation guard(dynamic import 窗口內 disconnect
// 不留 orphan 連線)、tg:ping 回報。GramJS **只在 offscreen** 執行。
//
// DI:post(chrome.runtime.sendMessage)、loadAdapter(async 取 createTgAdapter;生產動態
// import tgAdapter,其 open() 再動態 import 2.6M bundle → 不啟用 tg 零成本)。

export function createTgOffscreenController(deps = {}) {
    const post = deps.post || ((msg) => { try { chrome.runtime.sendMessage(msg).catch(() => {}); } catch { /* no receiver */ } });
    const loadAdapter = deps.loadAdapter || (() => import('./tgAdapter.js').then((m) => m.createTgAdapter));
    const loadClient = deps.loadClient || (() => import('./tgClient.js').then((m) => m.createTgClient));

    let adapter = null;
    let lastStatus = 'disabled';
    let generation = 0;

    async function connect(cfg) {
        const gen = ++generation;
        let createTgAdapter;
        try {
            createTgAdapter = await loadAdapter();
        } catch {
            // 載入失敗(dynamic import reject)→ retrying,SW watchdog 會再排程(此時無 adapter)。
            lastStatus = 'retrying';
            post({ action: 'tg:status', status: 'retrying' });
            return;
        }
        // import 期間若 disconnect 或新 connect(gen 已變)→ 收手,不建立無人管理的 orphan。
        if (gen !== generation) return;
        if (adapter) { try { adapter.disconnect(); } catch { /* noop */ } adapter = null; }
        adapter = createTgAdapter(cfg, {
            onRaw: (raw) => post({ action: 'tg:raw', raw }),
            onStatus: (status) => { lastStatus = status; post({ action: 'tg:status', status }); },
        });
        adapter.connect();
    }

    function disconnect() {
        generation += 1; // 使 in-flight connect 於 loadAdapter resolve 後收手
        if (adapter) { try { adapter.disconnect(); } catch { /* noop */ } adapter = null; }
        lastStatus = 'disabled';
    }

    /**
     * 解析頻道(加頻道前的防仿冒確認)。**offscreen 是唯一被允許用 session 連線的地方**。
     *
     * 為何一定要集中在此:MTProto 對同一 auth key 的併發連線會直接作廢 session
     * (AUTH_KEY_DUPLICATED)。原設計讓 options 頁自建短命 client 做解析,與此處的常駐
     * 收訊連線併發 → 使用者連續加幾個頻道就被伺服器踢掉 session,且錯誤被歸類為
     * needs-key、UI 顯示「需填入 API key」完全對不上真相。
     *
     * 兩條路徑都保證「同時只有一條連線」:
     *   (a) 常駐連線活著 → 直接借用它,不另開連線;
     *   (b) 未啟用/未連線(無常駐連線)→ 臨時建一條、用完立刻斷。
     * @param {object} cfg {session, apiId, apiHash}
     * @param {string} username
     */
    async function resolveChannel(cfg, username) {
        if (adapter && adapter.isAlive() && typeof adapter.resolveChannel === 'function') {
            return adapter.resolveChannel(username);
        }
        const createTgClient = await loadClient();
        const client = await createTgClient(cfg);
        try {
            await client.connect();
            const entity = await client.getEntity(username);
            return {
                id: entity?.id != null ? String(entity.id) : undefined,
                username: entity?.username,
                title: entity?.title,
                participantsCount: entity?.participantsCount,
            };
        } finally {
            try { await client.disconnect(); } catch { /* noop */ }
        }
    }

    // watchdog 探活:hasAdapter 讓 SW 區分「adapter 退避中(別干預)」vs「無 adapter(需重連)」——
    // 不能只看 status,因 offscreen 被 RSS 重建成 adapter-less 時 status 亦為 'disabled'。
    function ping() {
        return { alive: !!adapter && adapter.isAlive(), hasAdapter: !!adapter, status: lastStatus };
    }

    return { connect, disconnect, ping, resolveChannel };
}
