# 效能模式

Chrome 擴充功能程式碼審查時的效能最佳實踐。

## DOM 操作

### ❌ 避免

```javascript
// 多次 DOM 操作
items.forEach(item => {
  container.appendChild(createItemElement(item));
});
```

### ✅ 建議

```javascript
// 使用 DocumentFragment 批次操作
const fragment = document.createDocumentFragment();
items.forEach(item => {
  fragment.appendChild(createItemElement(item));
});
container.appendChild(fragment);
```

## 事件處理

### ❌ 避免

```javascript
// 為每個元素綁定事件
items.forEach(item => {
  item.addEventListener('click', handleClick);
});
```

### ✅ 建議

```javascript
// 使用事件委派
container.addEventListener('click', (e) => {
  if (e.target.matches('.item')) {
    handleClick(e);
  }
});
```

## 非同步操作

### ❌ 避免

```javascript
// 序列請求
const tab1 = await chrome.tabs.get(id1);
const tab2 = await chrome.tabs.get(id2);
```

### ✅ 建議

```javascript
// 平行請求
const [tab1, tab2] = await Promise.all([
  chrome.tabs.get(id1),
  chrome.tabs.get(id2)
]);
```

## 記憶體管理

- 移除不再需要的事件監聽器
- 避免在閉包中保留大型物件的引用
- 使用 WeakMap/WeakSet 儲存 DOM 元素的關聯資料

## Chrome API 最佳化

- 批次處理 `chrome.tabs.query()` 而非多次呼叫
- 使用 `chrome.storage.local` 的批次 get/set
- 避免在 background service worker 中保留狀態
