# ISSUE-257 SPIKE — Dia 瀏覽器相容性技術驗證

- **日期**：2026-10-28
- **驗證環境**：Dia 1.54.2（macOS，`~/Applications/Dia.app`，Chromium **156.0.8078.48**）；本擴充功能 v1.20.0 以 `--load-extension` 未封裝載入
- **目的**：把「Dia 是 Chromium 所以理論上能跑」變成逐一驗證過的 API 事實，供 `PRD_spec.md` 判級與設計使用
- **方法**：另開一個**隔離 profile** 的 Dia 實例（不碰使用者正式 profile），透過 Chrome DevTools Protocol 直接在擴充功能頁面 / service worker 內呼叫 `chrome.*`，記錄回傳或例外。腳本見同目錄 `dia-api-probe.js`。

```bash
# 1. 隔離啟動（Dia 接受標準 Chromium 旗標）
open -n -a ~/Applications/Dia.app --args \
  --user-data-dir=/tmp/dia-probe-profile \
  --remote-debugging-port=9333 \
  --load-extension="$PWD" --no-first-run --no-default-browser-check

# 2. 探測（Node ≥ 22，內建 WebSocket，不需 npm install）
node docs/specs/feature/ISSUE-257_dia-compat/dia-api-probe.js http://127.0.0.1:9333 "$PWD"
```

> 注意：未封裝載入的 extension id 由路徑雜湊決定（本次為 `hdbnpoedgmjbjnjfncaeggnfipdbmhjg`），
> **與商店版 `beoonblekmppafnjppedgpgfngghebji` 不同**；OAuth 相關驗證必須用商店版 id（見 §3）。

---

## 1. Dia 是什麼（2026-10 現況）

| 面向 | 事實 | 來源 |
|---|---|---|
| 出身 | The Browser Company（Arc 的開發商）2025 推出的 AI-first 瀏覽器；2025-10 被 Atlassian 以 6.1 億美元收購，維持獨立產品線 | TechCrunch、Reworked |
| Arc 的下場 | **Arc 於 2026-12-22 停止服務**，官方導流至 Dia；Arc 的 Spaces → Dia **Profiles**、Folders → Dia **Tab Groups**、Pinned Tabs / Favorites 名稱沿用 | TechCrunch 2026-10-22、arc.net |
| 核心 | Chromium 分支（本次驗證為 M156）；Manifest V3 擴充功能正常安裝；**MV2 已於 1.17.0（2026-02）停用** | Dia changelog |
| 擴充功能 side panel | **1.10.1（2025-12-18）起支援 Chromium Side Panel API**：「Extensions that use the Chromium Side Panel can now render their side-panel UI directly in Dia」 | Dia changelog |
| 工作區概念 | **Profiles**（≈ Arc Spaces）：各 profile 有**獨立 cookie、獨立擴充功能安裝與 storage**；可 Ctrl+1–9 / 滑動切換；1.43.1 起可選擇跨 profile 共享資料 | Dia changelog 1.22 / 1.43.1 |
| 分頁群組 | Dia 自有的 **Tab Groups**（可釘選、自動命名、自動 emoji、Live Tab Groups）；匯入 Chrome tab groups 時**轉成書籤**而非群組 | Dia changelog 1.16–1.31 |
| 其他 UI | 垂直分頁 / sidebar（Arc 式）、Pinned tabs、Favorites、Split View、Chat with tabs、Skills、Memory | 多篇評測 |
| 內建同步 | **Dia Sync**（Dia 帳號）：profiles、bookmarks、favorites、tabs、preferences、**擴充功能的安裝 / 釘選 / 啟用狀態**跨裝置同步；1.3.0（Windows）起 Mac ↔ Windows 互通。**不包含擴充功能的 storage 資料**（本次實測 `chrome.storage.sync` 僅本機生效，見 §2） | Dia changelog 1.26–1.29、Windows 1.3.0 |
| 閱讀清單 | **沒有** UI 功能；但 Chromium 底層 reading list model 仍在（§2） | 搜尋無任何結果；二進位 `strings` 有 `ReadingListModel` |
| RSS | 沒有 | — |
| Google 帳號 | Dia 用 Atlassian / Dia 帳號登入，**沒有 Chrome 的 Google 帳號整合**，因此 `chrome.identity.getAuthToken` 無帳號可用（§2） | 實測 |

## 2. `chrome.*` API 實測矩陣（Dia 1.54.2）

