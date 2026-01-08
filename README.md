# Arc-Style Chrome Sidebar (書籤/分頁側邊欄)

這是一個 Chrome 擴充功能專案，旨在透過側邊欄介面，在 Chrome 瀏覽器中提供類似 Arc 瀏覽器的垂直分頁管理體驗，整合了分頁、群組與書籤的全功能管理面板。

![專案截圖](screenshot.png)

---

## 🔥 核心亮點 (Key Features)

### 🔗 獨家創新：Linked Tabs (分頁與書籤的完美同步)
這是我們最強大的功能！當您從側邊欄打開書籤時，我們會自動建立 **「連結 (Link)」**。
- **避免太多重複分頁**：再次點擊該書籤的 link 圖示，會顯示已透過該書籤開啟的分頁，避免無腦新增大量相同分頁造成效能上損耗。
- **雙向同步**：分頁關閉時，書籤狀態自動更新；書籤刪除時，關聯分頁智慧處理。
- **視覺回饋**：書籤旁會顯示精緻的連結圖示，讓您一眼掌握哪些書籤正在使用中。

### ⚡️ 智慧渲染 (Smart Rendering)
書籤多到爆炸？別擔心！
- **動態渲染技術**：採用高效的 Dynamic Rendering 機制，棄用傳統的 Virtual Scrolling，在保持效能的同時大幅提升相容性。
- **流暢體驗**：即使擁有大量書籤，側邊欄依然反應靈敏。

### 🪟 跨視窗管理 (Cross-Window Management)
- **總覽所有視窗**：不只是當前視窗，您可以在側邊欄下方看到所有開啟中的 Chrome 視窗與分頁。
- **跨視窗搜尋**：搜尋功能全面支援跨視窗檢索，快速切換到任何已開啟的分頁。

### 🔍 專業級搜尋 (Advanced Search)
不只是搜尋，是「瞬間找到」。
- **多關鍵字過濾**：支援空白分隔 (例如：「google docs work」)，精準定位目標。
- **Domain 搜尋**：直接輸入網域 (如 `github.com`)，快速篩選特定來源的分頁與書籤。
- **智慧高亮**：即時標示匹配關鍵字，視覺焦點一目了然。

### 🗂️ 統一工作空間 (Unified Workspace)
- **垂直分頁**：讓標題完整顯示，不再被壓縮成小圖示。
- **原生群組支援**：完美整合 Chrome 分頁群組 (Tab Groups)，顏色、名稱同步顯示。
- **自訂視窗命名**：可為每個視窗設定專屬名稱（如「工作」、「娛樂」），多視窗管理更清晰。
- **拖曳管理**：直覺的 Drag & Drop，輕鬆在分頁、群組、書籤資料夾之間移動項目。
- **拖曳即存**：將分頁拖入書籤區，立即收藏；將書籤拖入分頁區，立即開啟。

### 🎨 極致美學 (Premium Design)
- **專注模式**：深色主題搭配精心調校的對比度，減少眼睛疲勞。
- **自動展開**：拖曳時懸停於資料夾上方，自動為您展開路徑。
- **智慧懸停**：操作按鈕僅在需要時出現，保持介面乾淨清爽。

### ⌨️ 高效率快捷鍵
- **Cmd/Ctrl + I**：快速開關側邊欄
- **Opt/Alt + T**：在當前分頁旁新增分頁

---

## 🚀 安裝與開發

### 方式一：從 Chrome 線上應用程式商店安裝 (推薦)

你可以直接透過官方商店連結安裝，享受自動更新帶來的好處：

[**點此前往 Chrome 線上應用程式商店安裝**](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji?utm_source=item-share-cb)

### 方式二：從原始碼手動安裝 (開發者用)

**1. 環境準備**

在開始之前，請確保你的電腦已安裝 [Node.js](https://nodejs.org/) (內含 npm)。

**2. 安裝步驟**

1.  將本專案 Clone 或下載至本機。
    ```bash
    git clone https://github.com/Tai-ch0802/arc-like-chrome-extension.git
    ```
2.  進入專案目錄，並安裝所需的開發套件：
    ```bash
    cd arc-like-chrome-extension
    npm install
    ```
3.  開啟 Chrome 瀏覽器，前往 `chrome://extensions`。
4.  啟用右上角的「開發人員模式」。
5.  點擊「載入未封裝項目」，並選擇本專案的根目錄資料夾。

---

## 🛠️ 建置指令

本專案使用 `Makefile` 來自動化建置流程。

*   **開發模式**: `make` 或 `make package`

    此指令會建立一個未經壓縮的開發版本，所有原始碼保持原樣，方便在 Chrome 開發者工具中進行偵錯。打包後的檔案為 `arc-sidebar-v<版本號>-dev.zip`。

*   **生產模式**: `make release`

    此指令會執行生產環境的建置流程，包含以下步驟：
    1.  使用 `esbuild` 將所有 JavaScript 模組合併並壓縮成單一檔案。
    2.  壓縮 CSS 檔案。
    3.  打包成一個適合上傳到 Chrome 線上應用程式商店的 `.zip` 檔案。

---

## 🧪 測試 (Testing)

為了確保專案的品質與功能的穩定性，我們採用 use case test 的方式來驗證每次的改動。

### Use Case Tests

*   **目的**: 每個 use case test 旨在清晰地定義特定功能的預期行為和操作流程。它們以描述性文字呈現，詳細說明了測試步驟、前置條件、預期結果及驗證方法。
*   **位置**: 所有的 use case test 檔案都儲存於專案根目錄下的 `usecase_tests/` 資料夾中。
*   **執行與驗證**: 這些測試目前主要透過手動方式執行。開發者需根據測試檔案中的步驟，在實際運行的 Chrome 擴充功能中模擬使用者操作，並觀察結果是否符合預期。

### 自動化測試框架 (Automated Testing Framework)

為了未來實現自動化測試，我們選用了 **Puppeteer** 作為端對端 (End-to-End, E2E) 測試框架。

*   **Puppeteer**: 是一個 Node.js 函式庫，提供高階 API 來透過 DevTools 協定控制 Chromium 或 Chrome。它允許我們編寫腳本來模擬使用者在瀏覽器中的各種操作，例如點擊、輸入、導航等，並截圖或獲取頁面內容進行驗證。
*   **安裝**: Puppeteer 已透過 `npm install puppeteer` 安裝於專案中。
*   **未來展望**: 未來將會把 `usecase_tests/` 中的描述性測試案例逐步轉換為可執行的 Puppeteer 腳本，以實現自動化測試與持續整合。

---

## 👥 貢獻者 (Contributors)

感謝所有參與此專案的貢獻者，讓這個擴充功能變得更好：

<a href="https://github.com/Tai-ch0802/arc-like-chrome-extension/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=Tai-ch0802/arc-like-chrome-extension" />
</a>

---

本專案採用 MIT 授權。