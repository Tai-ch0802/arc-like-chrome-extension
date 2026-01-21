# Arc 風格 Chrome 側邊欄

[English](/.github/i18n/en/README.md) | [繁體中文](/.github/i18n/zh_TW/README.md) | [简体中文](/.github/i18n/zh_CN/README.md) | [日本語](/.github/i18n/ja/README.md) | [한국어](/.github/i18n/ko/README.md) | [Deutsch](/.github/i18n/de/README.md) | [Español](/.github/i18n/es/README.md) | [Français](/.github/i18n/fr/README.md) | [हिन्दी](/.github/i18n/hi/README.md) | [Bahasa Indonesia](/.github/i18n/id/README.md) | [Português (Brasil)](/.github/i18n/pt_BR/README.md) | [Русский](/.github/i18n/ru/README.md) | [ไทย](/.github/i18n/th/README.md) | [Tiếng Việt](/.github/i18n/vi/README.md)

---

[![Version](https://img.shields.io/chrome-web-store/v/beoonblekmppafnjppedgpgfngghebji?style=flat-square&logo=google-chrome&logoColor=white)](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji)
[![Rating](https://img.shields.io/chrome-web-store/rating/beoonblekmppafnjppedgpgfngghebji?style=flat-square)](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji)
[![Users](https://img.shields.io/chrome-web-store/users/beoonblekmppafnjppedgpgfngghebji?style=flat-square)](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji)
[![Build Status](https://github.com/Tai-ch0802/arc-like-chrome-extension/actions/workflows/ci.yml/badge.svg)](https://github.com/Tai-ch0802/arc-like-chrome-extension/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/Tai-ch0802/arc-like-chrome-extension?style=flat-square)](../../LICENSE)

這是一個 Chrome 擴充功能專案，旨在為 Google Chrome 帶來類似 Arc 瀏覽器的垂直側邊欄體驗，提供一個統一且強大的面板來管理分頁和書籤。

## 🚀 新版本 v1.11.0 更新！
[![示範影片](http://img.youtube.com/vi/Ld4lyaZatWo/0.jpg)](https://www.youtube.com/watch?v=Ld4lyaZatWo)

### ⚡️ 特色功能
- **垂直分頁**：查看完整頁面標題，不再被壓縮成微小的圖標。
- **分頁群組**：與 Chrome 分頁群組完美整合，同步顏色與名稱。
- **書籤整合**：統一的面板，同時管理分頁與書籤。
- **關聯分頁**：在開啟書籤時自動建立「連結」，避免重複開啟。
- **跨視窗搜尋**：在所有開啟的視窗中搜尋分頁與書籤。
- **動態渲染**：針對龐大的書籤庫提供高效的渲染效能。

## 🤝 參與貢獻

我們歡迎社群的參與！無論是修復 Bug、改進文件，還是提出新功能建議，您的幫助都彌足珍貴。

我們採用 **規格驅動開發 (SDD)** 流程且對 **AI 極為友善**。請查看我們的貢獻指南以開始：

👉 **[閱讀我們的貢獻指南](./CONTRIBUTING.md)**

---

## 🔥 關鍵功能

### 🔗 獨家創新：關聯分頁 (Linked Tabs)
這是我們最強大的功能！當您從側邊欄開啟書籤時，我們會自動建立一個 **「連結」**。
- **避免分頁混亂**：點擊書籤旁的連結圖標，即可查看所有從該書籤開啟的分頁，幫助您避免重複開啟並節省系統資源。
- **雙向同步**：當分頁關閉時，書籤狀態會自動更新；當書籤被刪除時，關聯分頁也會得到智慧處理。
- **視覺回饋**：書籤旁會出現精緻的連結圖標，讓您一眼看出哪些書籤目前正處於開啟狀態。

### ⚡️ 智慧渲染
擁有數千個書籤？沒問題！
- **動態渲染**：從虛擬滾動 (Virtual Scrolling) 切換到高效的動態渲染機制，確保流暢效能與更好的相容性。
- **流暢體驗**：在龐大的書籤庫中輕鬆導覽，毫無延遲。

### 🪟 跨視窗管理
- **視窗概覽**：直接在側邊欄查看所有開啟的 Chrome 視窗中的分頁，不限於當前視窗。
- **全域搜尋**：搜尋結果包含所有視窗的分頁，讓您在整個作業階段中即時導覽。

### 🔍 專業級搜尋
不僅是搜尋，而是瞬間找到。
- **多關鍵字過濾**：支援空格分隔的關鍵字（例如「google docs 工作」）進行精確定位。
- **網域搜尋**：輸入網域（如 `github.com`）即可立即過濾來自特定來源的分頁與書籤。
- **智慧高亮**：即時高亮匹配的關鍵字，保持視覺焦點清晰。

### 🗂️ 統一工作區
- **垂直分頁**：查看完整頁面標題，不再被壓縮。
- **原生群組支援**：與 Chrome 分頁群組完美整合。
- **自訂視窗命名**：為您的視窗指定自訂名稱（例如「工作」、「個人」），讓情境更清晰。
- **拖放操作**：直覺的管理方式——在分頁、群組與書籤資料夾之間輕鬆移動項目。
- **拖曳儲存**：將分頁拖入書籤區域即可立即儲存；將書籤拖入分頁區域即可開啟。

### 🎨 優質設計
- **專注模式**：精緻的深色主題，經過仔細調整的對比度，減輕眼部負擔。
- **自動展開**：在拖曳項目時懸停於資料夾上，會自動展開路徑。
- **智慧懸停**：功能按鈕僅在需要時出現，保持介面簡潔且無干擾。

## ⌨️ 完整鍵盤導覽
- **原生體驗**：使用 `向上`/`向下` 鍵在分頁與書籤之間流暢切換。
- **微互動**：使用 `向左`/`向右` 鍵進行巡覽並觸發內部按鈕（如關閉、加入群組）。
- **搜尋整合**：在列表頂部按 `上` 即可聚焦搜尋框；在搜尋框按 `下` 即可跳轉至結果。
- **聚焦秘訣**：側邊欄開啟後，只需按下任何方向鍵即可自動取得焦點並開始導覽。

### ⌨️ 生產力快捷鍵
- **Cmd/Ctrl + I**：切換側邊欄
- **Opt/Alt + T**：在當前分頁旁建立新分頁

---

## 🆚 為什麼選擇這個擴充功能？

| 功能 | 本擴充功能 | 原生 Chrome | 傳統側邊欄 |
| :--- | :---: | :---: | :---: |
| **垂直分頁** | ✅ 完整標題 | ❌ 壓縮 | ✅ |
| **分頁群組** | ✅ 原生同步 | ✅ | ⚠️ 部分 |
| **書籤整合** | ✅ 統一面板 | ❌ 獨立管理員 | ❌ 獨立 |
| **關聯分頁** | ✅ 同步狀態 | ❌ | ❌ |
| **跨視窗搜尋** | ✅ | ❌ | ⚠️ 因人而異 |
| **效能** | ⚡️ 動態渲染 | N/A | 🐢 虛擬滾動 |

---

## 🚀 安裝與開發

### 選項 1：從 Chrome 線上應用程式商店安裝（推薦）

您可以直接從官方商店安裝擴充功能以接收自動更新：

[**點擊此處從 Chrome 線上應用程式商店安裝**](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji?utm_source=item-share-cb)

### 選項 2：從原始碼手動安裝（供開發者使用）

**1. 前置需求**

在開始之前，請確保您的系統中已安裝 [Node.js](https://nodejs.org/)（包含 npm）。

**2. 設定步驟**

1.  將本專案複製或下載到您的本地電腦。
    ```bash
    git clone https://github.com/Tai-ch0802/arc-like-chrome-extension.git
    ```
2.  導覽至專案目錄並安裝必要的開發相依項目：
    ```bash
    cd arc-like-chrome-extension
    npm install
    ```
3.  開啟 Chrome 瀏覽器並導覽至 `chrome://extensions`。
4.  開啟右上角的「開發人員模式」。
5.  點擊「載入未封裝項目」並選擇專案的根目錄。

---

## 🛠️ 建置指令

本專案使用 `Makefile` 來自動化建置流程。

*   **開發模式**：`make` 或 `make package`

    此指令會建立一個未壓縮的開發版本。所有原始碼保持原樣，便於在 Chrome 開發者工具中進行偵錯。封裝後的檔案將為 `arc-sidebar-v<版本號>-dev.zip`。

*   **生產模式**：`make release`

    此指令會執行生產環境的建置流程，包含以下步驟：
    1.  使用 `esbuild` 將所有 JavaScript 模組打包並壓縮成單一檔案。
    2.  壓縮 CSS 檔案。
    3.  將輸出結果封裝成適合上傳至 Chrome 線上應用程式商店的 `.zip` 檔案。

---

## 🧪 測試

為了確保專案功能的品質與穩定性，我們採用使用案例測試 (Use Case Testing) 方式來驗證每一次改動。

### 使用案例測試

*   **目的**：每個使用案例測試都清楚定義了特定功能的預期行為與操作流程。它們以描述性文字呈現，詳細說明測試步驟、前提條件、預期結果與驗證方法。
*   **位置**：所有使用案例測試檔案皆存放在專案根目錄的 `usecase_tests/` 資料夾中。
*   **執行與驗證**：目前這些測試主要由手動執行。開發者需要根據測試檔案中的步驟，在執行的 Chrome 擴充功能中模擬使用者操作，並觀察結果是否符合預期。

### 自動化測試

針對未來的自動化測試，我們選擇 **Puppeteer** 作為我們的端對端 (E2E) 測試框架。這容許我們撰寫腳本來模擬瀏覽器中的各種使用者操作並驗證功能。

---

## 🔒 隱私與常見問題

我們非常重視您的隱私。本擴充功能完全在本機執行，不會收集或傳輸您的個人資料。

更多詳細資訊，請參見我們的 [隱私權政策](../../PRIVACY_POLICY.md)。

---

## 👥 貢獻者

特別感謝所有幫助打造更佳專案的貢獻者：

<a href="https://github.com/Tai-ch0802/arc-like-chrome-extension/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=Tai-ch0802/arc-like-chrome-extension" />
</a>

## 📜 授權條款

本專案採用 MIT 授權條款 - 詳見 [LICENSE](../../LICENSE) 檔案。