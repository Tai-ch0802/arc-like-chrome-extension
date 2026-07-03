---
name: debugging
description: 本專案 (MV3 Chrome extension) 的除錯紀律與 playbook：先重現再修、證據優先於模式匹配、單變因修改、跨 context 時序問題、service worker 終止、storage 問題、flaky E2E 分流。當使用者提到「除錯、debug、壞掉、不會動、修不好、查原因、root cause、flaky、時好時壞」時觸發。
---

# Debugging Skill — 根因紀律

修 bug 的品質差異不在「會不會寫 code」，而在**下修改之前的判斷**。本 skill 把判斷步驟固定下來，任何模型照走都能避開最常見的失敗模式。

## 鐵律（依序，不可跳步）

1. **先重現，再動手**。重現不了的 bug 不要修——先做出穩定重現步驟（或至少寫出觸發條件假說並驗證）。E2E flaky 至少連跑 3 次確認是否穩定失敗。
2. **證據優先於模式匹配**。「這看起來像上次那個 XX 問題」只是假說，不是結論。症狀相似的 bug 常有不同根因；動手前先找到**直接證據**（log、storage dump、DOM 狀態、git bisect 結果）。
3. **一次只改一個變因**。同時改兩處後好了，你不知道是哪個修好的——也不知道另一個是否埋了新雷。
4. **能說出根因才算修好**。修完必須能用一句話回答「為什麼之前會壞、為什麼這樣改就好」。說不出來 = 只是碰巧蓋掉症狀，遲早復發。commit body（繁中）要寫這句根因。
5. **修 bug 時不順手重構**。重構放另一個 commit / PR，否則 diff 混雜、review 失效、出事難回溯。

## 定位手法（由便宜到昂貴）

1. **讀錯誤原文**：完整 stack trace / `chrome://extensions` 的「錯誤」按鈕 / CI 的完整 log，不要只讀最後一行。
2. **縮小範圍**：`git log --oneline -- <file>` 看最近誰動過；行為是「本來好的」就用 `git bisect`（`npm run test:ci` 或單一測試檔當判準）。
3. **加觀測點**：在懷疑路徑上加暫時性 `console.log`（帶 context 前綴，如 `[SW]` / `[panel]`），修完**必須移除**。
4. **二分刪除法**：大範圍不明時，註解掉一半功能看症狀是否消失，逐步逼近。

## 本專案高頻根因清單（先對照這張表再開始猜）

| 症狀 | 高機率根因 | 驗證方式 |
|---|---|---|
| 功能第一次好、閒置後壞 | MV3 **service worker 被終止**，in-memory 狀態消失 | SW console 看是否重啟；狀態是否該落 `chrome.storage` |
| options 頁改設定、sidepanel 沒反應 | `settingsBridge` 未映射該 storage key | 檢查 `modules/ui/settingsBridge.js` 的 `resolveSettingChangeActions` |
| Spotlight 動作沒在正確視窗執行 | `panelBridge` 旗標定址/TTL 守門擋掉 | 看 `classifyPendingAction` 判定與 `windowId` |
| 兩個 context 互相覆寫資料 | storage 全表寫入蓋掉別人的 delta（見 workspace `mutateWindowMap` 教訓） | 找出所有寫同一 key 的 context，確認是否 read→merge→write |
| `chrome.storage.sync` 寫入無效 | 超過 8KB/key 或總量 quota | `setStorageStrict`（apiManager）回報 lastError |
| E2E 本機過、CI 掛 | race condition：固定 `setTimeout` 等待、事件委派未就緒 | 對照 `review-pr.md` CI 穩定性方針 8 條逐項檢查 |
| UI 事件沒觸發 | 事件委派容器還沒渲染就 dispatch / listener 延遲註冊 | 先 `waitForSelector` 容器再操作 |
| release 版壞、dev 版好 | 檔案沒進 `Makefile` 打包清單，或 esbuild bundle 差異 | 解開 zip 比對；`make release` 後檢查產物 |

## 觀測工具

```bash
# E2E 單檔快速迭代（最便宜的重現環境）
npx jest usecase_tests/puppeteer_tests/<file>.test.js
```

- **SW log**：`chrome://extensions` → 該擴充功能 → 「服務工作處理程序」inspect。
- **Storage dump**（在 SW console 或測試的 `worker.evaluate`）：
  `chrome.storage.local.get(null, console.log)`、`chrome.storage.sync.get(null, console.log)`。
- **Puppeteer 內截圖 / page console**：見 `.agent/workflows/puppeteer-test.md` §4。

## 收尾

- 根因寫進 commit body；若是值得後人警惕的類型，補進上方「高頻根因清單」（本檔就是 living document）。
- 修復必附驗證：對應 bug 的 regression 測試（unit 優先，其次 E2E），或說明為何無法自動化。
- 依 `sdd` skill 判級：根因明顯的單點小修 = T0；需要調查、影響多模組 = T1（SPEC.md 寫根因分析）。
