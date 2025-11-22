# 功能規格：搜尋功能增強 (Search Enhancement)

這份文件描述了側邊欄搜尋功能的增強規格，旨在提供更強大、更友善、更高效的搜尋體驗，讓使用者能夠快速找到所需的分頁和書籤。

## 1. 功能概述

搜尋功能增強為使用者提供以下核心能力：

- **多關鍵字搜尋**：支援以空白分隔多個關鍵字，使用 OR 邏輯進行匹配
- **URL 搜尋**：除了標題，也能搜尋分頁和書籤的 URL
- **即時文字高亮**：視覺化標示匹配的關鍵字，並區分標題匹配與 URL 匹配
- **清除按鈕**：快速清空搜尋內容並重置顯示
- **結果計數**：即時顯示符合條件的分頁與書籤數量
- **效能優化**：使用 debounce 機制避免頻繁觸發搜尋

### 使用場景

1. **快速定位**：使用者有大量分頁和書籤，需要快速找到特定網站
2. **模糊搜尋**：使用者記得部分關鍵字，但不確定完整標題
3. **多條件搜尋**：使用者想同時搜尋多個相關主題（例如：「google github」）
4. **URL 追蹤**：使用者記得網址但忘記標題，需要透過 URL 搜尋

## 2. 搜尋邏輯

### 2.1 多關鍵字搜尋（OR 邏輯）

**實作方式**：
- 將搜尋字串以空白字元（`\s+`）分割成多個關鍵字陣列
- 對每個項目（分頁/書籤），檢查其標題或 URL 是否包含**任一**關鍵字
- 只要匹配到任一關鍵字，該項目即為可見

**範例**：
- 搜尋：`google github`
- 結果：顯示所有標題或 URL 包含「google」**或**「github」的項目

**程式碼位置**：`modules/searchManager.js` → `matchesAnyKeyword()` 函式

### 2.2 URL 搜尋支援

**Domain 提取**：
- 使用 `extractDomain()` 函式從完整 URL 提取 domain
- 優先使用 `URL` API 的 `hostname` 屬性
- 降級處理：使用正則表達式 `/^(?:https?:\/\/)?([^\/:?#]+)/` 提取

**分頁搜尋**：
- 從 DOM 元素的 `data-url` 屬性取得分頁 URL
- 提取 domain 後與關鍵字匹配
- 只有 domain 匹配且標題未匹配時，才顯示 domain 資訊

**書籤搜尋**：
- 從 DOM 元素的 `title` 屬性取得完整資訊（包含 URL，位於第二行）
- 提取 domain 後與關鍵字匹配
- 只有 domain 匹配且標題未匹配時，才顯示 domain 資訊

**顯示邏輯**：
```javascript
// 只比對 domain，不包含路徑
const domain = extractDomain(url);
const titleMatches = matchesAnyKeyword(title, keywords);
const urlMatches = matchesAnyKeyword(domain, keywords);

// 只在 URL 匹配且標題未匹配時顯示 domain
if (urlMatches && !titleMatches) {
    // 顯示: {高亮的 domain}...
}
```

### 2.3 遞迴搜尋與資料夾展開

**書籤資料夾處理**：
- 使用遞迴方式搜尋巢狀書籤結構
- 若子項目匹配，父資料夾會自動顯示並展開
- 搜尋時會自動展開包含匹配項目的資料夾

**分頁群組處理**：
- 檢查群組標題是否匹配
- 檢查群組內是否有可見分頁
- 滿足任一條件則顯示該群組

## 3. UI/UX 設計

### 3.1 清除按鈕

**位置**：搜尋框右側，絕對定位

**顯示邏輯**：
- 預設隱藏（`hidden` class）
- 當搜尋框有輸入時自動顯示
- 點擊清除按鈕後隱藏

**行為**：
- 清空搜尋框內容
- 觸發一次搜尋以重置所有項目的顯示狀態
- 清除所有文字高亮

**樣式**：
- 使用 `×` 符號
- hover 時顯示為紅色（`--danger-color`）
- 透明背景，融入搜尋框

### 3.2 結果計數顯示

**位置**：搜尋框下方

**顯示邏輯**：
- 當有搜尋內容且有結果時：顯示「X 個分頁、Y 個書籤」
- 當有搜尋內容但無結果時：顯示「未找到符合的結果」
- 當無搜尋內容時：隱藏

**i18n 支援**：
- 使用 `chrome.i18n` API 格式化訊息
- 支援繁體中文和英文
- 訊息 key：`searchResultCount`、`searchNoResults`

