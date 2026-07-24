// tgClient.js — 真實 GramJS 客戶端工廠（BASE-018 TG2b）。
//
// **只在 offscreen document 執行**（DOM context 支援 dynamic import + WebSocket）。
// MV3 service worker 不支援 dynamic import()（Chrome 官方文件確認）,故 GramJS 不在
// SW——SW 端以 tgProxyAdapter 透過 message 控制 offscreen。見 SA §8。
//
// 動態 import:只有真正要建 tg client 時才載入 2.6M bundle（module 快取只載一次）。
// 底層是 teleproto（MIT,見 tools/telegram-bundle）。

let _modPromise = null;
function loadGramJS() {
    // import() reject 時清快取,讓 tgAdapter 的重連能重試(否則永遠拿到同一顆 rejected)。
    if (!_modPromise) {
        _modPromise = import('../../lib/telegram.bundle.js').catch((e) => { _modPromise = null; throw e; });
    }
    return _modPromise;
}

/**
 * 從 StringSession 字串建構 TelegramClient(連線由 tgAdapter 呼叫 .connect())。
 * @param {{session?:string, apiId?:number|string, apiHash?:string}} cfg
 * @returns {Promise<object>} GramJS TelegramClient
 */
export async function createTgClient({ session, apiId, apiHash } = {}) {
    const { TelegramClient, StringSession, PromisedWebSockets } = await loadGramJS();
    return new TelegramClient(new StringSession(session || ''), Number(apiId), String(apiHash), {
        connectionRetries: 3,
        useWSS: true,
        // 瀏覽器連線層:不傳則預設 PromisedNetSockets(node:net,recipe 已 stub → 炸)。
        // PromisedWebSockets 用 globalThis.WebSocket,offscreen DOM context 有原生 WS。
        networkSocket: PromisedWebSockets,
    });
}

/** 取 GramJS NewMessage 事件類別(tgAdapter 訂閱新訊息用)。 */
export async function getNewMessage() {
    return (await loadGramJS()).NewMessage;
}
