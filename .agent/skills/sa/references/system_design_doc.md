# [System Name/Feature] System Design Document

| Attribute | Details |
| :--- | :--- |
| **Version** | v1.0 |
| **Status** | Draft / Review / Approved / Frozen |
| **Author** | [Name] |
| **Related PRD** | [Link to PRD_spec.md] |
| **PRD Version** | v1.0 |
| **Created** | YYYY-MM-DD |
| **Last Updated** | YYYY-MM-DD |

## 1. Overview
### 1.1 Scope
本文件涵蓋的技術範圍，以及不包含的部分。

### 1.2 Architecture Diagram
高層架構圖 (Context Diagram or Container Diagram)。

```mermaid
graph TD
    User[User] -->|Interact| UI[Chrome Extension UI]
    UI -->|Message| BG[Background Service Worker]
    BG -->|API| Server[Remote Server]
    BG -->|Storage| DB[(Chrome Storage)]
```

## 2. Requirement Traceability
> **[Critical]** 此表格建立 PRD 需求與 SA 設計的追溯關係，確保每個需求都有對應的技術實現。

| Req ID | PRD Section | SA Section | Implementation File | Test File |
|--------|-------------|------------|---------------------|-----------|
| FR-01  | PRD 3.1     | SA 2.1     | `module/handler.js` | `handler.test.js` |
| FR-02  | PRD 3.1     | SA 2.2     | `module/api.js`     | `api.test.js` |
| FR-03  | PRD 3.2     | SA 2.3     | `module/ui.js`      | - |

## 3. Component Design
### 3.1 [Module A]
*   **Description**: 功能描述。
*   **Responsibilities**: 職責清單。
*   **Dependencies**: 依賴的其他模組。
*   **Interfaces**: 暴露的 Public Methods。

### 3.2 [Module B]
...

## 4. Data Design
### 4.1 Data Models (Schema)
定義核心資料結構。

```json
// UserSettings
{
  "theme": "dark",
  "notifications": true,
  "lastSync": 1678900000
}
```

### 4.2 Storage Strategy
*   **Persistent**: `chrome.storage.local` (User data)
*   **Session**: `sessionStorage` (Temporary state)

## 5. Interface Design (API)
### 5.1 Internal API (Message Passing)
定義 Extension 內部的通訊協議。

*   **Request**: `GET_USER_DATA`
    *   Payload: `{ userId: string }`
*   **Response**:
    *   Success: `{ user: UserProfile }`
    *   Error: `{ error: string }`

## 6. Sequence Flows
關鍵業務流程的循序圖。

```mermaid
sequenceDiagram
    participant UI
    participant Handler
    participant Storage
    
    UI->>Handler: saveData(data)
    Handler->>Storage: set(data)
    Storage-->>Handler: success
    Handler-->>UI: notify "Saved"
```

## 7. Testing Strategy
### 7.1 Test Impact Analysis
> 列出此變更影響的現有測試，以及需要新增的測試。

| Test File | Impact | Action Required |
|-----------|--------|-----------------|
| `existing.test.js` | Import path change | Update imports |
| `new.test.js` | New test | Create test |

### 7.2 Verification Plan
*   **Unit Tests**: 驗證各模組獨立功能
*   **Integration Tests**: 驗證模組間互動
*   **Manual Verification**: 手動驗證步驟

## 8. Security & Performance
*   **Security**: 輸入驗證 (Sanitization), 權限檢查。
*   **Performance**: 大量資料的分頁加載, 緩存策略。

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| v1.0 | YYYY-MM-DD | [Name] | Initial draft |