**實作方式**：
```javascript
export function updateSearchResultCount(tabCount, bookmarkCount) {
    if (tabCount === 0 && bookmarkCount === 0) {
        searchResultCount.textContent = api.getMessage('searchNoResults');
        searchResultCount.classList.remove('hidden');
    } else if (searchBox.value.trim().length > 0) {
        const message = api.getMessage('searchResultCount', [tabCount.toString(), bookmarkCount.toString()]);
        searchResultCount.textContent = message;
        searchResultCount.classList.remove('hidden');
    } else {
        searchResultCount.classList.add('hidden');
    }
}
```

### 3.3 文字高亮

**設計決策**：
- 使用 `<mark>` HTML 標籤包裹匹配的關鍵字
- 區分標題匹配和 URL 匹配，使用不同的 CSS class
- **使用專用的 CSS 變數**確保在所有主題下都有良好的對比度
- **只比對 domain**：URL 搜尋僅提取並比對 domain 部分（使用 `extractDomain()` 函式）
- **智慧顯示**：只有 URL 匹配且標題未匹配時，才顯示 domain 資訊

**樣式設計**：
- **標題匹配**（`mark.title-match`）：
  - 背景色：`--search-match-title`（各主題專用的高亮顏色）
  - 文字顏色：`--text-color-inverted`（確保可讀性）
  - 字重：500（稍微加粗）
  - 適用於：分頁標題、群組名稱、書籤標題、資料夾名稱
  
- **URL 匹配**（`mark.url-match`）：
  - 背景色：`--search-match-url`（各主題專用的 URL 高亮顏色）
  - 文字顏色：`--text-color-inverted`（確保可讀性）
  - 字體樣式：斜體（`font-style: italic`）
  - 字重：500（稍微加粗）
  - 顯示位置：title 下方，緊湊間距（1px）
  - 格式：`{匹配的 domain}...`（省略路徑）

**DOM 結構優化**：
為確保 icon 與 title 始終保持水平對齊，採用 wrapper 容器結構：
- **分頁**：`favicon` → `.tab-content-wrapper`（包含 `title` 和可能的 `domain`）→ `actions`
- **書籤**：`icon` → `.bookmark-content-wrapper`（包含 `title` 和可能的 `domain`）→ `actions`
- Wrapper 使用 `flex-direction: column` 讓 domain 垂直排列於 title 下方

**各主題高亮顏色**：
- **Geek (Default)**：標題 #ffff00（黃色）、URL #ff6b9d（粉紅色）
- **Google**：標題 #fbbc04（Google 黃）、URL #ea4335（Google 紅）
- **Darcula**：標題 #ffc66d（橘黃色）、URL #cc7832（橘色）
- **Geek Blue**：標題 #ffff00（黃色）、URL #ff6b9d（粉紅色）
- **Christmas**：標題 #f4d03f（金黃色）、URL #e74c3c（紅色）

**實作考量**：
- 使用正則表達式進行大小寫不敏感的替換
- 特殊字元需要轉義（透過 `escapeRegExp` 函式）
- 保存原始文字於 `data-original-text` 屬性，以便清除高亮時恢復

**程式碼位置**：`modules/searchManager.js` → `highlightMatches()` 和 `highlightText()` 函式

## 4. 效能優化

### 4.1 Debounce 機制

**目的**：避免使用者每次輸入都觸發搜尋，減少不必要的 DOM 操作

**實作**：
```javascript
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

const debouncedSearch = debounce(handleSearch, 300);
```

**參數**：
- 延遲時間：300ms
- 每次輸入會重新計時，直到使用者停止輸入 300ms 後才執行搜尋

**效益**：
- 減少搜尋觸發次數，降低 CPU 使用率
- 改善輸入流暢度，特別是在大量項目時

### 4.2 高效 DOM 操作

**策略**：
- 使用 `classList.toggle()` 而非直接操作 `style.display`
- 只在有高亮時才更新 `innerHTML`
- 使用 `dataset` 屬性儲存原始文字，避免重複查詢

**未來優化方向**：
- 考慮使用 `documentFragment` 批次更新 DOM
- 實作虛擬捲動（Virtual Scrolling）以處理超大量項目

## 5. 程式碼架構

### 5.1 模組職責

**searchManager.js**：
- 核心搜尋邏輯
- debounce、多關鍵字匹配、文字高亮
- 發送 `searchResultUpdated` 自訂事件

**uiManager.js**：
- 匯出搜尋相關 DOM 元素
- 實作 `updateSearchResultCount()` 函式

**sidepanel.js**：
- 初始化搜尋 UI 事件監聽
- 處理清除按鈕點擊事件
- 監聽 `searchResultUpdated` 事件並更新計數顯示

### 5.2 事件流程

