# Modal Scrollbar UX Optimization PRD

| Attribute | Details |
| :--- | :--- |
| **Version** | v1.0 |
| **Status** | Draft |
| **Author** | Agent |
| **Created** | 2026-01-26 |
| **Last Updated** | 2026-01-26 |

---

## 1. Introduction

### 1.1 Purpose
優化 `modules/modalManager.js` 產生的 Modal 視窗中的捲軸體驗。使其視覺上更為精簡（線條感、變窄），並能隨主題自動變色。

### 1.2 Scope
- 所有透過 `modalManager.js` 產生的 Modal (包含 `showConfirm`, `showPrompt`, `showFormDialog`, `showCustomDialog`, `showAddToBookmarkDialog`, `showCreateGroupDialog`)。
- 主要針對 CSS 樣式調整。

---

## 2. User Stories

| ID | User Story | Priority |
| :--- | :--- | :--- |
| US-01 | 作為使用者，我希望 Modal 的捲軸更窄且具線條感，以減少視覺干擾並提升精緻度。 | High |
| US-02 | 作為使用者，我希望 Modal 的捲軸顏色能跟隨當前主題改變，以保持介面一致性。 | High |

---

## 3. Functional Requirements

### 3.1 視覺樣式
- **FR-01**: 捲軸寬度應設定為較窄的數值 (建議 4px - 6px)。
- **FR-02**: 捲軸軌道 (Track) 應為透明或極淡色，減少區塊感。
- **FR-03**: 捲軸滑塊 (Thumb) 應有圓角 (Border Radius)，呈現圓潤線條感。

### 3.2 主題適應
- **FR-04**: 捲軸滑塊的顏色必須使用 CSS 變數 (如 `var(--text-color-secondary)` 或 `var(--border-color)`)，確保切換主題時自動變色。
- **FR-05**: 滑鼠懸停於捲軸時，滑塊顏色應有變化 (使用 Hover 變數)，提供回饋。

---

## 4. Acceptance Criteria

- [ ] Modal 內的捲軸寬度明顯變窄 (約 6px)。
- [ ] 捲軸呈現線條狀，無明顯背景塊。
- [ ] 切換至 "Google" 主題 (白底) 時，捲軸為深灰色系。
- [ ] 切換至 "Geek Black" 主題 (深底) 時，捲軸為淺灰色系。
- [ ] 捲軸功能正常，可拖曳捲動。
