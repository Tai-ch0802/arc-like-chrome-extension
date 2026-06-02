import { getOriginWindowId } from './searchContext.js';

/** 解析作用目標 normal 視窗 id:優先用啟動來源,否則退回最後聚焦的 normal 視窗。 */
export async function resolveTargetWindowId() {
    const fromCtx = getOriginWindowId();
    if (typeof fromCtx === 'number') return fromCtx;
    const w = await chrome.windows.getLastFocused({ windowTypes: ['normal'] }).catch(() => null);
    return w && typeof w.id === 'number' ? w.id : null;
}

/**
 * 從 Spotlight(獨立視窗)請求側邊欄執行 UI 類動作:
 * 寫 session 旗標 → 在來源視窗開側邊欄 → 關閉 Spotlight。
 * 旗標 pendingPanelAction 由側邊欄的 storage.session onChanged 監聽消費(見 sidepanel.js,後續任務)。
 * @param {string} id
 * @param {object} [extra]
 */
export async function requestPanelAction(id, extra = {}) {
    try {
        await chrome.storage.session.set({ pendingPanelAction: { id, ...extra, ts: Date.now() } });
        const winId = await resolveTargetWindowId();
        if (typeof winId === 'number') await chrome.sidePanel.open({ windowId: winId });
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
