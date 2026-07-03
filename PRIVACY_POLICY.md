# 隱私權政策 (Privacy Policy) for Arc 風格側邊欄

**生效日期：2026年2月10日**（最近更新：2026年7月3日 — 新增選用的「使用者自行設定的 AI 供應商」揭露）

感謝您使用「Arc 風格側邊欄」Chrome 擴充功能（以下簡稱「本擴充功能」）。我們致力於保護您的個人隱私。本隱私權政策旨在說明我們如何處理您的資訊。

### 1. 我們存取的資訊

本擴充功能為了實現其核心功能，需要向 Chrome 瀏覽器請求特定資料的讀取權限。我們存取的資訊類型如下：

* **分頁與分頁群組資訊 (Tabs and Tab Groups)**：包括您開啟的分頁網址、標題，以及分頁群組的標題與顏色。
* **書籤資訊 (Bookmarks)**：包括您所有書籤的網址、標題與資料夾結構。
* **閱讀清單資訊 (Reading List)**：包括您 Chrome 閱讀清單中項目的網址、標題與已讀狀態。
* **操作狀態資訊 (Operational Data)**：包括「Linked Tabs」的關聯狀態、UI 展開狀態、RSS 訂閱設定與已抓取文章的雜湊值。

### 2. 資料儲存與同步 (Data Storage and Sync)

我們採用最小化資料收集原則，並根據資料類型採用不同的儲存方式：

* **本機資料 (Local Data)**：您的**分頁**、**書籤**、**Linked Tabs 關聯狀態**以及 **RSS 已抓取文章的雜湊值**等核心操作資料，僅儲存於您裝置的 `chrome.storage.local` 中。除了下方「2.1 工作區 Google Drive 同步」明確說明的選用功能外，我們**不會**將這些資料上傳至任何**開發者或第三方伺服器**。
* **設定同步 (Settings Sync)**：為了提供跨裝置的一致體驗，您的**擴充功能偏好設定**（例如：主題選擇、RSS 訂閱清單）會儲存於 `chrome.storage.sync`。這將透過您的 Google 帳號在您登入的 Chrome 瀏覽器間進行同步。

#### 2.1 工作區 Google Drive 同步（選用，預設關閉）

為了讓您能在多台裝置間同步與還原「工作區 (Workspace)」中的分頁，本擴充功能提供一項**選用 (opt-in)** 的 Google Drive 同步功能。此功能的隱私設計如下：

* **預設關閉、逐工作區授權**：此功能**預設為關閉**。除非您主動連結 Google Drive **並且**針對**特定工作區**開啟同步，否則**不會**有任何資料被上傳。未開啟同步的工作區，其行為與過去完全相同（僅存於本機）。
* **上傳的內容**：對於您**主動開啟同步的工作區**，我們會上傳該工作區的分頁快照，內容包含：分頁的**網址 (URL)**、**標題 (title)**、**釘選狀態 (pinned state)**，以及**分頁群組的名稱與顏色 (tab-group name/color)**。這是本擴充功能首次將完整的分頁網址與標題傳出您的裝置，因此我們在此明確揭露。
* **儲存位置**：上述資料只會寫入**您自己的 Google Drive**，存放於應用程式專屬的隱藏資料夾 `appDataFolder`（透過 `drive.appdata` OAuth 範圍存取）。此資料夾為應用程式私有：**只有本擴充功能能存取**、在您的 Drive 一般檔案清單中不可見，並且在您**解除安裝本擴充功能時會由 Google 自動刪除**。這些資料**絕不會**傳送至開發者的伺服器或任何第三方伺服器。
* **授權方式**：我們透過 Chrome 內建的 `chrome.identity` API 取得存取您 Drive `appDataFolder` 的授權；**不會儲存任何長期憑證**。您隨時可在設定中點擊「中斷連結 Google Drive」，這會立即停止所有上傳並清除本機快取的存取權杖。
* **停止上傳與刪除您的資料**：關閉特定工作區的同步只會**停止後續的上傳**，並不會自動刪除該工作區已上傳至雲端的資料。若要移除已上傳的雲端資料，您可以：**中斷連結 Google Drive**、**刪除該工作區**（系統會在您的 Drive 寫入刪除標記，使其在各裝置上一併移除）、透過 Google Drive 的「管理應用程式 (Manage apps)」移除本應用程式的資料，或**解除安裝本擴充功能**（Google 會自動刪除 `appDataFolder` 中的所有資料）。

> **Google API 服務使用者資料政策 (Limited Use)**
>
> The use of information received from Google APIs will adhere to the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/limited-use/), including the Limited Use requirements.

### 3. 我們傳輸的資訊

