// recipe 密碼路徑自我驗證（BASE-018 TG2a）。ponytail: AES-IGE 是密碼路徑,換掉
// GPL 的 @cryptography/aes 後必須留一個 runnable check。`npm run verify`。
//   1. bundle 用 crypto-browserify polyfill,必須與 Node 原生 AES 逐位元組一致
//      （teleproto IGE 底層 = aes-256-cbc；此等價成立則 bundle 環境 AES 正確）。
//   2. teleproto IGE 端到端 round-trip 正確（IGE = AES-CBC + XOR 邏輯自洽）。
import assert from 'node:assert/strict';
import nodeCrypto from 'node:crypto';
import browserCrypto from 'crypto-browserify';
import { IGE } from 'teleproto/crypto/IGE.js';

const enc = (lib, algo, key, iv, pt) => {
    const c = lib.createCipheriv(algo, key, iv);
    return Buffer.concat([c.update(pt), c.final()]);
};
const dec = (lib, algo, key, iv, ct) => {
    const d = lib.createDecipheriv(algo, key, iv);
    return Buffer.concat([d.update(ct), d.final()]);
};

// 1. polyfill 等價:crypto-browserify(bundle 用) vs Node 原生。
{
    const key = Buffer.alloc(32, 7);
    const iv = Buffer.alloc(16, 3);
    const pt = Buffer.from('teleproto IGE relies on the block cipher — verify it!'.padEnd(64).slice(0, 64));
    for (const algo of ['aes-256-cbc', 'aes-256-ctr']) {
        const nEnc = enc(nodeCrypto, algo, key, iv, pt);
        const bEnc = enc(browserCrypto, algo, key, iv, pt);
        assert.ok(bEnc.equals(nEnc), `${algo}: crypto-browserify 與 Node 輸出不一致`);
        assert.ok(dec(browserCrypto, algo, key, iv, nEnc).equals(pt), `${algo}: cross round-trip 失敗`);
    }
}

// 2. teleproto IGE 端到端 round-trip（16 倍數明文,不觸發隨機 pad）。
{
    const key = Buffer.alloc(32, 9);
    const iv = Buffer.alloc(32, 5);
    const pt = Buffer.alloc(48, 0x41);
    const ige = new IGE(key, iv);
    const ct = Buffer.from(ige.encryptIge(pt));
    assert.ok(!ct.equals(pt), 'IGE 密文竟等於明文（未加密）');
    assert.ok(Buffer.from(ige.decryptIge(ct)).equals(pt), 'teleproto IGE round-trip 失敗');
}

console.log('✅ verify OK: crypto-browserify ≡ Node (aes-256-cbc/ctr) + teleproto IGE round-trip');
