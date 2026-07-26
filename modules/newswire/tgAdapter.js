// Telegram adapter (BASE-018 TG1)。
//
// 與其他源不同:tg 走 GramJS 客戶端（非 raw WebSocket），故不用 createWsAdapter，
// 但實作同一 `Adapter` 介面（connect/disconnect/isAlive）並沿用同一狀態詞彙
// （connecting/connected/retrying/degraded/needs-key），納入 feedManager 一致管理。
//
// GramJS 客戶端經 DI 注入（deps.createClient / deps.NewMessage），使整個狀態機
// 可用 fake client 單元測試（真 GramJS 為 vendored bundle，見 tgClient.js）。
// 生命週期:connect → 建 client → client.connect() → 逐頻道 getEntity →
// addEventHandler(NewMessage{chats}) → 新訊息以 `{message, channel}` 交 onRaw。
// 錯誤:FLOOD_WAIT 遵守伺服器秒數;session 失效（登出/撤銷/需 2FA）→ needs-key
// 終止（不打登入迴圈，FR-10）;其餘暫時性 → 指數退避重連。

import { computeBackoffMs, DEGRADED_AFTER_FAILS } from './adapters.js';
import { createTgClient, getNewMessage } from './tgClient.js';

/**
 * 純函式:分類 GramJS 錯誤。
 * - 'flood'：FLOOD_WAIT，附 seconds（遵守伺服器等待）
 * - 'fatal'：憑證/session 失效，重試無用 → needs-key 終止
 * - 'transient'：暫時性 → 一般退避重連
 * @param {any} e
 * @returns {{ kind:'flood'|'fatal'|'transient', seconds?:number }}
 */
export function classifyTgError(e) {
    const msg = String((e && (e.errorMessage || e.message)) || '');
    // 真實 GramJS FloodWaitError:e.seconds 帶等待秒數,但 message 是人類語句
    //「A wait of N seconds is required」、errorMessage 是 'FLOOD'——都不含
    //「FLOOD_WAIT」token。故以 e.seconds 為準;字串比對僅為 fallback。
    if (Number.isFinite(e && e.seconds) && e.seconds > 0) return { kind: 'flood', seconds: e.seconds };
    if (/FLOOD_WAIT|A wait of \d+ seconds/i.test(msg)) {
        const m = msg.match(/FLOOD_WAIT_(\d+)|wait of (\d+)/i);
        return { kind: 'flood', seconds: m ? Number(m[1] || m[2]) : 60 };
    }
    // 憑證/session 失效:重試無用 → 終止(FR-09/10)。兩者都是 fatal,但**要分辨**:
    // 使用者的補救動作完全不同(重新登入 vs 檢查 api_id),而舊版一律回報 needs-key,
    // 讓 session 被作廢時 UI 顯示「需填入 API key」——key 明明還在,文案與真相相反。
    // session 類:金鑰未註冊/無效/重複(併發連線)/權限空、session 撤銷/過期/需 2FA、帳號停用。
    if (/AUTH_KEY_UNREGISTERED|AUTH_KEY_INVALID|AUTH_KEY_DUPLICATED|AUTH_KEY_PERM_EMPTY|SESSION_REVOKED|SESSION_EXPIRED|SESSION_PASSWORD_NEEDED|USER_DEACTIVATED/i.test(msg)) {
        return { kind: 'fatal', reason: 'session' };
    }
    // api_id 類:重新登入沒用,要換/檢查 my.telegram.org 申請的 api_id。
    if (/API_ID_INVALID|API_ID_PUBLISHED_FLOOD/i.test(msg)) {
        return { kind: 'fatal', reason: 'apiId' };
    }
    return { kind: 'transient' };
}

/**
 * 純函式:取 GramJS 事件的 chat/channel id（供對應頻道 meta）,一律回**裸 id**。
 * 事件的 chatId getter(teleproto ChatGetter→getPeerId)對頻道回 **marked 形式**
 * `-100<id>`,而 metaById 的 key 是 getEntity 的裸 entity.id——不 normalize 則
 * lookup 必 miss,多頻道時 fallback meta 無 username → parseTgMessage 組不出
 * t.me url → 快訊不可點。strip 正則與 teleproto Utils.resolveId 一致
 * (`-100([^0]\d*)`,排除 -10000xyz 的普通群組誤判)。
 */
