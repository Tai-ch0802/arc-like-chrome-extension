# [Fix] Code Refactoring: Tab Renderer & Context Menu PRD

| Attribute | Details |
| :--- | :--- |
| **Status** | Draft |
| **Author** | AntiGravity Agent |
| **Original Request** | "Maintain code quality after large feature additions" |
| **Last Updated** | 2026-01-21 |

## 1. Introduction
### 1.1 Problem Statement
隨著功能快速迭代（如和其他視窗的分頁、ContextMenu 等），`modules/ui/tabRenderer.js` 已膨脹至 660+ 行。它同時負責「一般分頁」、「Tab Group」、「Other Windows」以及「右鍵選單 (Context Menu)」的邏輯。違反了 Single Responsibility Principle (SRP)，造成維護困難與高風險。

### 1.2 Goals & Objectives
*   **目標 1 (Decomposition)**: 將 `tabRenderer.js` 拆分為更小的專責模組。
*   **目標 2 (Decoupling)**: 將 Context Menu 邏輯從渲染邏輯中剝離。
*   **目標 3 (Maintainability)**: 提升程式碼可讀性，降低未來修改特定功能（如 Other Windows）時破壞其他功能的風險。

### 1.3 Success Metrics (KPIs)
*   `tabRenderer.js` 行數減少 40% 以上。
*   功能回歸測試 (Regression Test) 通過率 100%（確保重構不改變行為）。

## 2. User Stories
此重構為內部程式碼優化，無直接 User Story，但對應開發者體驗：
| ID | As a (Role) | I want to (Action) | So that (Benefit) | Priority |
| :--- | :--- | :--- | :--- | :--- |
| US-01 | 開發者 | 修改 "Other Windows" 的渲染樣式 | 不需在數百行代碼中尋找相關函式，且不擔心影響主分頁列表 | High |
| US-02 | 開發者 | 新增右鍵選單選項 | 在獨立的 `contextMenu.js` 中處理，而非混雜在 DOM 生成邏輯中 | High |

## 3. Functional Requirements
### 3.1 Extract Other Windows Renderer
*   **FR-01**: 建立 `modules/ui/otherWindowRenderer.js`。
*   **FR-02**: 將 `renderOtherWindowsSection` 及其相關輔助函式 (`createOtherWindowTabElement`) 遷移至新模組。
*   **FR-03**: 新模組應匯出 `renderOtherWindowsSection` 供 Facade (`uiManager.js`) 使用。

### 3.2 Extract Context Menu Logic
*   **FR-04**: 建立 `modules/ui/inputManagers/contextMenuManager.js` (或類似路徑)。
*   **FR-05**: 將 `showContextMenu` 及其關聯的事件處理 (`handleContextMenuClose`, `triggerCopy`) 遷移。
*   **FR-06**: `tabRenderer.js` 僅負責綁定 `contextmenu` 事件，實際邏輯委派給 Manager。

### 3.3 Facade Update
*   **FR-07**: `modules/uiManager.js` 需更新 import 路徑，確保對 `sidepanel.js` 的接口 (`ui.renderOtherWindowsSection`) 保持不變。

## 4. User Experience (UI/UX)
*   **No Change**: 使用者體驗應與重構前完全一致（Pixel-perfect maintain）。

## 5. Non-Functional Requirements
*   **Risk Control**: 由於涉及核心 UI，必須確保 Event Listener 的綁定與釋放正確，避免 Memory Leak。
