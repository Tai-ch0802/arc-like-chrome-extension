// 生產 entry：只匯出 tgClient.js 真正需要的三個符號。GramJS 其餘 API 不進 bundle
// 的 public surface（tree-shake 靠 esbuild），減少誤用面。
export { TelegramClient } from 'telegram';
export { StringSession } from 'telegram/sessions/index.js';
export { NewMessage } from 'telegram/events/index.js';
