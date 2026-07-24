// pako-based zlib shim:teleproto GZIPPacked 只用 zlib.unzipSync(解壓 gzip response;
// gzip 送出未啟用——GZIPPacked.gzip() 直接 return input)。取代 browserify-zlib
// (+8 個 transitive)——供應鏈更小、更好稽核。只匯出實際用到的解壓函式,讓 esbuild
// tree-shake 掉 pako deflate。pako = MIT AND Zlib。
const { inflate, ungzip } = require('pako');
const toBuf = (u8) => Buffer.from(u8);
// unzipSync:node zlib 自動偵測 gzip(0x1f 0x8b) / zlib header。
const unzipSync = (buf) => {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  return toBuf(b[0] === 0x1f && b[1] === 0x8b ? ungzip(b) : inflate(b));
};
module.exports = {
  unzipSync,
  gunzipSync: (b) => toBuf(ungzip(b)),
  inflateSync: (b) => toBuf(inflate(b)),
};
