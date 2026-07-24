// tgProxyAdapter.js — SW 端 Telegram proxy（BASE-018 TG2b）。
//
// GramJS 在 offscreen document 執行（SA §8:MV3 SW 不支援 dynamic import 且登入需
// DOM context）。此 proxy 實作與其他源相同的 Adapter 介面（connect/disconnect/
// isAlive），但**不持有 GramJS**——只透過 message 控制 offscreen:
//   connect() → ensureOffscreenDocument() → post `tg:connect`{cfg}
//   disconnect() → post `tg:disconnect`
// offscreen 收到的新訊息/狀態經 `tg:raw`/`tg:status` 回 SW,由 feedManager 分派
// （tg:raw→handleRaw、tg:status→setRemoteStatus）。offscreen 被回收的自癒由 SW 端
// watchdog 以 `tg:ping` 探活（見 feedManager.handleNewswireWatchdog）——不能只靠
// isAlive(),因為 offscreen 被回收後不再回報,lastStatus 會停在過時的 'connected'。
import { ensureOffscreenDocument } from '../offscreenManager.js';

export function createTgProxyAdapter(cfg = {}, hooks = {}, deps = {}) {
    const onStatus = hooks.onStatus || (() => {});
    const post = deps.post || ((msg) => { try { chrome.runtime.sendMessage(msg).catch(() => {}); } catch { /* no receiver */ } });
    const ensureOffscreen = deps.ensureOffscreen || ensureOffscreenDocument;

    let lastStatus = 'disabled';
    let stopped = false;

    async function open() {
        if (stopped) return;
        lastStatus = 'connecting';
        onStatus('connecting');
        try {
            await ensureOffscreen();
            if (stopped) return; // ensureOffscreen 期間若 disconnect,收手不發 tg:connect
            post({ action: 'tg:connect', cfg });
        } catch {
            // offscreen 建立失敗 → 暫時性,watchdog 下輪再試。
            lastStatus = 'retrying';
            onStatus('retrying');
        }
    }

    return {
        connect() { stopped = false; open(); },
        disconnect() {
            stopped = true;
            post({ action: 'tg:disconnect' });
            lastStatus = 'disabled';
            onStatus('disabled');
        },
        isAlive() { return lastStatus === 'connected'; },
        /** feedManager 收 offscreen 的 tg:status 時呼叫,透傳給 setStatus。 */
        setRemoteStatus(status) {
            lastStatus = status;
            onStatus(status);
        },
    };
}
