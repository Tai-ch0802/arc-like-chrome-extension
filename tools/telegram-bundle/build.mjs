// 可重現 build:teleproto(MIT fork of GramJS)→ 單一 vendored ESM bundle。
// 產物:dist/telegram.bundle.js(gitignored,刻意不落 lib/——見 README)。
//
// 為何 teleproto 而非 telegram:上游 telegram 強制依賴 @cryptography/aes(GPL-3.0-
// or-later,在 AES-IGE 核心路徑會被 inline 進 bundle),與 MIT＋CWS 分發衝突。
// teleproto 依賴樹零 GPL、AES-IGE 改用 node:crypto(瀏覽器靠 crypto-browserify
// = MIT polyfill),API 與 GramJS 對齊。詳見 README ⚠️ 段與 SPIKE_T0.md。
//
// 重建:cd tools/telegram-bundle && npm ci && npm run build && npm run verify
import * as esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const outfile = resolve(here, 'dist/telegram.bundle.js');

const cb = 'crypto-browserify', sb = 'stream-browserify', pb = 'path-browserify';
const osShim = resolve(here, 'os-shim.cjs');
const stub = resolve(here, 'empty-stub.cjs');
// teleproto 用帶 `node:` 前綴的 import(node:crypto 等),故 bare 與 node: 兩種都 alias。
const alias = {
  // 核心密碼路徑:teleproto AES-IGE = node:crypto AES-CBC + 純 JS XOR;
  // crypto-browserify 的 aes-256-cbc/ctr 已驗與 Node 原生逐位元組一致(verify.mjs)。
  crypto: cb, 'node:crypto': cb,
  stream: sb, 'node:stream': sb,
  path: pb, 'node:path': pb,
  events: 'events', 'node:events': 'events',
  util: 'util', 'node:util': 'util',
  buffer: 'buffer', 'node:buffer': 'buffer',
  // teleproto GZIPPacked 只用 zlib.unzipSync;pako-based 薄 shim 取代 browserify-zlib
  // (+8 transitive),供應鏈更小(見 zlib-shim.cjs / README)。
  zlib: resolve(here, 'zlib-shim.cjs'), 'node:zlib': resolve(here, 'zlib-shim.cjs'),
  // functional os shim:建構時讀 os.type() 等組 device 字串。
  os: osShim, 'node:os': osShim,
  // 空存根:記憶體 StringSession,不觸檔案/原生 socket。
  fs: stub, 'node:fs': stub, net: stub, 'node:net': stub,
  tls: stub, 'node:tls': stub, socks: stub,
  'node-localstorage': stub,
};

const r = await esbuild.build({
  entryPoints: [resolve(here, 'entry.mjs')],
  bundle: true, format: 'esm', platform: 'browser', target: 'es2020',
  outfile, minify: true, metafile: true, logLevel: 'error',
  // setTimeout → __tgSetTimeout(shim-inject):還原 Node「回 Timeout 物件(有 unref)」的假設,
  // 修 teleproto Helpers.sleep 的 `setTimeout(...).unref()` 在瀏覽器炸 TypeError(見 shim-inject)。
  define: { global: 'globalThis', 'process.env.NODE_ENV': '"production"', setTimeout: '__tgSetTimeout' },
  inject: [resolve(here, 'shim-inject.mjs')],
  alias,
}).catch((e) => { console.error('BUILD FAIL:', e.message); process.exit(2); });

const bytes = Object.values(r.metafile.outputs)[0].bytes;
console.log(`BUILD OK → dist/telegram.bundle.js (${(bytes / 1024 / 1024).toFixed(2)} MB)`);
