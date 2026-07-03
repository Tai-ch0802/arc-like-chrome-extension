# Development Workflow — 開發流程

## 分級 Spec-Driven Development (SDD)

本專案的核心開發制度：**spec 厚度與變更風險成比例**。動工前先分級（單一事實來源：`.agent/skills/sdd/SKILL.md`）。

| 層級 | 適用 | 產出 | Gate |
|---|---|---|---|
| **T0 直接做** | typo／文案／註解／樣式微調／依賴更新／根因明顯的單點小修 | 無 spec；commit body 交代背景 | PR review |
| **T1 輕量 SPEC**（預設） | 一般 bug fix、小～中型功能、局部重構 | 單檔 `SPEC.md`（背景/方案/影響面/Test Impact/驗收條件） | 隨 PR 一起審 |
| **T2 完整 SDD** | storage schema／manifest 權限／跨 context 協定／資料遺失風險邏輯／大型功能／大規模重構 | `PRD_spec.md` + `SA_spec.md` | PRD 核准 → SA 核准 → 才動工 |

Spec 位置：`docs/specs/{feature|fix}/{ISSUE-n|PR-n|BASE-n}_{kebab-desc}/`。

## Commit / PR 規範

| 項目 | 規範 |
|---|---|
| Commit subject | 英文，Conventional Commits（`feat(scope): ...`），50 字內、祈使句 |
| Commit body | 繁體中文，說明**為什麼**改與實作關鍵 |
| PR 標題 | 英文（squash merge 後成為 commit subject，同樣遵循 Conventional Commits） |
| PR 內文 | 繁體中文（含英文摘要區塊，模板見 `.github/pull_request_template.md`） |
| Merge 策略 | **Squash merge**；合併後特性分支即可刪除 |
| 程式碼註解 | 英文 |

⚠️ 因為採 squash merge，`git branch --merged` 永遠偵測不到已合併分支——清理分支請以 GitHub PR 的 merged 狀態為準（見 `.agent/skills/cleanup-merged-branches/`）。

## 建置與發布

```bash
make            # 開發版 zip：arc-sidebar-vX.X.X-dev.zip（原始碼直接打包）
make release    # 發布版 zip：arc-sidebar-vX.X.X.zip（esbuild bundle + minify）
make clean      # 清理產物
```

需求：`jq`（讀 manifest 版本號）；release 另需 npm devDependencies（esbuild）。

### 發布 checklist（摘要）

1. `manifest.json` 與 `package.json` 版本號已 bump。
2. **新增/改名的檔案已加入 `Makefile`**（`DEV_SRC_FILES` / `PROD_STATIC_FILES` / esbuild 指令）——漏打包是歷史事故，務必檢查。
3. 新功能文案已同步多語系（`_locales/` 14 語、README i18n、store descriptions、`web/` changelog）。
4. Release note 依 `.github/release.yml` 區塊結構（✨ 新功能 / 🚀 改善與錯誤修復），雙語。
5. `make release` 產物上傳 [Chrome 開發人員資訊主頁](https://chrome.google.com/webstore/devconsole)。

## 語言慣例

- 對話與文件：繁體中文（zh-TW）
- 程式碼識別字、註解、commit subject、PR 標題：英文
- README 多語系：根目錄 `README.md` 是 symlink → `.github/i18n/en/README.md`；各語言版在 `.github/i18n/{lang}/`
