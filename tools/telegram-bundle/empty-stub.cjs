// fs/net/tls/socks/node-localstorage 的空存根:StringSession 走記憶體 session,
// 不觸及檔案系統/原生 socket(瀏覽器/SW 用原生 WebSocket transport)。
module.exports = {};
