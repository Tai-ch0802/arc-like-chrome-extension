# BASE-027：官網 guide 翻譯截斷殘留修復（BASE-026 延伸）

> T1。PR #225（BASE-026）review 發現的殘留案；根因分析承接
> [BASE-026](../BASE-026_web-guide-i18n-truncation/SPEC.md)，本 spec 只記差異部分。

## 背景與問題

BASE-026 修復了 v1.19.0 文案盤點鎖定的 38 個 `guide_*_li*` keys（`<strong>` 截斷形態），
但同一種截斷 bug（歷史萃取在標籤中途切斷值＋`i18n.js` 以 `innerHTML` 整值取代）
還殘留在 **3 個非 `_li*` key**，14 語（含 zh_TW）全中、共 42 筆：

- `guide_start_step1`：`<a …>` 未閉合，「，點擊『加到 Chrome』。」遺失。
- `guide_start_step3`：`<kbd>Cmd/Ctrl + I` 未閉合，「開啟側邊欄。」遺失。
- `guide_kb_focus_tip`：`<kbd>↑` 未閉合，「跳至搜尋框；…回到列表首項。」整段遺失。

BASE-026 的迴歸測試只掃「`<strong>` 開了沒關」且只斷言那 38 個 keys，攔不到這批。
（Review 同時指出各語截斷姿態不一：多數丟尾段、ja/ko/ru 只丟閉合標籤、
hi 的 `<a>` 連 attribute 引號都變成單引號——重建時一併正規化。）

## 方案

- **zh_TW**：以 `guide.html` inline 原文程式化逐字重建（同 BASE-026）。
- **其餘 13 語**：保留各語既有翻譯前綴措辭，補齊缺失尾段成完整句；`<a>` 的
  href/target/rel attributes 統一與 inline 原文逐字相同（雙引號）。
- **迴歸測試擴掃**（review 建議照納）：未閉合形態掃描從只認 `<strong>` 擴大為
  `strong|kbd|a|em|code` 五種 wrapper tag 的 open/close 配對計數；必備 keys
  清單加入本次 3 個 key（38 → 41）。
- 同 PR 對 BASE-026 SPEC 做兩處勘誤（縮排筆誤、驗收條件範圍），以勘誤註記
  保留原文脈絡——merged spec 屬 ADR 歷史，僅訂正事實錯誤、不重寫。

## 影響面

- `web/locales/*.json` × 14：42 筆值替換（diff 精確 ±42 行）。
- `usecase_tests/unit_tests/webLocalesIntegrity.test.mjs`：掃描邏輯與 keys 清單擴充。
- `docs/specs/fix/BASE-026_…/SPEC.md`：兩處勘誤註記。
- 無 storage / manifest / 程式邏輯變更。

## Test Impact

- 擴充後測試於未修前 15 案紅（14 locale 形態掃描＋長度斷言）、修後 28/28 綠。
- zh_TW 三 key 與 guide.html inline 原文 whitespace 正規化後逐字一致（腳本比對）。
- 全掃描複核：五種 tag 的 open/close 配對於 14 語全部 key 歸零不平衡。
- 驗證指令：`npm run test:unit`（741 案全綠）。

## 驗收條件

- [x] 3 keys × 14 語全數為閉合完整的整句（42 筆零殘留）。
- [x] zh_TW 三 key 與 inline 原文逐字一致。
- [x] 迴歸測試擴掃五種 tag ＋ 41 keys 斷言（未修前紅、修後綠）。
- [x] 全 locale 未閉合標籤掃描歸零（不限於本次 3 keys）。
