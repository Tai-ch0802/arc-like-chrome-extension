// 生產 entry：只匯出 tgClient.js 需要的三個符號。teleproto（MIT，telegram/GramJS
// 的 fork）目錄/API 與上游對齊，sessions/events 子路徑相同。
export { TelegramClient } from 'teleproto';
export { StringSession } from 'teleproto/sessions/index.js';
export { NewMessage } from 'teleproto/events/index.js';
// 瀏覽器連線層:teleproto 預設 networkSocket=PromisedNetSockets(用 node:net,本 recipe
// 已 stub → new net.Socket() 會炸「Socket is not a constructor」)。真連線須顯式傳
// networkSocket=PromisedWebSockets(用 globalThis.WebSocket、isWebSocket=true 讓 client
// 選 WebSocket transport)。offscreen/options 皆 DOM context,有原生 WebSocket。
export { PromisedWebSockets } from 'teleproto/extensions/index.js';
