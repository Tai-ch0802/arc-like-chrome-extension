// 可重現 build:GramJS(telegram@2.26.22)→ 單一 vendored ESM bundle。
// 產物:../../lib/telegram.bundle.js(比照 lib/Sortable.min.js,隨 make 進包)。
//
// 為何需要:GramJS 是 CJS + 多個 Node built-in 依賴,無法以原始碼直載於 dev 模式,
// esbuild 也不能開箱 bundle。此配方經 T0 spike 實測(crypto-browserify sha256 與
// Node 一致、瀏覽器 WSS transport 連向 Telegram web DC),見 docs/specs/.../SPIKE_T0.md。
//
// 重建:cd tools/telegram-bundle && npm ci && npm run build
import * as esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const outfile = resolve(here, '../../lib/telegram.bundle.js');

const r = await esbuild.build({
  entryPoints: [resolve(here, 'entry.mjs')],
  bundle: true, format: 'esm', platform: 'browser', target: 'es2020',
  outfile, minify: true, metafile: true, logLevel: 'error',
  define: { global: 'globalThis', 'process.env.NODE_ENV': '"production"' },
  inject: [resolve(here, 'shim-inject.mjs')],
  alias: {
    // 核心密碼路徑,不可省(spike 已驗 sha256 與 Node 一致)。
    crypto: 'crypto-browserify', stream: 'stream-browserify',
    // functional os shim:GramJS 建構讀 os.type() 等組 device 字串。
    os: resolve(here, 'os-shim.cjs'),
    // 空存根:記憶體 StringSession,不觸檔案系統/原生 socket。
    fs: resolve(here, 'empty-stub.cjs'), net: resolve(here, 'empty-stub.cjs'),
    tls: resolve(here, 'empty-stub.cjs'), socks: resolve(here, 'empty-stub.cjs'),
    'node-localstorage': resolve(here, 'empty-stub.cjs'),
    path: 'path-browserify', events: 'events', util: 'util',
  },
}).catch((e) => { console.error('BUILD FAIL:', e.message); process.exit(2); });

const bytes = Object.values(r.metafile.outputs)[0].bytes;
console.log(`BUILD OK → lib/telegram.bundle.js (${(bytes / 1024 / 1024).toFixed(2)} MB)`);
