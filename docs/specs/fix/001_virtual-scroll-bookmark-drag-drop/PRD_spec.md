# [Fix] Virtual Scroll Drag & Drop Compatibility PRD

| Attribute | Details |
| :--- | :--- |
| **Status** | Approved (Reverse Engineered) |
| **Author** | AntiGravity Agent |
| **Original Spec** | `docs/fix-spec/001-virtual-scroll-bookmark-drag-drop.md` |
| **Last Updated** | 2026-01-21 |

## 1. Introduction
### 1.1 Problem Statement
現有的 Virtual Scrolling 機制因為扁平化的 DOM 結構，導致無法與 Sortable.js 的樹狀拖曳邏輯相容。經過多次嘗試修復失敗，決定改用 "Lazy Rendering" (動態渲染) 策略來解決此問題。

### 1.2 Goals & Objectives
*   **目標 1 (Replace)**: 移除 Virtual Scrolling 並替換為 Lazy Rendering 方案。
*   **目標 2 (Compatibility)**: 確保拖曳排序 (Drag & Drop) 功能在所有層級完全正常運作。
*   **目標 3 (Performance)**: 透過只渲染展開的資料夾，維持大量書籤的載入效能。

### 1.3 Success Metrics (KPIs)
*   拖曳功能 (分頁 -> 書籤, 書籤 -> 書籤) 100% 成功率。
*   初始載入時間與舊版 Virtual Scrolling 相當。

## 2. User Stories
| ID | As a (Role) | I want to (Action) | So that (Benefit) | Priority |
| :--- | :--- | :--- | :--- | :--- |
| US-01 | 使用者 | 將分頁拖曳到某個書籤資料夾內 | 成功將該分頁存為書籤 | Critical |
| US-02 | 使用者 | 在書籤列表中拖曳調整順序 | 資料夾結構不會亂掉或無法放入 | Critical |
| US-03 | 使用者 | 展開一個含有大量書籤的資料夾 | 列表不會卡頓，能順暢顯示 | High |

## 3. Functional Requirements
### 3.1 Lazy Rendering (動態渲染)
*   **FR-01**: 書籤資料夾預設必須為收合狀態。
*   **FR-02**: 只有當使用者展開資料夾時，系統才動態獲取並渲染該資料夾的子項目。
*   **FR-03**: 當資料夾收合時，系統必須清除該資料夾的 DOM 內容 (DOM Cleanup)。

### 3.2 Drag & Drop Compatibility
*   **FR-04**: 新渲染的資料夾容器必須即時初始化 Sortable 實例。
*   **FR-05**: 必須支援跨層級拖曳。

### 3.3 State Management
*   **FR-06**: 系統必須移除所有 Virtual Scrolling 相關的狀態開關 (e.g., `isVirtualScrolling`).
*   **FR-07**: 系統必須保持資料夾的展開/收合狀態 (即使在重新載入後)。

## 4. User Experience (UI/UX)
無明顯視覺變化，但操作流暢度與穩定性提升。

## 5. Non-Functional Requirements
*   **Performance**: 大量書籤 (1000+) 的初始渲染不得阻塞 UI。

## 6. Out of Scope
*   虛擬捲動 (Virtual Scrolling) 的修復 (已廢棄)。