export function eventChatId(event) {
    if (event == null) return undefined;
    const bare = (v) => {
        const s = String(v);
        const m = s.match(/^-100([^0]\d*)$/);
        return m ? m[1] : s;
    };
    if (event.chatId != null) return bare(event.chatId);
    const peer = event.message && event.message.peerId;
    if (peer && peer.channelId != null) return bare(peer.channelId);
    if (peer && peer.chatId != null) return bare(peer.chatId);
    return undefined;
}

/**
 * @param {{session?:string, apiId?:number, apiHash?:string, channels?:Array<{id?:any, username?:string, title?:string}>}} cfg
 * @param {{onRaw?:Function, onStatus?:Function}} hooks
 * @param {object} [deps] 測試注入:createClient/NewMessage/setTimer/clearTimer/backoff
 * @returns {{connect:Function, disconnect:Function, isAlive:Function}}
 */
export function createTgAdapter(cfg = {}, hooks = {}, deps = {}) {
    const onRaw = hooks.onRaw || (() => {});
    const onStatus = hooks.onStatus || (() => {});
    const createClient = deps.createClient || createTgClient;
    // 測試以 deps.NewMessage 注入 fake class(同步);生產從 vendored bundle 動態取。
    const resolveNewMessage = deps.NewMessage ? () => deps.NewMessage : getNewMessage;
    const setTimer = deps.setTimer || ((fn, ms) => setTimeout(fn, ms));
    const clearTimer = deps.clearTimer || ((id) => clearTimeout(id));
    const backoff = deps.computeBackoff || computeBackoffMs;

    let client = null;
    let attempts = 0;
    let reconnectTimer = null;
    let stopped = false;
    let failed = false;   // 憑證類終止:不再重試,等 config 變更重建 adapter
    let connecting = false;

    const isAlive = () => !!client && client.connected === true;

    function scheduleReconnect(delayMs) {
        if (stopped || failed || reconnectTimer) return;
        attempts += 1;
        onStatus(attempts >= DEGRADED_AFTER_FAILS ? 'degraded' : 'retrying');
        reconnectTimer = setTimer(() => { reconnectTimer = null; open(); }, delayMs ?? backoff(attempts));
    }

    async function open() {
        if (stopped || failed || connecting || isAlive()) return;
        connecting = true;
        onStatus('connecting');
        // 重建前拆掉殘留 client(watchdog 週期重建時避免洩漏 client/handler)。
        if (client) { try { await (client.disconnect && client.disconnect()); } catch { /* noop */ } client = null; }
        try {
            client = await createClient({ session: cfg.session, apiId: cfg.apiId, apiHash: cfg.apiHash });
            // async 窗口(dynamic import 2.6M bundle)期間若 disconnect,resume 時已 stopped
            // → 拆掉剛建好的 client 並收手,避免 orphan(false 'connected' after 'disabled')。
            if (stopped || failed) { try { await client.disconnect(); } catch { /* noop */ } client = null; return; }
            await client.connect();
            // 逐頻道解析 entity,建 id→meta 對照供 onRaw 標記頻道。
            // 單一頻道解析失敗(handle 打錯/私有/仿冒)只跳過該頻道,不拖垮整個來源。
            const entities = [];
            const metaById = new Map();
            const wanted = cfg.channels || [];
            let lastFatalErr = null;   // 憑證/session 級錯誤:同一 client 下必定全頻道失敗
            for (const ch of wanted) {
                const ref = ch.username ? ch.username : ch.id;
                if (ref == null) continue;
                try {
                    const entity = await client.getEntity(ref);
                    entities.push(entity);
                    // meta.id 一律字串化以統一型別:entity.id 是 BigInteger 物件,而 metaById
                    // 的 key 與 eventChatId 的回傳都是字串,混用會 lookup miss;meta 也會經
                    // runtime message 送 SW(BigInteger 有 toJSON,不會 throw,但序列化後型別
                    // 會漂成字串)——在來源處就固定成字串,兩端型別才一致。
                    const rawId = ch.id ?? (entity && entity.id);
                    const meta = { id: rawId != null ? String(rawId) : undefined, username: ch.username ?? (entity && entity.username), title: ch.title ?? (entity && entity.title) };
                    if (meta.id != null) metaById.set(meta.id, meta);
                } catch (e) {
                    // 略過此頻道(不 throw);但保留 fatal 原因——session 失效會在
                    // getEntity 階段(非 connect)才浮現,不記下來全失敗時會被誤判 transient
                    // 而無限重連(違反 FR-10)。頻道級失敗(handle 打錯/私有)判 transient,不影響。
                    if (classifyTgError(e).kind === 'fatal') lastFatalErr = e;
                }
            }
            if (wanted.length && entities.length === 0) {
                // 一個都解析不到:若肇因於 session 失效,rethrow 原始 fatal error(上層
                // classifyTgError 判 fatal → needs-key 終止);否則暫時性 → 退避重連。
                throw lastFatalErr || new Error('no channel resolved');
            }
            const NewMessage = await resolveNewMessage();
            if (stopped || failed) { try { await client.disconnect(); } catch { /* noop */ } client = null; return; }
            // chats 必須傳頻道「識別碼」(entity.id),不能傳 entity 物件:teleproto 的
            // EventBuilder constructor 會對每個元素 .toString()(events/common.js:66),而
            // teleproto 實體無 toString → "[object Object]" → _intoIdSet 落到 getInputEntity
            // 解析失敗且被靜默吞掉(updates.js) → resolved 永遠 false → filter 第一行
            // `if(!resolved) return` 永久短路 → onRaw 一則都不會觸發(連上卻收不到)。
            // 傳 entity.id(BigInteger)→ toString 為數字字串 → parseID 正確解析為 peer id。
            const chatIds = entities.map((e) => e && e.id).filter((id) => id != null);
            client.addEventHandler((event) => {
                try {
                    const chatId = eventChatId(event);
                    const channel = (chatId != null && metaById.get(chatId))
                        || (metaById.size === 1 ? [...metaById.values()][0] : { id: chatId });
                    onRaw({ message: event && event.message, channel });
                } catch { /* 單則事件失敗不影響連線 */ }
            }, new NewMessage({ chats: chatIds }));
            attempts = 0;
            onStatus('connected'); // 部分頻道解析成功也算連上(壞頻道只是不推送)
        } catch (e) {
            const c = classifyTgError(e);
            try { await (client && client.disconnect && client.disconnect()); } catch { /* noop */ }
            client = null;
            if (stopped) return; // disconnect 後才 reject:不再發狀態,保留 'disabled'
            if (c.kind === 'fatal') {
                failed = true;
                // 分辨補救動作:session 失效 → 重新登入(needs-login);api_id 問題 →
                // 檢查/更換 api_id(needs-key)。兩者都不重試,等 config 變更才重建。
                onStatus(c.reason === 'apiId' ? 'needs-key' : 'needs-login');
            } else if (c.kind === 'flood') {
                scheduleReconnect(Math.max(1000, (c.seconds || 60) * 1000)); // 遵守 FLOOD_WAIT
            } else {
                scheduleReconnect(); // 暫時性:指數退避
            }
        } finally {
            connecting = false;
        }
    }

    return {
        connect() {
            stopped = false;
            if (!failed && !isAlive() && !reconnectTimer && !connecting) open();
        },
        /**
         * 用**既有連線**解析頻道(加頻道前的防仿冒確認)。
         *
         * 存在的唯一理由是避免 AUTH_KEY_DUPLICATED:MTProto 對同一 auth key 的併發
         * 連線會直接作廢 session。原本 options 頁自建短命 client 做這件事,與此處的
         * 常駐連線併發 → 使用者連續加幾個頻道就被伺服器踢掉 session。
         * 回傳形狀與 tgLoginController.resolveChannel 一致(options 端共用同一段渲染)。
         * @param {string} username 頻道 handle(不含 @)
         */
        async resolveChannel(username) {
            if (!isAlive()) throw new Error('tg adapter not connected');
            const entity = await client.getEntity(username);
            return {
                id: entity?.id != null ? String(entity.id) : undefined,
                username: entity?.username,
                title: entity?.title,
                participantsCount: entity?.participantsCount,
            };
        },
        disconnect() {
            stopped = true;
            if (reconnectTimer) { clearTimer(reconnectTimer); reconnectTimer = null; }
            attempts = 0;
            if (client) {
                try { client.disconnect && client.disconnect(); } catch { /* already closing */ }
                client = null;
            }
            onStatus('disabled');
        },
        isAlive,
        // 憑證/session 類終止態:永遠不會再變 alive。給 tgOffscreenController 的
        // 「等連線就緒」用——否則 resolveChannel 會白等到逾時才報錯。
        isFailed: () => failed,
    };
}
