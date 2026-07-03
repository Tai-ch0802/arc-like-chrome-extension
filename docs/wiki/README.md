# docs/wiki/ — GitHub Wiki 原始檔（wiki-as-code）

此目錄是 GitHub Wiki 的**單一事實來源**。push 到 `main` 且變更涵蓋 `docs/wiki/**` 時，
`.github/workflows/wiki-sync.yml` 會把這裡的 `.md` 同步到 repo 的 Wiki（`<repo>.wiki.git`）。

## 規則

1. **不要直接在 GitHub Wiki UI 編輯**——下一次同步會覆蓋你的修改。一律改這裡、走 PR。
2. 檔名即 Wiki 頁名：`Development-Workflow.md` → Wiki 頁 `Development Workflow`；`Home.md` 是首頁、`_Sidebar.md` 是側欄。
3. 本 `README.md` 不會被同步（sync workflow 排除）。
4. 頁面間連結用 Wiki 相對連結格式：`[Architecture](Architecture)`（不加 `.md`）。
5. 內容正確性優先：寫進 Wiki 前先跟 repo 現況核實（指令對 `package.json`/`Makefile`、路徑對實際檔案）。人類與 AI 都會把這裡當權威資料。

## 首次啟用（一次性，需要 repo 管理員）

GitHub 的 wiki git repo 要在 Wiki 至少有一頁後才存在。若同步 workflow 因 wiki repo 不存在而失敗：

1. 到 repo 的 **Settings → Features** 勾選 **Wikis**。
2. 到 **Wiki 分頁**手動建立任意內容的 Home 頁（會被首次同步覆蓋）。
3. 重跑 wiki-sync workflow（或再 push 一次 `docs/wiki/` 變更）。
