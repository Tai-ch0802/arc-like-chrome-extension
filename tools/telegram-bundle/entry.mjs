// 生產 entry：只匯出 tgClient.js 需要的三個符號。teleproto（MIT，telegram/GramJS
// 的 fork）目錄/API 與上游對齊，sessions/events 子路徑相同。
export { TelegramClient } from 'teleproto';
export { StringSession } from 'teleproto/sessions/index.js';
export { NewMessage } from 'teleproto/events/index.js';
