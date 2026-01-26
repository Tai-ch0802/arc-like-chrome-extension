# Modal Scrollbar UX Optimization System Analysis

| Attribute | Details |
| :--- | :--- |
| **Version** | v1.0 |
| **Status** | Draft |
| **Author** | Agent |
| **Related PRD** | [PRD_spec.md](./PRD_spec.md) |
| **Created** | 2026-01-26 |
| **Last Updated** | 2026-01-26 |

---

## 1. Overview

### 1.1 Architecture
本次變更僅涉及 CSS 層面的樣式調整 (Style Enhancement)，不需要修改 JavaScript 邏輯。
透過 Webkit 專屬的 CSS 偽元素 (`::-webkit-scrollbar`) 來客製化捲軸樣式。

---

## 2. Technical Design

### 2.1 CSS Implementation

**Target Classes**:
- `.modal-content` (通用 Modal 容器)
- `.modal-custom-content` (自訂內容容器，如設定頁面)

**CSS Strategy**:

```css
/* 定義在 sidepanel.css */

.modal-content::-webkit-scrollbar,
.modal-custom-content::-webkit-scrollbar {
    width: 6px; /* 變窄 */
    height: 6px; /* 水平捲軸高度 */
}

.modal-content::-webkit-scrollbar-track,
.modal-custom-content::-webkit-scrollbar-track {
    background: transparent; /* 透明軌道 */
}

.modal-content::-webkit-scrollbar-thumb,
.modal-custom-content::-webkit-scrollbar-thumb {
    background-color: var(--text-color-secondary); /* 跟隨主題 */
    border-radius: 3px; /* 圓角線條感 */
}

.modal-content::-webkit-scrollbar-thumb:hover,
.modal-custom-content::-webkit-scrollbar-thumb:hover {
    background-color: var(--text-color-primary); /* Hover 回饋 */
}
```

### 2.2 Traceability Matrix

| Req ID | PRD Section | SA Section | Implementation File |
| :--- | :--- | :--- | :--- |
| FR-01 | 3.1 視覺樣式 (寬度) | 2.1 CSS Implementation | `sidepanel.css` |
| FR-02 | 3.1 視覺樣式 (軌道) | 2.1 CSS Implementation | `sidepanel.css` |
| FR-03 | 3.1 視覺樣式 (滑塊) | 2.1 CSS Implementation | `sidepanel.css` |
| FR-04 | 3.2 主題適應 (顏色) | 2.1 CSS Implementation | `sidepanel.css` |
| FR-05 | 3.2 主題適應 (Hover) | 2.1 CSS Implementation | `sidepanel.css` |

---

## 3. Impact Analysis

- **Files**: `sidepanel.css`
- **Risks**:
    - 不同作業系統 (Windows vs Mac) 的捲軸行為略有不同。Mac 預設可能隱藏捲軸，直到滾動時才顯示。自訂樣式通常會強制顯示 (Overlay 模式可能失效)，需確保視覺上不會過於突兀。
    - 由於設定了 `6px`，在極小螢幕上可能會佔用極少量的空間，但影響極低。

---

## 4. Verification

### 4.1 Manual Test Cases
1. 開啟設定 Modal。
2. 縮小視窗直到出現捲軸。
3. 確認捲軸寬度為 6px。
4. 確認捲軸顏色與當前主題的次要文字顏色一致。
5. 懸停捲軸，確認顏色變亮 (Primary Text Color)。
