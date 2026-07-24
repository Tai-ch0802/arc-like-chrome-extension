// teleproto 供應鏈紅旗快篩（BASE-018 TG2b-0 升版重驗 gate）。`npm run audit`。
// 這不取代人工稽核（見 SA/README 的完整信任評估）,而是 teleproto **升版時**必跑的
// 低誤報硬 gate——catch 最常見的供應鏈竄改:install 掛鉤、eval/混淆、引入 copyleft。
// 外連網域列為 informational 供人工複核（fetch/WS 目標網域誤報率高,不當硬 gate）。
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

let fail = 0;
const warn = (m) => { console.log('⚠️  ' + m); fail++; };

// A. teleproto install 掛鉤（供應鏈攻擊最常見載體）。
const tpPkg = JSON.parse(readFileSync('node_modules/teleproto/package.json', 'utf8'));
for (const k of ['preinstall', 'install', 'postinstall']) {
    if (tpPkg.scripts?.[k]) warn(`teleproto install 掛鉤 ${k}: ${tpPkg.scripts[k]}`);
}

// B. teleproto source:eval / new Function / 混淆。
const tpFiles = [];
(function walk(d) {
    for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) { if (n !== 'node_modules') walk(p); }
        else if (n.endsWith('.js')) tpFiles.push(p);
    }
})('node_modules/teleproto');
const codeRed = [{ n: 'eval/new Function', re: /\beval\s*\(|new Function\s*\(/ }, { n: '混淆(_0x…)', re: /_0x[0-9a-f]{4,}/ }];
for (const f of tpFiles) {
    const src = readFileSync(f, 'utf8');
    for (const r of codeRed) if (r.re.test(src)) warn(`${r.n}: ${f}`);
}

// C. 授權:整棵 build 依賴樹零 copyleft（升版不得引入 GPL 等）。
const flagged = [];
(function walk(d) {
    for (const n of readdirSync(d)) {
        if (n === '.bin') continue;
        const p = join(d, n);
        if (n.startsWith('@')) { walk(p); continue; }
        const pj = join(p, 'package.json');
        if (existsSync(pj)) {
            try {
                const j = JSON.parse(readFileSync(pj, 'utf8'));
                const l = typeof j.license === 'string' ? j.license : (j.license?.type || '');
                if (/GPL|AGPL|LGPL|MPL|CDDL|EPL|CC-BY-SA/i.test(l)) flagged.push(`${j.name}@${j.version} → ${l}`);
            } catch { /* skip */ }
        }
        const nn = join(p, 'node_modules');
        if (existsSync(nn)) walk(nn);
    }
})('node_modules');
if (flagged.length) warn(`copyleft 依賴:\n    ${flagged.join('\n    ')}`);

// D. informational:teleproto source 出現的外連網域（人工複核,應皆 *.telegram.org / docstring）。
const domains = new Set();
for (const f of tpFiles) {
    for (const m of readFileSync(f, 'utf8').matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) domains.add(m[1]);
}
console.log('ℹ️  teleproto source 網域（人工複核）：\n    ' + [...domains].sort().join(', '));

if (fail) { console.error(`\n❌ audit: ${fail} 個紅旗——teleproto 升版需人工複核後才放行`); process.exit(1); }
console.log(`\n✅ audit OK: teleproto ${tpFiles.length} 檔零 eval/混淆/install 掛鉤；依賴樹零 copyleft`);
