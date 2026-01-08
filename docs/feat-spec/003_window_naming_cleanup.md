# 視窗名稱儲存清理機制 (Window Name Storage Cleanup)

## 1. 背景與問題 (Context)
在「視窗命名功能」中，我們使用 `windowNames` (Map) 來儲存 Window ID 與使用者自定義名稱的對應關係。
由於 Chrome 的 Window ID 是 Session-specific 的整數，當視窗關閉或瀏覽器重啟後，舊的 ID 即失效。
目前系統只會新增與更新名稱，缺乏刪除機制。長期下來，`storage.local` 會累積大量無效的「幽靈視窗」資料，造成資源浪費。

## 2. 目標 (Goals)
*   **自動清理**: 當視窗關閉時，自動移除對應的自定義名稱。
*   **自我修復**: 在擴充功能啟動時，自動掃描並移除所有無效的歷史資料。

## 3. 解決方案 (Proposed Solution)

### A. 即時清理 (Runtime Cleanup)
利用 Chrome 的事件監聽機制，在視窗關閉的當下進行清理。

*   **觸發時機**: `chrome.windows.onRemoved` 事件觸發時。
*   **執行動作**: 呼叫 `stateManager.removeWindowName(windowId)` 移除該 ID 的名稱紀錄。
*   **實作位置**: `sidepanel.js` 中的事件監聽區塊。

### B. 啟動同步 (Startup Synchronization / Pruning)
為了處理「非正常關閉」(如瀏覽器崩潰) 或「擴充功能更新後重啟」導致 `onRemoved` 事件未被捕獲的情況，需要在啟動時進行一次全盤檢查。

*   **觸發時機**: `sidepanel.js` 的 `initialize()` 階段，在 `state.initWindowNames()` 之後。
*   **執行動作**:
    1.  呼叫 `chrome.windows.getAll()` 取得當前所有活動中的視窗 ID 列表。
    2.  遍歷 `windowNames` 中所有的 Key (Stored Window IDs)。
    3.  若某個 Key 不在活動視窗列表中，則判定為過期資料，予以刪除。
    4.  若有資料被刪除，更新 Storage。
*   **實作位置**: `modules/stateManager.js` 新增 `pruneWindowNames(currentWindowIds)` 方法。

## 4. 實作細節 (Implementation Details)

### `stateManager.js` API 變更
```javascript
// 新增移除單一視窗名稱的方法
export async function removeWindowName(windowId) {
    if (windowNames[windowId]) {
        delete windowNames[windowId];
        await _saveWindowNames();
    }
}

// 新增清理過期視窗名稱的方法
export async function pruneWindowNames() {
    const allWindows = await chrome.windows.getAll();
    const activeWindowIds = new Set(allWindows.map(w => w.id.toString())); // 確保型別一致
    
    let changed = false;
    Object.keys(windowNames).forEach(storedId => {
        if (!activeWindowIds.has(storedId.toString())) {
            delete windowNames[storedId];
            changed = true;
        }
    });

    if (changed) {
        await _saveWindowNames();
        console.log('Pruned stale window names');
    }
}
```

### `sidepanel.js` 整合
```javascript
// 在 initialize() 中
await state.initWindowNames();
await state.pruneWindowNames(); // 新增同步步驟

// 在 addEventListeners() 中
chrome.windows.onRemoved.addListener(async (windowId) => {
    await state.removeWindowName(windowId); // 新增清理呼叫
    updateTabList();
});
```