| API | 結果 | 對本專案的影響 |
|---|---|---|
| `sidePanel.getOptions / getPanelBehavior / setPanelBehavior` | ✅ 正常；`openPanelOnActionClick: true` 生效 | side panel 進入點可用 |
| `sidePanel.open({windowId})`（user gesture） | ✅ 回傳成功，並出現第二個 `sidepanel.html` target；頁面內 DOM 正常渲染（2 個 tab item、各區塊文字） | ⚠️ 隔離 profile 停在 Atlassian 登入畫面，`innerWidth/Height = 0` 且截圖逾時——**無法目視確認**實際面板外觀，需在正式 profile 驗證 |
| `readingList.query / addEntry / removeEntry / onEntryAdded` | ✅ 完整可用（新增→查詢→刪除 round-trip 成功） | 閱讀清單資料可留在 `chrome.readingList`；Dia 沒有 UI，本擴充功能的側欄就是唯一入口 |
| `tabGroups.query / get / update` | ✅ 可呼叫（回傳空陣列） | — |
| **`tabs.group(...)`** | ❌ **一律丟 `Error: No window`**：同視窗、`createProperties.windowId` 明確指定、`windows.create` 新視窗內三種情境皆失敗 | **Smart Group / AI 分群、閱讀清單「From Reading List」群組、路由規則入群組、工作區還原群組、拖曳入群組全部會丟例外**（見 §4） |
| `tabs.create / remove / move / update({pinned})` | ✅ | — |
| `windows.getAll / getCurrent / create / remove` | ✅（`windows.create` 可建新視窗並帶多個 URL） | 工作區還原（`windows.create`）可用 |
| `scripting.executeScript`（https 頁面） | ✅ 取得 `document.title` | 內容擷取 / hover summarize / page reader 可用 |
| `offscreen.createDocument / hasDocument / closeDocument` | ✅ | — |
| `alarms.create / get / clear` | ✅（SW 內已看到 `lifecycleHeartbeat`、`driveSyncPull`） | RSS / 同步排程可用 |
| `storage.local / session` | ✅ | — |
| `storage.sync` | ✅ 讀寫 round-trip 成功，`QUOTA_BYTES = 102400`（在未登入的隔離 profile 內測） | ⚠️ Dia 沒有 Google 同步後端，所以**不可能跨到 Chrome**；Dia Sync 是否在 Dia 裝置之間同步擴充功能 storage **未實測**（changelog 只提到擴充功能的安裝 / 釘選 / 啟用狀態會同步） |
| `commands.getAll` | ✅ ⌘I / ⌥T / ⇧⌘K 都有註冊 | ⚠️ 是否被 Dia 自身快捷鍵攔截未測（需正式 profile 手動驗證） |
| `bookmarks.getTree` | ✅（Bookmarks Bar / Other Bookmarks） | 書籤區可用；**書籤 id 與 Chrome 不同** → bookmark tags 無法跨瀏覽器對應 |
| `identity.getRedirectURL()` | ✅ `https://<ext-id>.chromiumapp.org/` | `launchWebAuthFlow` 可用的前提 |
| `identity.launchWebAuthFlow` | ✅ **機制可用**（§2.1：redirect 捕捉正確、互動式會開出 Google 彈窗）；真人登入與 token 取得未測（需帳號） | 非 Chrome 瀏覽器的 OAuth 可行路徑 |
| **`identity.getAuthToken`** | ❌ 非互動式：`OAuth2 not granted or revoked.`；**互動式：Dia 開出 accounts.google.com 錯誤頁（`invalid_request`，Google 拒絕 Dia 代送的 redirect），約 31 秒後回 `The user did not approve access`**；`getProfileUserInfo` 回 `{email:'', id:''}`（無瀏覽器層級 Google 帳號） | 現行 `driveAuth.js` 只走 `getAuthToken` → **Drive 同步在 Dia 無法連線（已確認）** |
| `LanguageModel.availability()` / `Summarizer.availability()` | `downloadable`（API 存在，模型未下載） | 內建 AI 在 Dia 能否真的下載 Gemini Nano 未驗證；雲端 provider（BASE-029）是可靠退路 |
| `navigator.userAgentData.brands` | `[Not:A-Brand 8, Chromium 156]`——**沒有 `Google Chrome` 品牌** | 可用來做「非 Chrome」偵測；UA 字串則與 Chrome 無異（不可依賴） |

### 2.1 OAuth 機制測試（不需帳號；`dia-api-probe.js` 的 `oauth*` 步驟）

