# Keyboard Navigation & Accessibility Spec

## Overview
此功能旨在提供一套完整的鍵盤導覽體驗，讓使用者可以僅透過鍵盤完成大部分的側邊欄操作。我們模仿了原生作業系統的列表導航邏輯，並針對 Chrome Extension 的特殊限制實作了解決方案。

## Goals
1.  **全面鍵盤支援**：支援分頁、群組、書籤的瀏覽與操作。
2.  **直覺操作**：使用方向鍵 (Arrow Keys) 進行直覺導覽，而非僅依賴 Tab 鍵。
3.  **無障礙友善**：優化 `tabindex` 管理，提供良好的螢幕閱讀器支援。

## Interaction Design (互動設計)

### 1. 導覽邏輯 (Navigation Logic)
我們採用 **"Roving Focus"** 模式：

*   **`ArrowUp` / `ArrowDown` (上下鍵)**：
    *   在主要項目（分頁、群組標題、書籤資料夾、書籤）之間垂直移動焦點。
    *   **特殊處理**：當焦點位於列表最上方時，再次按下 `ArrowUp` 會將焦點移至 **搜尋框 (Search Bar)**。
    *   **特殊處理**：當焦點位於搜尋框時，按下 `ArrowDown` 會將焦點移至 **列表的第一個項目**。

*   **`ArrowLeft` / `ArrowRight` (左右鍵)**：
    *   **`ArrowRight`**：當焦點在某個項目上時，按下右鍵會將焦點移動到該項目內部的 **動作按鈕**（如：關閉、加入群組、編輯）。若已在最後一個按鈕，則不動作。
    *   **`ArrowLeft`**：當焦點在動作按鈕上時，按下左鍵會往左移動到前一個按鈕；若已在第一個按鈕，則回到 **主要項目** 本身。

*   **`Enter` / `Space` (確認/空白鍵)**：
    *   **分頁**：切換至該分頁。
    *   **分頁群組**：展開/收合群組。
    *   **書籤資料夾**：展開/收合資料夾。
    *   **書籤**：在當前分頁開啟該書籤連結。

### 2. Tab 鍵行為 (Tab Key Behavior)
為了提升效率，我們優化了 Tab 順序：
*   **主要項目** (分頁、書籤等) 設為 `tabindex="0"`：參與 Tab 鍵順序。
*   **內部按鈕** (關閉、編輯等) 設為 `tabindex="-1"`：**不參與** Tab 鍵順序，僅能透過方向鍵到達。
*   **效益**：使用者按 Tab 鍵時可以快速跳過每個項目內部的小按鈕，僅在主要項目間切換，大幅減少按鍵次數。

## Constraints & Workarounds (限制與解決方案)

### Chrome Focus Limitation (焦點限制)
Chrome 瀏覽器基於安全性考量，不允許側邊欄 (Side Panel) 在開啟時自動從主網頁「搶奪」鍵盤焦點。這意味著當您使用快捷鍵 (`Cmd+B` 或 `Cmd+I`) 開啟側邊欄時，焦點通常仍停留在網頁內容上。

### Solution (解決方案)
為了提供順暢的體驗，我們實作了以下機制：

1.  **First-Key Strategy (首鍵導向)**：
    *   當側邊欄開啟後，雖然視覺上沒有焦點，但我們在全域監聽了方向鍵事件。
    *   一旦使用者按下 **任意方向鍵** (Up/Down/Left/Right)，我們偵測到目前沒有特定元素被聚焦，就會 **自動將焦點強行設定到當前活躍的分頁 (Active Tab)**。
    *   這讓使用者感覺像是「按一下就開始導覽」。

2.  **User Workaround (手動獲取焦點)**：
    *   若上述自動機制在某些極端情況下失效，使用者可以透過 **點擊滑鼠** 來手動獲取焦點。
    *   **行為定義**：
        *   **點擊一下 (Click)**：切換至該分頁 (Switch Tab)。此時側邊欄即獲得焦點。
        *   **再次點擊 (Click Again)**：若點擊的是當前已選取的分頁，則視為確認並展開焦點狀態 (Expand Focus Status)，確保鍵盤導覽從此處開始。

## Implementation Details
*   **Module**: `modules/keyboardManager.js`
*   **Key Functions**: `handleKeyDown`, `handleArrowUp`, `handleArrowDown`.
