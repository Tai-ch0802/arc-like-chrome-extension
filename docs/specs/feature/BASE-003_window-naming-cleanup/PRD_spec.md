# [Feature] Window Naming Cleanup PRD

| Attribute | Details |
| :--- | :--- |
| **Status** | Approved (Reverse Engineered) |
| **Author** | AntiGravity Agent |
| **Original Spec** | `docs/feat-spec/003_window_naming_cleanup.md` |
| **Last Updated** | 2026-01-21 |

## 1. Introduction
### 1.1 Problem Statement
 Chrome 視窗 ID 是暫時性的 (Session-specific)。目前的「視窗命名功能」雖然會儲存名稱，但缺乏刪除機制。當視窗關閉或瀏覽器重啟後，`storage.local` 中會累積無效的視窗名稱資料 (也就是「幽靈視窗」)，導致長期資源浪費。

### 1.2 Goals & Objectives
*   **目標 1 (自動清理)**: 當視窗關閉時，即時移除該 ID 對應的自定義名稱。
*   **目標 2 (自我修復)**: 擴充功能啟動時，自動掃描並移除所有無效的歷史資料。

### 1.3 Success Metrics (KPIs)
*   Storage 使用量維持在與當前活動視窗數量成正比的水準，無無限增長。

## 2. User Stories
| ID | As a (Role) | I want to (Action) | So that (Benefit) | Priority |
| :--- | :--- | :--- | :--- | :--- |
| US-01 | 開發者/系統 | 自動清理無用的視窗名稱數據 | 保持 Storage 整潔且高效 | High |
| US-02 | 使用者 | 重啟瀏覽器後打開 extension | 不會看到已經不存在的視窗的殘留名稱（若未來有 UI 顯示歷史紀錄的話） | Medium |

## 3. Functional Requirements
### 3.1 Runtime Cleanup (即時清理)
*   **FR-01**: 系統必須監聽視窗關閉事件 (`chrome.windows.onRemoved`)。
*   **FR-02**: 當視窗關閉時，系統必須從儲存空間中移除該視窗 ID 的名稱。

### 3.2 Startup Synchronization (啟動同步)
*   **FR-03**: 系統初始化時 (`sidepanel` 啟動)，必須獲取當前所有活動視窗列表。
*   **FR-04**: 系統必須比對儲存的名稱列表與活動視窗列表。
*   **FR-05**: 任何不在活動列表中的儲存 ID，必須被判定為過期並刪除。

## 4. User Experience (UI/UX)
本功能為後端邏輯優化，無直接 UI 變化。

## 5. Non-Functional Requirements
*   **Data Integrity**: 清理過程不得誤刪當前活動視窗的名稱。
*   **Performance**: 啟動時的掃描應輕量化，不影響 Loading 速度。

## 6. Out of Scope
*   跨裝置同步名稱 (目前僅本地)。
