# Background Image Feature PRD

| Attribute | Details |
| :--- | :--- |
| **Version** | v1.0 |
| **Status** | Draft |
| **ID** | BASE-008 |
| **Feature** | Custom Background Image Upload |
| **Created** | 2026-01-26 |
| **Last Updated** | 2026-01-26 |

---

## 1. Introduction

### 1.1 Purpose
延續 Custom Theme Color (ISSUE-30) 的 Phase 2 規劃，實作使用者自訂背景圖片上傳功能。允許使用者上傳圖片作為側邊欄背景，並提供透明度與模糊度調整，打造個人化的視覺體驗。

### 1.2 Scope
- **來源支援**:
    - **本機上傳**: 支援使用者從本地裝置上傳圖片 (儲存於 `local`)。
    - **網路網址**: 支援輸入圖片 URL (儲存於 `sync`)。
- **調整**:
    - **視覺**: 透明度 (Opacity)、模糊度 (Blur)。
    - **位置**: 水平位置 (Left/Center/Right)、垂直位置 (Top/Center/Bottom)。
- **預覽**: 在設定面板即時預覽效果。
- **清除**: 允許移除背景圖片。

---

## 2. User Stories

| ID | User Story | Priority |
| :--- | :--- | :--- |
| US-01 | 作為使用者，我希望上傳自己的圖片作為側邊欄背景，以展現個人風格。 | High |
| US-02 | 作為使用者，我希望直接貼上圖片網址 (URL) 作為背景，方便使用網路資源且不佔用本地空間。 | High |
| US-03 | 作為使用者，我希望調整背景圖片的透明度，以免過於搶眼影響文字閱讀。 | High |
| US-04 | 作為使用者，我希望調整背景圖片的模糊度，增加景深感並提升可讀性。 | Medium |
| US-05 | 作為使用者，由上傳圖片經過壓縮處理，以確保擴充功能運作效能不受影響。 | High |
| US-06 | 作為使用者，我可以隨時移除背景圖片，恢復原本的純色背景。 | High |
| US-07 | 作為使用者，我希望調整圖片的水平與垂直對齊位置，確保圖片重點不被裁切。 | Medium |

---

## 3. Functional Requirements

### 3.1 圖片來源 (Image Source)
- **FR-01**: **本機上傳**: 支援格式包含 JPG, PNG, WebP。需自動進行 Client-side 壓縮 (轉為 WebP, max-width 1920px)。
- **FR-02**: **網路網址**: 提供輸入框讓使用者貼上圖片 URL。系統需**自動抓取 (Fetch)** 該圖片，並進行轉檔壓縮 (WebP) 與本地快取，避免依賴外部連結存活。
- **FR-03**: **大小限制**: 本機上傳圖片限制為 4MB (上傳前檢查)。

### 3.2 圖片調整 (Adjustments)
- **FR-04**: **Opacity Slider**: 範圍 0% - 100%，預設 50%。
- **FR-05**: **Blur Slider**: 範圍 0px - 20px，預設 0px。
- **FR-06**: **Position Alignments (Toggle List)**:
    - **水平擺放 (Horizontal)**: 靠左 (Left)、置中 (Center)、靠右 (Right)。
    - **垂直擺放 (Vertical)**: 靠上 (Top)、置中 (Center)、靠下 (Bottom)。
    - *Note*: 不涉及圖片縮放 (Scale)，僅控制 `background-position`。
- **FR-07**: 調整時需有 Debounce 機制 (100ms)。

### 3.3 儲存與同步 (Storage)
- **FR-08**: **統一本地快取策略 (Unified Local Cache)**:
    - 無論來源是「本機上傳」或「網路網址」，統一將處理後的圖片資料 (Base64 WebP) 存於 `chrome.storage.local`。
    - `chrome.storage.sync` 僅儲存圖片來源資訊 (如原始 URL) 與設定參數 (含位置設定)，確保設定同步但圖片資料不佔用 Sync Quota。
- **FR-09**: 設定參數 (Opacity, Blur, StorageType, PositionX, PositionY) 統一存於 `chrome.storage.sync`。

### 3.4 UI/UX
- **FR-10**: 介面設計需符合 `ui-ux-pro-max` 規範。提供 Tab 切換「上傳圖片」與「圖片網址」。
- **FR-11**: 位置調整控制項應使用直覺的 Icon 或 Segmented Control (Toggle List) 樣式。
- **FR-10**: 當背景圖片存在時，側邊欄的文字與 icon 顏色需確保對比度 (或是強制背景圖上方疊加一層半透明遮罩)。

---

## 4. Acceptance Criteria

- [ ] 可成功上傳 JPG/PNG 圖片，並顯示於側邊欄背景。
- [ ] 圖片大小超過限制時會顯示錯誤提示。
- [ ] 調整 Opacity 滑桿，背景透明度即時變化。
- [ ] 調整 Blur 滑桿，背景模糊度即時變化。
- [ ] 重新整理或重啟瀏覽器後，背景圖片依然存在。
- [ ] 點擊「移除圖片」後，背景恢復為純色主題。
- [ ] (Performance) 上傳大圖 (example. 4k wallpaper) 不會造成 UI 卡頓，且儲存大小經過壓縮。

---

## 5. Notes
- 參考 `image-master` skill，使用 Canvas 或 `createImageBitmap` 進行前端壓縮。
- 為了確保文字可讀性，背景圖層 (z-index: -1) 應位於內容圖層之下，且內容容器背景色需調整為半透明 (`rgba(..., 0.8)`)。
