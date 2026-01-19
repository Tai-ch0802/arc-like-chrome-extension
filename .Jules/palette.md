## 2024-05-22 - Chrome Extension Tab Accessibility
**學習：** Chrome 擴充功能的側邊欄 (Side Panel) 中，自定義的列表項目 (如分頁、書籤) 往往被實現為 `div`，雖然可以用鍵盤導航 (`tabindex="0"`)，但缺乏語意 (`role`) 和明確的標籤 (`aria-label`)，導致螢幕閱讀器體驗不佳。特別是當項目包含裝飾性圖片或複雜結構時，直接讀取內容可能造成混淆。
**行動：** 未來在開發類似列表介面時，應確保每個可互動的列表項目都有明確的 `role="button"` (或其他合適的角色) 以及能夠準確描述動作的 `aria-label`，並提供明顯的 `:focus-visible` 樣式以支援鍵盤使用者。