一般情況下，本擴充功能不會將您的個人資訊對外傳輸。以下為涉及外部網路請求的功能：

* **書籤圖示 (Bookmark Favicons)**：為了顯示您書籤列表中的網站圖示 (Favicon)，本擴充功能會將書籤的「**網域**」(例如 `google.com`) 傳送至 Google 的公開 Favicon 服務 (`https://www.google.com/s2/favicons`) 以獲取對應的圖示。請注意，我們**僅傳輸網域名稱**，絕不會傳輸包含個人路徑或參數的完整網址。
* **RSS 訂閱抓取 (RSS Feed Fetching)**：若您啟用 RSS 訂閱功能，本擴充功能會定期向您所訂閱的 RSS feed URL 發送 HTTP 請求以取得最新文章。這些請求**僅限於您主動訂閱的網址**，且抓取的內容僅用於加入您的 Chrome 閱讀清單，不會傳送至任何第三方伺服器。

#### 3.1 使用者自行設定的 AI 供應商（選用，預設關閉）

本擴充功能的 AI 功能（智慧分組、AI 清理建議、群組自動命名、頁面摘要、網頁導讀、AI 搜尋）**預設完全使用 Chrome 內建的本機模型（Gemini Nano）執行，不會有任何資料離開您的裝置**。

若您在設定頁**主動**選擇改用外部 AI 供應商（Google Gemini API、Anthropic Claude API、OpenAI 相容端點，或本機執行的 Ollama），其隱私設計如下：

* **傳輸的內容**：上述 AI 功能運作所需的內容——包含**分頁標題與網址**，以及您觸發摘要／導讀時的**頁面文字內容**——會直接從您的瀏覽器傳送至**您所選定的該一供應商**，受該供應商的隱私政策約束。資料**不會**經過開發者或其他任何第三方伺服器。
* **API 金鑰**：您輸入的 API 金鑰**僅儲存於本機的 `chrome.storage.local`**，不會同步至其他裝置，也只會用於向您設定的供應商發送請求。
* **Ollama（本機）**：選擇 Ollama 時，請求僅送往您自行指定的本機／區網位址，資料不會傳送至網際網路上的第三方。
* **隨時可停用**：您可以隨時在設定頁切回內建模型；切回後即不再有任何 AI 相關的對外傳輸。

### 4. 權限說明 (Permissions)

本擴充功能使用以下 Chrome 權限，每項權限的用途說明如下：

| 權限 | 用途 |
|------|------|
| `tabs` | 讀取分頁資訊以在側邊欄中顯示和管理分頁 |
| `tabGroups` | 讀取與管理分頁群組的標題和顏色 |
| `bookmarks` | 讀取與管理書籤列表 |
| `sidePanel` | 啟用側邊欄面板功能 |
| `storage` | 儲存擴充功能的設定與操作狀態 |
| `readingList` | 管理 Chrome 閱讀清單（新增/移除/標記已讀） |
| `alarms` | 排程 RSS 訂閱的定時抓取任務 |
| `offscreen` | 在背景處理 RSS feed 的 XML 解析 |
| `identity` | 用於選用的「工作區 Google Drive 同步」功能：透過 Chrome 內建身分驗證取得存取您自己 Google Drive `appDataFolder` 的授權（`drive.appdata` 範圍）。僅在您主動連結 Google Drive 時使用 |
| `host_permissions (*://*/*)` | 用於抓取 RSS feed 內容、顯示書籤圖示，以及（僅在您主動設定外部 AI 供應商時）向您指定的 AI 服務端點發送請求 |

### 5. 資訊的使用

我們存取的所有資訊，其用途**僅限於**：
* 在側邊欄中渲染、呈現您的分頁與書籤列表。
* 讓您能夠透過側邊欄進行搜尋、排序、分組、關閉分頁與刪除書籤等管理操作。
* 管理您的 Chrome 閱讀清單與 RSS 訂閱內容。

您的資料絕不會被用於任何廣告、追蹤或分析等其他目的。

### 6. 開源與透明度

本擴充功能為 100% 開源軟體，採用 MIT 授權條款。我們相信完全的透明化，歡迎任何人檢視我們的原始程式碼，以驗證本隱私權政策的承諾。您可以在此處找到原始程式碼：
[https://github.com/Tai-ch0802/arc-like-chrome-extension](https://github.com/Tai-ch0802/arc-like-chrome-extension)

### 7. 政策變更

我們可能會不時更新本隱私權政策。任何變更都將發布在此頁面上。

### 8. 聯絡我們

如果您對本隱私權政策有任何疑問，歡迎透過以下方式與我聯絡：

* **開發者**：Tai-ch0802
* **聯絡方式**：tai@taislife.work
