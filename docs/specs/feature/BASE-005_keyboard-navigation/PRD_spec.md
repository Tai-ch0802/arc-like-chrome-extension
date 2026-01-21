# [Feature] Keyboard Navigation PRD

| Attribute | Details |
| :--- | :--- |
| **Status** | Approved (Reverse Engineered) |
| **Author** | AntiGravity Agent |
| **Original Spec** | `docs/feat-spec/005_keyboard_navigation.md` |
| **Last Updated** | 2026-01-21 |

## 1. Introduction
### 1.1 Problem Statement
 Chrome Extension 的側邊欄預設鍵盤導覽體驗不佳，且 Chrome 安全機制導致側邊欄無法在開啟時自動搶奪焦點，這對於依賴鍵盤操作的 Power User 來說是一大痛點。

### 1.2 Goals & Objectives
*   **目標 1 (全面支援)**: 支援分頁、群組、書籤的鍵盤瀏覽。
*   **目標 2 (直覺操作)**: 使用方向鍵 (Arrow Keys) 進行二維導覽，優化 Tab 鍵邏輯。
*   **目標 3 (無障礙)**: 優化 `tabindex`，提供良好的螢幕閱讀器支援。

### 1.3 Success Metrics (KPIs)
*   使用者能完成 "開啟側邊欄 -> 選擇分頁 -> 關閉側邊欄" 的流程，全程無需滑鼠。

## 2. User Stories
| ID | As a (Role) | I want to (Action) | So that (Benefit) | Priority |
| :--- | :--- | :--- | :--- | :--- |
| US-01 | 鍵盤使用者 | 透過上下鍵瀏覽分頁列表 | 快速切換分頁無需移動手指去按 Tab | High |
| US-02 | 使用者 | 透過左右鍵進出分頁的操作按鈕 | 快速執行 "關閉" 或 "釘選" 動作 | High |
| US-03 | 使用者 | 打開側邊欄後直接按方向鍵 | 系統自動校正焦點並開始導覽，無需先用滑鼠點一下 | Critical |

## 3. Functional Requirements
### 3.1 Roving Focus (導覽邏輯)
*   **FR-01 (Vertical)**: `ArrowUp`/`ArrowDown` 必須在主要項目 (分頁、群組標題、書籤) 間移動焦點。
*   **FR-02 (Search)**: 當焦點在列表頂端時，`ArrowUp` 必須移動至搜尋框；反之 `ArrowDown` 移回列表首項。
*   **FR-03 (Horizontal)**: `ArrowRight` 進去項目內部的操作按鈕 (Action Buttons)，`ArrowLeft` 退出回到項目本身。
*   **FR-04 (Activation)**: `Enter` 或 `Space` 必須執行該項目的主要動作 (切換分頁、展開資料夾等)。

### 3.2 Tab Key Optimization
*   **FR-05**: 主要項目必須設為 `tabindex="0"`。
*   **FR-06**: 內部操作按鈕必須設為 `tabindex="-1"`，僅允許透過方向鍵進入，以減少 Tab 鍵遍歷次數。

### 3.3 Chrome Focus Limitation Workaround
*   **FR-07 (First-Key Strategy)**: 若側邊欄開啟但未獲焦點，當使用者按下任意方向鍵時，系統必須強制將焦點設為當前活躍分頁。
*   **FR-08 (Manual)**: 點擊分頁時必須賦予側邊欄焦點；再次點擊同一分頁必須展開焦點狀態。

## 4. User Experience (UI/UX)
```mermaid
graph TD
    Start[Open Sidebar] -->|Any Arrow Key| AutoFocus[Focus Active Tab]
    AutoFocus -->|Arrow Up/Down| NavigateList[Navigate Items]
    NavigateList -->|Arrow Right| FocusActions[Focus Close/Edit Buttons]
    NavigateList -->|Enter| SwitchTab[Switch Tab]
    NavigateList -->|Arrow Up (Top)| FocusSearch[Focus Search Bar]
```

## 5. Non-Functional Requirements
*   **Accessibility**: 焦點指示器 (Focus Ring) 必須清晰可見。
*   **Performance**: 按鍵響應必須即時，無明顯延遲。
