---
name: refactoring
description: "Guidelines and techniques for identifying code smells and refactoring code, based on Refactoring.guru principles and adapted for Vanilla JS Chrome Extensions."
---

# Refactoring Skill

這項技能旨在幫助識別程式碼異味 (Code Smells) 並應用重構技術 (Refactoring Techniques) 來提升程式碼品質。基礎原則源自 [Refactoring.guru](https://refactoring.guru/refactoring)，並針對本 Chrome 擴充功能專案的特性 (Vanilla JS, Modules, Side Panel) 進行了調整。

## 核心原則

1.  **Clean Code (整潔程式碼)**: 易於閱讀、理解和維護。
2.  **Dirty Code (骯髒程式碼)**: 充滿 "異味"，難以維護和擴充。
3.  **小步前進 (Baby Steps)**: 每次只做一小步修改，並確保測試通過。

## 流程 (Process)

1.  **識別異味 (Identify Smells)**: 觀察程式碼，找出符合 "Code Smells" 的特徵。
2.  **選擇技術 (Select Technique)**: 根據異味類型，選擇合適的重構技術。
3.  **執行重構 (Refactor)**: 對程式碼進行修改。
4.  **驗證 (Verify)**: 確保功能未受影響 (Manual Test / Unit Test)。

---

## 常見代碼異味 (Code Smells) 與對策

### 1. Bloaters (膨脹者)
程式碼、方法或類別變得過於龐大，難以管理。

*   **Long Method (過長函式)**
    *   *徵兆*: 一個函式超過 30-50 行，或包含多個層次的巢狀結構。
    *   *對策*: **Extract Method (提煉函式)**。將部分邏輯移至新函式。
    *   *專案情境*: `sidepanel.js` 中的大型事件監聽器，或 `render()` 函式。

*   **Large Class / Module (過大類別/模組)**
    *   *徵兆*: 一個檔案 (如 `modules/uiManager.js`) 承擔過多指責。
    *   *對策*: **Extract Class/Module (提煉類別/模組)**。按功能拆分。

*   **Long Parameter List (過長參數列)**
    *   *徵兆*: 函式接收超過 3-4 個參數。
    *   *對策*: **Introduce Parameter Object (引入參數物件)**。傳遞一個 Object 配置。

### 2. Object-Orientation Abusers (物件導向濫用者)
錯誤地應用 OO 原則。

*   **Switch Statements (Switch 語句濫用)**
    *   *徵兆*: 複雜的 `switch` 或 `if-else` 鏈，用於判斷類型執行不同邏輯。
    *   *對策*: **Replace Conditional with Polymorphism (以多型取代條件式)**。但在 Vanilla JS 中，可使用 Object Map 或 Strategy Pattern。

### 3. Change Preventers (修改阻礙者)
修改一處需要同時修改多處。

*   **Shotgun Surgery (霰彈式修改)**
    *   *徵兆*: 每除要加一個小功能，就要改動 5-6 個檔案。
    *   *對策*: **Move Method/Field (搬移函式/欄位)**。將相關邏輯集中到單一模組。

### 4. Dispensables (可有可無者)
無用或多餘的程式碼。

*   **Comments (過多註解)**
    *   *徵兆*: 用註解來解釋 "這段程式碼在做什麼" (而不是 "為什麼這麼做")。
    *   *對策*: **Rename Method/Variable (重新命名)**。讓程式碼自解釋。
*   **Duplicate Code (重複程式碼)**
    *   *徵兆*: 相同的邏輯出現在兩個以上的地方。
    *   *對策*: **Extract Method** 並共用。
    *   *專案情境*: 多個 Renderer 中的 create element 邏輯 -> 統一使用 `modules/ui/elements.js` 或工具函式。

---

## 常用重構技術 (Techniques)

### Composing Methods (組裝函式)
*   **Extract Method**: 選中一段代碼 -> 獨立為新函式 -> 命名 ->替換原處調用。
*   **Inline Method**: 當函式本體比名稱更清楚時，將其塞回調用處。
*   **Replace Temp with Query**: 將臨時變數替換為函式調用，減少局部變數干擾。

### Organizing Data (組織數據)
*   **Encapsulate Field**: (在 JS 中較少強制) 使用 getter/setter 封裝變數存取。
*   **Replace Magic Number with Symbolic Constant**: 將 `86400` 替換為 `SECONDS_IN_DAY`。

### Simplifying Conditional Expressions (簡化條件式)
*   **Decompose Conditional**: 將複雜的 `if (a && b || c)` 提煉為 `if (isSpecialCase())`。
*   **Consolidate Conditional Expression**: 合併結果相同的條件檢查。
*   **Replace Nested Conditional with Guard Clauses**: 使用 "衛句" (Guard Clauses) 盡早 return，減少巢狀。

---

## 專案特定重構指南 (Arc-Like Chrome Extension)

1.  **DOM 操作分離**:
    *   避免在業務邏輯 (`modules/stateManager.js`) 中直接操作 DOM。
    *   確保所有 DOM 生成都在 `*Renderer.js` 模組中。
    *   確保所有 DOM 查詢都在 `modules/ui/elements.js` (如果可能)。

2.  **狀態管理**:
    *   避免依賴 `window.globalVar`。使用 `stateManager` 模組來保存跨模組狀態。

3.  **Chrome API 封裝**:
    *   不要在 UI 元件中直接呼叫 `chrome.bookmarks.*`。應透過 `modules/apiManager.js` 呼叫，以便未來替換或測試。

4.  **樣式一致性**:
    *   避免使用 `element.style.color = 'red'`。應使用 CSS class (`element.classList.add('error')`) 搭配 `index.css`。

## 如何使用此 Skill
當 User 要求 "Refactor this file" 或 "Clean up this code" 時：
1.  **Check**: 閱讀檔案，對照上述 Code Smells 清單。
2.  **Plan**: 提出重構計畫 (例如: "我將把這個 100 行的 render 函式拆解為 3 個子函式")。
3.  **Execute**: 執行修改。
4.  **Verify**: 確保功能一致。