| 步驟 | 結果 | 意義 |
|---|---|---|
| `launchWebAuthFlow({url: getRedirectURL() + '#access_token=probe', interactive: false})` | ✅ 立即回傳該 URL | Dia 實作了 `chromiumapp.org` redirect 捕捉（implicit flow 的 token 可從 fragment 取回） |
| 同上 `interactive: true` | ✅ 立即回傳 | 互動模式下捕捉同樣可用 |
| Google auth URL + `prompt=none`，`interactive: false` | ❌ 快速失敗 `User interaction required…` | 非互動續期在「需要互動」時會**立刻**失敗而不是卡 20 秒 → `needs-auth` 狀態機可行 |
| Google auth URL，`interactive: true`（未登入、未註冊 redirect） | ✅ **開出獨立彈窗** `accounts.google.com/signin/oauth/error?authError=…`（解碼 = `redirect_uri_mismatch`，因未封裝 id 未註冊，屬預期）；關閉後回 `The user did not approve access.` | **互動式 Web OAuth 彈窗在 Dia 可用**。剩下的只是 GCP 設定（Web application client + 商店 id 的 redirect URI）與真人登入 |
| `getAuthToken({interactive: true})` | ❌ 開出 Google 錯誤頁（`invalid_request`），31 秒後 `The user did not approve access.` | `getAuthToken` 在 Dia 不可用（確認） |

## 3. 使用者正式 Dia profile 的狀態（唯讀檢視）

- `~/Library/Application Support/Dia/User Data/` 下有 4 個 profile：`Default`（Work）、`Profile 3`（personal）、`Profile 6`（personal）、`Profile 7`（工作）。
- 商店版本擴充功能（`beoonblekmppafnjppedgpgfngghebji` v1.20.0，`from_webstore: true`）安裝在 Profile 3 / 6 / 7，三處都是 `disable_reasons: [1]`（= `DISABLE_USER_ACTION`，使用者手動停用）。
- 推論：每個 Dia profile 都是**獨立的擴充功能安裝**，在 Drive 同步模型裡會各自拿到一個 `driveDeviceId`，等同一台「裝置」。

## 4. 「無法順利支援」的最可能根因（依證據排序）

1. **分頁群組操作丟例外**：`readingListManager.openReadingListItem()` 先 `addTabToReadingListGroup()`（→ `tabs.group` → `No window`）才 `updateReadingListEntry()`，所以在 Dia 點閱讀清單項目會開分頁但**永遠不會標記已讀**，且 console 噴錯；`workspaceManager` 還原（`addTabToNewGroup` @ L652）、`routingEngine`、`aiGrouperUI`、`dragDropManager` 同型。
2. **Drive 同步無法連線**：options「連結 Google 雲端硬碟」→ `getAuthToken({interactive:true})` 在 Dia 會開出 Google 錯誤頁、31 秒後失敗（§2.1 實測）；現行文案「需要可登入的 Google Chrome」等於宣告放棄。
3. **設定與工作區 metadata 不跨瀏覽器**：`storage.sync` 在 Dia 只是本機儲存。工作區因為 Drive 檔案本身帶 `metadata`（`applyRemoteWorkspace` 會重建 `wsMeta_`）所以**一旦 Drive 連上就能同步**；但主題、語言、各區塊顯示開關、自訂主題等純設定沒有任何跨瀏覽器管道。
4. **閱讀清單是瀏覽器本地資料**：Chrome 靠 Google 帳號原生同步，Dia 什麼都不同步；兩邊各自為政。

## 5. 未驗證、需由使用者在正式 profile 完成的項目

- `launchWebAuthFlow` 以真人 Google 帳號完成登入並取得 token（自動化不可代輸入憑證；機制本身已於 §2.1 驗證）。
- 既有 Chrome Extension 類型 OAuth client 對**商店版 id** 的 `chromiumapp.org` redirect 是否接受（對未封裝 id 回 `redirect_uri_mismatch`）；保險作法是新增 Web application client。
- Drive `appDataFolder` 在同專案兩個 client id 之間是否共享（官方文件只說「per app」）。
- Dia Sync 是否在 Dia 裝置之間同步擴充功能的 `storage.sync` 資料。
- Side panel 實際外觀 / 寬度行為、⌘I 是否被 Dia 攔截。
- 內建 AI 模型是否可在 Dia 下載。

## 6. 參考來源

- Dia changelog：<https://www.diabrowser.com/changelog>（1.10.1 side panel、1.17.0 MV2、1.26–1.29 Sync、Windows 1.3.0）
- Arc 停服與 Dia 對應關係：<https://techcrunch.com/2026/10/22/arc-browser-sunsets-december-22-as-the-browser-company-doubles-down-on-dia/>、<https://arc.net/>
- Atlassian 收購：<https://www.reworked.co/collaboration-productivity/atlassian-buys-the-browser-company-to-build-an-ai-powered-enterprise-browser/>
- Chromium 分支下 `getAuthToken` 失效與 `launchWebAuthFlow` 替代：<https://github.com/CYoJkoY/ChromiumCloudSync/issues/36>、<https://github.com/CYoJkoY/ChromiumCloudSync/issues/43>
- Chrome Side Panel API：<https://developer.chrome.com/docs/extensions/reference/api/sidePanel>
