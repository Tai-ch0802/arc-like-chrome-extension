import { getOriginWindowId } from './searchContext.js';

/** pendingPanelAction 的有效期:超過即視為陳年動作丟棄(A3)。 */
export const PANEL_ACTION_TTL_MS = 15000;

/** 解析作用目標 normal 視窗 id:優先用啟動來源,否則退回最後聚焦的 normal 視窗。 */
export async function resolveTargetWindowId() {
    const fromCtx = getOriginWindowId();
    if (typeof fromCtx === 'number') return fromCtx;
    const w = await chrome.windows.getLastFocused({ windowTypes: ['normal'] }).catch(() => null);
    return w && typeof w.id === 'number' ? w.id : null;
}

/**
 * 判定一個 pendingPanelAction 對「我這個 panel」該怎麼處理。純函式(可單元測試)。
 *
 * 定址語意(ISSUE-162 A1):動作寄給特定視窗;非目標視窗的 panel 必須
 * 'ignore' 且**不可清旗標**(目標視窗的 panel 可能還在初始化,清了就漏)。
 * 過期(A3)則由任何 panel 'expired' 清掉,避免 sidePanel.open 失敗後
 * 旗標殘留整個 session、之後突發執行。
 *
 * @param {{id?:string, windowId?:number, ts?:number}|null|undefined} pending
 * @param {number} myWindowId
 * @param {number} now
 * @param {number} [ttlMs]
 * @returns {'execute'|'ignore'|'expired'}
 */
export function classifyPendingAction(pending, myWindowId, now, ttlMs = PANEL_ACTION_TTL_MS) {
    if (!pending || !pending.id) return 'ignore';
    if (typeof pending.ts === 'number' && now - pending.ts > ttlMs) return 'expired';
    // 缺 windowId(理論上不發生)→ 視為廣播,維持可用性。
    if (typeof pending.windowId === 'number' && pending.windowId !== myWindowId) return 'ignore';
    return 'execute';
}

/**
 * 從 Spotlight(獨立視窗)請求側邊欄執行 UI 類動作:
 * 解析目標視窗 → 寫入「定址」session 旗標 → 在目標視窗開側邊欄 → 關閉 Spotlight。
 * 旗標 pendingPanelAction 由側邊欄的 storage.session onChanged 監聽消費
 * (見 sidepanel.js consumePendingPanelAction;只有 windowId 相符的 panel 會執行)。
 * @param {string} id
 * @param {object} [extra]
 */
export async function requestPanelAction(id, extra = {}) {
    try {
        // 先解析目標視窗再寫旗標:payload 必須帶定址,否則其他視窗的
        // panel 會搶答(在錯誤視窗執行動作)或雙重執行(ISSUE-162 A1)。
        const winId = await resolveTargetWindowId();
        await chrome.storage.session.set({
            pendingPanelAction: { id, ...extra, windowId: winId, ts: Date.now() },
        });
        if (typeof winId === 'number') {
            try {
                await chrome.sidePanel.open({ windowId: winId });
            } catch (openErr) {
                // 開 panel 失敗(gesture 過期/視窗剛關)→ 不留殘旗標,
                // 否則下次手動開 panel 會突發執行陳年動作(A3)。
                await chrome.storage.session.remove('pendingPanelAction').catch(() => {});
                throw openErr;
            }
        }
    } catch (err) {
        console.warn('[spotlight] requestPanelAction failed:', err && err.message ? err.message : err);
    } finally {
        if (typeof window !== 'undefined' && typeof window.close === 'function') window.close();
    }
}

/** 在來源 normal 視窗開新分頁(導航類:開書籤/閱讀清單)。 */
export async function openUrlInOrigin(url) {
    const winId = await resolveTargetWindowId();
    await chrome.tabs.create(typeof winId === 'number' ? { url, windowId: winId } : { url });
}