```
使用者輸入
    ↓
debounce (300ms)
    ↓
handleSearch()
    ├─ filterTabsAndGroups() → 回傳可見分頁數
    ├─ filterBookmarks() → 回傳可見書籤數
    ├─ highlightMatches() → 高亮匹配文字
    └─ 發送 searchResultUpdated 事件
            ↓
    sidepanel.js 監聽到事件
            ↓
    ui.updateSearchResultCount(tabCount, bookmarkCount)
            ↓
    更新結果計數顯示
```

## 6. i18n 多語系支援

### 6.1 新增翻譯字串

**searchResultCount**：
- 繁中：`$TAB_COUNT$ 個分頁、$BOOKMARK_COUNT$ 個書籤`
- 英文：`$TAB_COUNT$ tab(s), $BOOKMARK_COUNT$ bookmark(s)`

**searchNoResults**：
- 繁中：`未找到符合的結果`
- 英文：`No results found`

**searchPlaceholder**（既有）：
- 繁中：`搜尋分頁或書籤...`
- 英文：`Search tabs or bookmarks...`

### 6.2 使用方式

```javascript
const message = api.getMessage('searchResultCount', [tabCount.toString(), bookmarkCount.toString()]);
```

## 7. 未來功能規劃

### 7.1 虛擬捲動（Virtual Scrolling）

**目的**：處理超大量書籤/分頁（1000+ 項目）時的效能問題

**規劃**：
- 作為獨立的進階功能開發
- 在設定頁面中加入 feature toggle，讓使用者自行決定是否啟用
- 需要整合：
  - 與拖曳排序（Sortable.js）的協作
  - 摺疊/展開邏輯的調整
  - 項目高度計算與捲動位置管理

**優先級**：低（現有 debounce 機制已能處理大部分場景）

### 7.2 其他潛在改進

- **搜尋歷史記錄**：記住最近的搜尋關鍵字
- **正則表達式支援**：進階使用者可使用正則搜尋
- **搜尋範圍選項**：只搜尋分頁/只搜尋書籤的開關
- **反向搜尋**：排除特定關鍵字（例如：`-exclude`）
- **AND 邏輯支援**：同時滿足多個關鍵字

## 8. 測試建議

### 8.1 功能測試

1. **多關鍵字搜尋**：
   - 輸入 `google facebook`，確認同時顯示包含任一關鍵字的項目
   - 輸入 `github.com stackoverflow.com`，確認 URL 搜尋有效

2. **清除按鈕**：
   - 輸入關鍵字後確認清除按鈕顯示
   - 點擊清除按鈕後確認搜尋框清空且所有項目恢復顯示

3. **結果計數**：
   - 搜尋時確認計數正確
   - 無結果時確認顯示「未找到符合的結果」

4. **文字高亮**：
   - 確認匹配的關鍵字有被標記
   - 多個關鍵字都應正確高亮

5. **中文搜尋**：
   - 確認中文關鍵字搜尋正常運作

### 8.2 效能測試

1. **Debounce 測試**：
   - 快速連續輸入多個字元
   - 確認搜尋只在停止輸入後才執行

2. **大量項目測試**：
   - 準備 100+ 個書籤和分頁
   - 測試搜尋的流暢度

### 8.3 相容性測試

1. **主題測試**：
   - 切換所有主題（geek, google, darcula, geek-blue, christmas）
   - 確認高亮顏色在各主題下都清晰可見

2. **語言測試**：
   - 測試繁體中文和英文介面
   - 確認所有訊息正確顯示

3. **瀏覽器測試**：
   - 確認在最新版 Chrome 中運作正常
   - 測試不同螢幕尺寸

## 9. 已知限制

1. **虛擬捲動**：超大量項目（1000+）時可能有效能問題，需要後續實作虛擬捲動
2. **搜尋範圍**：目前無法限制只搜尋分頁或只搜尋書籤
3. **模糊搜尋**：不支援錯字容錯或部分匹配打分
4. **完整 URL 搜尋**：目前只比對 domain，不包含路徑和參數

## 10. 技術規格總結

| 項目 | 說明 |
|------|------|
| 搜尋邏輯 | 多關鍵字 OR 搜尋，支援標題與 URL |
| Debounce 延遲 | 300ms |
| 文字高亮 | `<mark>` 標籤，區分 title-match 和 url-match（待實作） |
| 結果計數 | 即時更新，支援 i18n |
| 清除按鈕 | 絕對定位於搜尋框右側 |
| 主要檔案 | `modules/searchManager.js` (150+ 行) |
| i18n 語言 | 繁體中文、English |
| 瀏覽器相容性 | Chrome Manifest V3 |
