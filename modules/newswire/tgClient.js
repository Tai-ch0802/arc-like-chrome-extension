// tgClient.js — 真實 GramJS 客戶端工廠（BASE-018）。
//
// GramJS 以 vendored bundle 形式進包（`lib/telegram.bundle.js`，隨 TG1-live
// 落地——見 SPIKE_T0.md：1.3M，需 polyfill build）。在 bundle 就緒前,
// createTgClient 拋明確錯誤;tgAdapter 會捕捉為非致命錯誤（transient→退避）。
// 生產環境不會觸發此路徑：defaultNewswireConfig.sources.tg.enabled 預設
// false，且尚無 options UI 可啟用（TG2）。
//
// bundle 就緒後,本檔改為:
//   import { TelegramClient, StringSession, NewMessage } from '../../lib/telegram.bundle.js';
//   export function createTgClient({ session, apiId, apiHash }) {
//     return new TelegramClient(new StringSession(session), apiId, apiHash,
//       { connectionRetries: 3, useWSS: true });
//   }
//   export { NewMessage };

export function createTgClient() {
    throw new Error('GramJS bundle not vendored yet (BASE-018 TG1-live)');
}

// GramJS NewMessage 事件類別（bundle 就緒後改為真匯出）。
export const NewMessage = null;
