/**
 * @file offscreenManager.js
 * 共用 offscreen document 生命週期管理（BASE-018 TG2b）。
 *
 * Chrome 限**單一** offscreen document。RSS（`DOM_PARSER`，一次性 fetch+parse）與
 * Telegram（GramJS MTProto 常駐 WebSocket，TG2b）**共用同一個** document——故單例
 * guard 必須集中於此，否則兩處各自 `createDocument` 時，第二個會拋
 * 「Only a single offscreen document may be created」。原本 rssManager 內有一份，
 * 抽出共用；tg proxy 亦呼叫同一入口。
 *
 * 只在 SW / extension page context 有意義（`chrome.offscreen` API）。
 * @module modules/offscreenManager
 */

const OFFSCREEN_DOCUMENT_PATH = '/offscreen.html';
let creatingOffscreenDocument = null;

/**
 * 確保 offscreen document 存在,不存在則建立。單例:並發呼叫只建一次。
 */
export async function ensureOffscreenDocument() {
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)],
    });
    if (existingContexts.length > 0) return;

    // 防止多個並發建立(RSS 與 tg 可能同時觸發)。
    if (creatingOffscreenDocument) {
        await creatingOffscreenDocument;
        return;
    }

    creatingOffscreenDocument = chrome.offscreen.createDocument({
        url: OFFSCREEN_DOCUMENT_PATH,
        // DOM_PARSER 涵蓋 RSS;tg 的 WebSocket 在 offscreen 無需特定 reason。
        reasons: [chrome.offscreen.Reason.DOM_PARSER],
        justification: 'Parse RSS/Atom XML feeds and run the Telegram MTProto client (BASE-018).',
    });

    try {
        await creatingOffscreenDocument;
    } finally {
        creatingOffscreenDocument = null;
    }
}

/**
 * offscreen document 是否存在（不建立）。watchdog 探活用。
 * @returns {Promise<boolean>}
 */
export async function hasOffscreenDocument() {
    const contexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)],
    });
    return contexts.length > 0;
}
