// recipe 密碼路徑自我驗證（BASE-018 TG2a/TG2b）。ponytail: AES-IGE 是密碼路徑,換掉
// GPL 的 @cryptography/aes 後必須留 runnable check;且 teleproto 升版時此為必跑 gate
// （供應鏈信任的一環,見 SA/README「授權與維護」）。`npm run verify`。
//   1. bundle 用 crypto-browserify polyfill,必須與 Node 原生 AES 逐位元組一致。
//   2. teleproto IGE 端到端 round-trip 正確。
//   3. teleproto IGE == 獨立 textbook AES-256-IGE（多組隨機,逐位元組）——排除
//      IGE 實作被弱化/植入後門(不依賴 teleproto 自身,用獨立 oracle 對照)。
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

// 3. teleproto IGE == 獨立 textbook AES-256-IGE oracle（不依賴 teleproto,用 aes-256-ecb
//    依 MTProto IGE 定義自建）。c_i = E(p_i ⊕ c_{i-1}) ⊕ p_{i-1};c_{-1}=iv[0:16]、p_{-1}=iv[16:32]。
{
    const BS = 16;
    const ecbEnc = (key, block) => {
        const c = nodeCrypto.createCipheriv('aes-256-ecb', key, null);
        c.setAutoPadding(false);
        return Buffer.concat([c.update(block), c.final()]);
    };
    const textbookIgeEncrypt = (key, iv, data) => {
        let cPrev = iv.subarray(0, BS);
        let pPrev = iv.subarray(BS, 2 * BS);
        const out = Buffer.alloc(data.length);
        for (let i = 0; i < data.length; i += BS) {
            const p = data.subarray(i, i + BS);
            const x = Buffer.alloc(BS);
            for (let j = 0; j < BS; j++) x[j] = p[j] ^ cPrev[j];
            const e = ecbEnc(key, x);
            const c = Buffer.alloc(BS);
            for (let j = 0; j < BS; j++) c[j] = e[j] ^ pPrev[j];
            c.copy(out, i);
            cPrev = c; pPrev = Buffer.from(p);
        }
        return out;
    };
    for (let t = 0; t < 200; t++) {
        const key = nodeCrypto.randomBytes(32);
        const iv = nodeCrypto.randomBytes(32);
        const pt = nodeCrypto.randomBytes((1 + (t % 8)) * BS); // 變長 16 倍數
        const ige = new IGE(key, iv);
        const ct = Buffer.from(ige.encryptIge(pt));
        assert.ok(ct.equals(textbookIgeEncrypt(key, iv, pt)), `IGE encrypt != textbook AES-256-IGE @case ${t}`);
        assert.ok(Buffer.from(ige.decryptIge(ct)).equals(pt), `IGE decrypt round-trip 失敗 @case ${t}`);
    }
}

console.log('✅ verify OK: crypto-browserify ≡ Node (aes-256-cbc/ctr) + teleproto IGE == textbook AES-256-IGE (200 cases)');
