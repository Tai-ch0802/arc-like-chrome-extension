// tgOffscreenController.js — offscreen 端 Telegram 控制（BASE-018 TG2b）。
//
// 從 offscreen.js 抽出以可單元測試(offscreen.js 依賴 chrome.runtime global 難直接測)。
// 職責:管理 tgAdapter 生命週期、generation guard(dynamic import 窗口內 disconnect
// 不留 orphan 連線)、tg:ping 回報。GramJS **只在 offscreen** 執行。
//
// DI:post(chrome.runtime.sendMessage)、loadAdapter(async 取 createTgAdapter;生產動態
// import tgAdapter,其 open() 再動態 import 2.6M bundle → 不啟用 tg 零成本)。

// 「常駐連線尚未就緒」的錯誤碼。跨 offscreen → SW → options 傳遞(只有字串會過
// message boundary),options 端據此換成 i18n 文案。
export const TG_NOT_READY = 'TG_NOT_READY';

// 等常駐連線就緒的上限。必須 < feedManager.resolveTgChannel 的 30s sendMessage
// 逾時,否則 options 收到的會是無意義的「逾時」而非本模組的明確錯誤碼。
const READY_TIMEOUT_MS = 20000;
const READY_POLL_MS = 250;

export function createTgOffscreenController(deps = {}) {
    const post = deps.post || ((msg) => { try { chrome.runtime.sendMessage(msg).catch(() => {}); } catch { /* no receiver */ } });
    const loadAdapter = deps.loadAdapter || (() => import('./tgAdapter.js').then((m) => m.createTgAdapter));
    const loadClient = deps.loadClient || (() => import('./tgClient.js').then((m) => m.createTgClient));
    const sleep = deps.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));

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
     * 等常駐連線就緒(輪詢)。回 false 的三種情形都代表「不該借用、也不該另建」:
     *   - adapter 於等待期間被 disconnect(使用者關閉 tg)→ 讓使用者重試,下次走臨時連線;
     *   - 終止態(needs-login/needs-key)→ 永不會 alive,立刻收手而非白等 20 秒;
     *   - 逾時 → 仍在連線中(慢網路/大 bundle),絕不可 fallback 成臨時連線。
     */
    async function waitAdapterAlive() {
        for (let waited = 0; waited < READY_TIMEOUT_MS; waited += READY_POLL_MS) {
            if (!adapter) return false;
            if (adapter.isAlive()) return true;
            if (adapter.isFailed && adapter.isFailed()) return false;
            await sleep(READY_POLL_MS);
        }
        return !!adapter && adapter.isAlive();
    }

    /**
     * 解析頻道(加頻道前的防仿冒確認)。**offscreen 是唯一被允許用 session 連線的地方**。
     *
     * 為何一定要集中在此:MTProto 對同一 auth key 的併發連線會直接作廢 session
     * (AUTH_KEY_DUPLICATED)。原設計讓 options 頁自建短命 client 做解析,與此處的常駐
     * 收訊連線併發 → 使用者連續加幾個頻道就被伺服器踢掉 session,且錯誤被歸類為
     * needs-key、UI 顯示「需填入 API key」完全對不上真相。
     *
     * 不變式:**adapter 存在 ⇒ 絕不另建連線**,不論它 alive / 連線建立中 / 退避中。
     *   (a) adapter 存在 → 等它就緒後借用(逾時或終止態則報錯,**不 fallback**);
     *   (b) adapter 不存在(tg 未啟用)→ 臨時建一條、用完立刻斷。
     *
     * 為何不以 isAlive() 當唯一條件(PR #212 review 抓到的殘餘窗口):`open()` 內
     * `createClient()`(dynamic import 2.6M bundle)到 `client.connect()`(MTProto DH
     * 交換)完成之間,isAlive() 一路是 false 但連線正在建立,窗口達秒級到十秒級。而
     * options 登入後寫完 storage 就立刻顯示加頻道 UI(不等 SW 連上),使用者「登入後
     * 連續加頻道」正好落在窗口內 → 只看 isAlive() 會誤判無連線而另建臨時連線,製造
     * 出這個 PR 要修的併發。**逾時亦不可 fallback**:逾時只代表「還在連」,fallback
     * 就是併發。
     * @param {object} cfg {session, apiId, apiHash}
     * @param {string} username
     */
    async function resolveChannel(cfg, username) {
        if (adapter) {
            if (!(await waitAdapterAlive())) throw new Error(TG_NOT_READY);
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
