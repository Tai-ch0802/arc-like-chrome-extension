// tgClient.js — GramJS 客戶端工廠（BASE-018）。
//
// 載入策略定案（TG2 offscreen，見 SA §2/§8）：GramJS 於 **offscreen document**
// 執行，SW 端以 message proxy 控制。理由（TG1-live 查證）：
//   1. MV3 service worker **不支援 dynamic import()**——Chrome 官方文件明文
//      「import()...is not supported」，w3c/webextensions #212 仍 open。故無法在
//      SW 內按需載入 1.3M 的 GramJS bundle。
//   2. 靜態 import 雖 SW（type:module）可用,但會讓每次 SW 冷啟都 parse 1.3M,
//      tg 預設 disabled 的絕大多數用戶白付（且 SW 頻繁回收放大成本）。
//   3. GramJS 登入（client.start：phone→code→2FA）需 DOM context 互動 prompt,
//      SW 無法提供——登入本就得在 offscreen/options。
// → offscreen document（DOM context）可 dynamic import bundle、跑常駐 WSS、辦登入;
//    SW 只在 tg 啟用時建 offscreen 並以 watchdog alarm 監控其存活/重建。
//
// TG1-live 僅落地可重現 build recipe（tools/telegram-bundle/）;bundle 與 offscreen
// 整合連同登入 UI 於 TG2 一次實作。在此之前本工廠為 stub:createTgClient 拋明確
// 錯誤,tgAdapter 捕捉為非致命（生產 tg enabled=false＋無 UI 不觸發）。

export function createTgClient() {
    throw new Error('GramJS runs in an offscreen document (BASE-018 TG2); not wired yet');
}

// GramJS NewMessage 事件類別（TG2 offscreen 整合時於 offscreen 端取用）。
export const NewMessage = null;
