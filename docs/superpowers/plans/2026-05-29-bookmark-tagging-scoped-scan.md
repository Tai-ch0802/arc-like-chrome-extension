# 批 A：書籤貼標籤 + 局部目錄掃描 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓使用者能對單一書籤指派／移除標籤並在書籤列看見，並能限定資料夾範圍做重複／死連結掃描。

**Architecture:** 純邏輯（範圍過濾、標籤差集、scope 化掃描）抽成可單元測試的純函式；UI 以共用 `tagPicker` 元件接到兩個入口（書籤右鍵 popover、編輯對話框），書籤列以彩色圓點顯示標籤；局部掃描透過新 `getBookmarkCacheUnderFolder` 與工具對話框的範圍選擇器。資料層 `tagManager.js` 不動。

**Tech Stack:** Vanilla JS ESM modules、Chrome Extension MV3 API、Jest（單元 `.mjs` + Puppeteer E2E）、esbuild transform。

**測試指令：**
- 單元：`npm run test:unit`（`usecase_tests/unit_tests/*.test.mjs`，node env，純邏輯）
- E2E：`npm test`（`usecase_tests/puppeteer_tests/`，需先 `make` 產出載入用目錄；E2E 直接載入專案根目錄）
- 建置：`make`（dev zip）

**前置：** 已在分支 `feat/bookmark-tagging-scoped-scan`。

---

## 檔案結構（本批新增／修改）

| 檔案 | 角色 | 動作 |
|------|------|------|
| `modules/bookmark/bookmarkUtils.js` | 新增純函式 `filterBookmarksUnderFolder` | 修改 |
| `modules/bookmark/dedupe.js` | `findDuplicates` 加可選 `items` 參數 | 修改 |
| `modules/stateManager.js` | 新增 `getBookmarkCacheUnderFolder` | 修改 |
| `modules/bookmark/tagPicker.js` | 共用標籤選取元件 + 純函式 `diffTagSelection` | 新增 |
| `modules/modalManager.js` | `showFormDialog` 支援 `type:'custom'` 欄位；抽 `pickFolder` | 修改 |
| `modules/ui/bookmarkContextMenu.js` | 書籤／資料夾右鍵選單 | 新增 |
| `modules/ui/bookmarkRenderer.js` | contextmenu 委派、書籤列標籤圓點、編輯對話框標籤欄位 | 修改 |
| `modules/bookmark/bookmarkToolsUI.js` | 範圍選擇器、scope 化掃描、scopeFolderId 入口 | 修改 |
| `_locales/*/messages.json` | 新增 UI 字串 | 修改 |
| `sidepanel.css` | 標籤圓點、scope 列、popover 樣式 | 修改 |
| `usecase_tests/unit_tests/bookmarkScope.test.mjs` | `filterBookmarksUnderFolder` 單元測試 | 新增 |
| `usecase_tests/unit_tests/dedupeScope.test.mjs` | `findDuplicates(items)` 單元測試 | 新增 |
| `usecase_tests/unit_tests/tagPicker.test.mjs` | `diffTagSelection` 單元測試 | 新增 |
| `usecase_tests/puppeteer_tests/happy_path_bookmark_tagging.test.js` | 貼標籤 E2E | 新增 |
| `usecase_tests/puppeteer_tests/happy_path_scoped_scan.test.js` | 局部掃描 E2E | 新增 |

---

## Task 1: 純函式 `filterBookmarksUnderFolder`

**Files:**
- Modify: `modules/bookmark/bookmarkUtils.js`（檔尾新增 export）
- Test: `usecase_tests/unit_tests/bookmarkScope.test.mjs`（新增）

- [ ] **Step 1: 寫失敗測試**

新增 `usecase_tests/unit_tests/bookmarkScope.test.mjs`：

```js
import { filterBookmarksUnderFolder } from '../../modules/bookmark/bookmarkUtils.js';

// 模擬 stateManager 的扁平快取結構：{ id, title, url, parentId, type }
const CACHE = [
  { id: 'F1', type: 'folder', parentId: '1' },
  { id: 'b1', type: 'bookmark', url: 'https://a.com', parentId: 'F1' },
  { id: 'F2', type: 'folder', parentId: 'F1' },          // F1 的子資料夾
  { id: 'b2', type: 'bookmark', url: 'https://b.com', parentId: 'F2' },
  { id: 'F3', type: 'folder', parentId: '1' },           // 另一棵
  { id: 'b3', type: 'bookmark', url: 'https://c.com', parentId: 'F3' },
];

describe('filterBookmarksUnderFolder', () => {
  it('收集資料夾子樹（含巢狀）內的書籤', () => {
    const ids = filterBookmarksUnderFolder(CACHE, 'F1').map(b => b.id).sort();
    expect(ids).toEqual(['b1', 'b2']);
  });

  it('不含其他資料夾的書籤', () => {
    const ids = filterBookmarksUnderFolder(CACHE, 'F3').map(b => b.id);
    expect(ids).toEqual(['b3']);
  });

  it('空資料夾回傳空陣列', () => {
    const ids = filterBookmarksUnderFolder(CACHE, 'F2-empty');
    expect(ids).toEqual([]);
  });

  it('無 folderId 回傳全部書籤（不含資料夾節點）', () => {
    const ids = filterBookmarksUnderFolder(CACHE, null).map(b => b.id).sort();
    expect(ids).toEqual(['b1', 'b2', 'b3']);
  });

  it('cache 非陣列時防禦回傳空陣列', () => {
    expect(filterBookmarksUnderFolder(null, 'F1')).toEqual([]);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npm run test:unit -- bookmarkScope`
Expected: FAIL（`filterBookmarksUnderFolder is not a function`）

- [ ] **Step 3: 實作**

在 `modules/bookmark/bookmarkUtils.js` 檔尾新增（不更動既有 `bulkRemove`）：

```js
/**
 * 從扁平書籤快取中，取出指定資料夾子樹（含巢狀子資料夾）下的所有書籤。
 * @param {Array<{id:string,type:string,parentId:string}>} cache 扁平快取
 * @param {string|null|undefined} folderId 省略/falsy 時回傳全部書籤
 * @returns {Array} 僅 type==='bookmark' 的項目
 */
export function filterBookmarksUnderFolder(cache, folderId) {
    if (!Array.isArray(cache)) return [];
    if (!folderId) return cache.filter(i => i.type === 'bookmark');

    const childrenByParent = new Map();
    for (const item of cache) {
        const p = String(item.parentId ?? '');
        if (!childrenByParent.has(p)) childrenByParent.set(p, []);
        childrenByParent.get(p).push(item);
    }

    const result = [];
    const seen = new Set();
    const stack = [String(folderId)];
    while (stack.length) {
        const pid = stack.pop();
        if (seen.has(pid)) continue; // 防禦環狀
        seen.add(pid);
        for (const child of (childrenByParent.get(pid) || [])) {
            if (child.type === 'bookmark') result.push(child);
            else stack.push(String(child.id)); // 子資料夾 → 繼續往下
        }
    }
    return result;
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npm run test:unit -- bookmarkScope`
Expected: PASS（5 passed）

- [ ] **Step 5: Commit**

```bash
git add modules/bookmark/bookmarkUtils.js usecase_tests/unit_tests/bookmarkScope.test.mjs
git commit -m "feat(bookmark): add filterBookmarksUnderFolder for scoped scans"
```

---

## Task 2: `findDuplicates` 支援 scope

**Files:**
- Modify: `modules/bookmark/dedupe.js:25-26`
- Test: `usecase_tests/unit_tests/dedupeScope.test.mjs`（新增）

- [ ] **Step 1: 寫失敗測試**

新增 `usecase_tests/unit_tests/dedupeScope.test.mjs`：

```js
import { findDuplicates } from '../../modules/bookmark/dedupe.js';

describe('findDuplicates(items)', () => {
  it('傳入限定清單時只在該清單內找重複', () => {
    const items = [
      { id: '1', type: 'bookmark', title: 'A', url: 'https://x.com/p', parentId: 'F1' },
      { id: '2', type: 'bookmark', title: 'A2', url: 'https://x.com/p#frag', parentId: 'F1' },
      { id: '3', type: 'bookmark', title: 'B', url: 'https://y.com', parentId: 'F2' },
    ];
    const groups = findDuplicates(items);
    expect(groups.length).toBe(1);
    expect(groups[0].bookmarks.map(b => b.id).sort()).toEqual(['1', '2']);
  });

  it('無重複時回傳空陣列', () => {
    const items = [
      { id: '1', type: 'bookmark', title: 'A', url: 'https://x.com', parentId: 'F1' },
      { id: '2', type: 'bookmark', title: 'B', url: 'https://y.com', parentId: 'F1' },
    ];
    expect(findDuplicates(items)).toEqual([]);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npm run test:unit -- dedupeScope`
Expected: FAIL（傳入的 items 被忽略，仍讀空的 state cache → group 數不符 / 可能拋錯）

- [ ] **Step 3: 實作**

`modules/bookmark/dedupe.js` 第 22-26 行的函式簽名與首行改為：

```js
/**
 * @param {Array=} items 可選的限定書籤清單；省略時讀整個書籤快取。
 * @returns {DuplicateGroup[]} Groups with 2+ bookmarks each, sorted by group size desc.
 */
export function findDuplicates(items) {
    const cache = items || state.getBookmarkCache() || [];
```

（其餘函式內容不變。）

- [ ] **Step 4: 跑測試確認通過**

Run: `npm run test:unit -- dedupeScope`
Expected: PASS（2 passed）

- [ ] **Step 5: Commit**

```bash
git add modules/bookmark/dedupe.js usecase_tests/unit_tests/dedupeScope.test.mjs
git commit -m "feat(bookmark): allow findDuplicates to scope to a given list"
```

---

## Task 3: `stateManager.getBookmarkCacheUnderFolder`

**Files:**
- Modify: `modules/stateManager.js`（新增 import + export；放在既有 `getBookmarkCache` 附近，約 `:522`）

- [ ] **Step 1: 加 import**

在 `modules/stateManager.js` 既有 import 區塊新增：

```js
import { filterBookmarksUnderFolder } from './bookmark/bookmarkUtils.js';
```

（確認無循環依賴：`bookmarkUtils.js` 只 import `apiManager`，不 import `stateManager`。）

- [ ] **Step 2: 新增 export**

在 `getBookmarkCache`（約 `:522`）下方新增：

```js
/**
 * 取得指定資料夾子樹下的所有書籤（供局部掃描用）。
 * @param {string|null} folderId
 * @returns {Array}
 */
export function getBookmarkCacheUnderFolder(folderId) {
    return filterBookmarksUnderFolder(bookmarkCache, folderId);
}
```

- [ ] **Step 3: 驗證載入無誤**

Run: `node --input-type=module -e "import('./modules/stateManager.js').then(()=>console.log('OK')).catch(e=>{console.error(e);process.exit(1)})"`
Expected: 輸出 `OK`（確認 import 無循環、無語法錯）。若失敗請檢查 import 路徑。

> 純邏輯已由 Task 1 的單元測試覆蓋；本包裝函式由 Task 11 的 E2E 驗證實際行為。

- [ ] **Step 4: Commit**

```bash
git add modules/stateManager.js
git commit -m "feat(state): expose getBookmarkCacheUnderFolder"
```

---

## Task 4: 純函式 `diffTagSelection`

**Files:**
- Create: `modules/bookmark/tagPicker.js`（先只放純函式，Task 5 再加 UI）
- Test: `usecase_tests/unit_tests/tagPicker.test.mjs`（新增）

- [ ] **Step 1: 寫失敗測試**

新增 `usecase_tests/unit_tests/tagPicker.test.mjs`：

```js
import { diffTagSelection } from '../../modules/bookmark/tagPicker.js';

describe('diffTagSelection', () => {
  it('算出要新增與要移除的標籤', () => {
    const { toAdd, toRemove } = diffTagSelection(['t1', 't2'], ['t2', 't3']);
    expect(toAdd).toEqual(['t3']);
    expect(toRemove).toEqual(['t1']);
  });

  it('無變更時兩者皆空', () => {
    const { toAdd, toRemove } = diffTagSelection(['t1'], ['t1']);
    expect(toAdd).toEqual([]);
    expect(toRemove).toEqual([]);
  });

  it('原本為空時全部都是新增', () => {
    expect(diffTagSelection([], ['a', 'b'])).toEqual({ toAdd: ['a', 'b'], toRemove: [] });
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npm run test:unit -- tagPicker`
Expected: FAIL（找不到模組／函式）

- [ ] **Step 3: 實作**

新增 `modules/bookmark/tagPicker.js`：

```js
/**
 * Tag Picker — 共用的「標籤勾選」元件與其純邏輯。
 * 元件只負責呈現與回傳選取狀態，寫入由呼叫端決定（單一職責）。
 */

/**
 * 比較原本與選取後的標籤集合，算出差異。
 * @param {string[]} original 原本已貼的 tagId
 * @param {string[]} selected 使用者選取後的 tagId
 * @returns {{toAdd: string[], toRemove: string[]}}
 */
export function diffTagSelection(original, selected) {
    const o = new Set(original);
    const s = new Set(selected);
    return {
        toAdd: selected.filter(id => !o.has(id)),
        toRemove: original.filter(id => !s.has(id)),
    };
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npm run test:unit -- tagPicker`
Expected: PASS（3 passed）

- [ ] **Step 5: Commit**

```bash
git add modules/bookmark/tagPicker.js usecase_tests/unit_tests/tagPicker.test.mjs
git commit -m "feat(bookmark): add diffTagSelection pure helper"
```

---

## Task 5: `createTagPicker` UI 元件

**Files:**
- Modify: `modules/bookmark/tagPicker.js`（加 UI 工廠函式）

- [ ] **Step 1: 實作元件**

在 `modules/bookmark/tagPicker.js` 加上 import 與工廠函式：

```js
import * as tagManager from './tagManager.js';
import * as modal from '../modalManager.js';
import * as api from '../apiManager.js';

/**
 * 建立一個標籤勾選清單元件。
 * @param {string[]} initialTagIds 預先勾選的 tagId
 * @returns {{ element: HTMLElement, getSelectedTagIds: () => string[] }}
 */
export function createTagPicker(initialTagIds = []) {
    const selected = new Set(initialTagIds);

    const root = document.createElement('div');
    root.className = 'tag-picker';

    const list = document.createElement('div');
    list.className = 'tag-picker__list';
    root.appendChild(list);

    function addRow(tag) {
        const row = document.createElement('label');
        row.className = 'tag-picker__row';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = tag.id;
        cb.checked = selected.has(tag.id);
        cb.addEventListener('change', () => {
            if (cb.checked) selected.add(tag.id); else selected.delete(tag.id);
            root.dispatchEvent(new CustomEvent('tagselectionchange', {
                detail: { tagId: tag.id, checked: cb.checked },
            }));
        });
        const chip = document.createElement('span');
        chip.className = 'bm-tools__tag-chip';
        chip.dataset.color = tag.color;
        chip.textContent = tag.name;
        row.appendChild(cb);
        row.appendChild(chip);
        list.appendChild(row);
    }

    for (const tag of tagManager.getAllTags()) addRow(tag);

    const createBtn = document.createElement('button');
    createBtn.type = 'button';
    createBtn.className = 'tag-picker__create';
    createBtn.textContent = api.getMessage('bmToolsCreateTag') || '+ New tag';
    createBtn.addEventListener('click', async () => {
        const name = await modal.showPrompt({
            title: api.getMessage('bmToolsCreateTagPrompt') || 'New tag name',
            defaultValue: '',
        });
        if (!name || !name.trim()) return;
        const tag = await tagManager.createTag({ name: name.trim() });
        selected.add(tag.id);
        addRow(tag);
        const lastRow = list.lastElementChild;
        if (lastRow) lastRow.querySelector('input').checked = true;
    });
    root.appendChild(createBtn);

    return {
        element: root,
        getSelectedTagIds: () => Array.from(selected),
    };
}
```

> 註：`createTagPicker` 觸及 DOM 與 `modalManager`，不在 node 單元測試覆蓋範圍；其行為由 Task 14 的 E2E 驗證。`diffTagSelection` 已單元覆蓋。

- [ ] **Step 2: 驗證語法**

Run: `node --input-type=module -e "import('./modules/bookmark/tagPicker.js').then(()=>console.log('OK')).catch(e=>{console.error(e);process.exit(1)})"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add modules/bookmark/tagPicker.js
git commit -m "feat(bookmark): add createTagPicker UI component"
```

---

## Task 6: `showFormDialog` 支援 `type:'custom'` 欄位

**Files:**
- Modify: `modules/modalManager.js:210-284`（`showFormDialog`）

- [ ] **Step 1: 實作 custom 欄位分支**

在 `showFormDialog` 的 `fields.forEach` 迴圈內，於 `if (field.type === 'select')` 之前新增分支，並收集 custom getter：

在 `fields.forEach(field => {` 上方先宣告：

```js
        const customGetters = {}; // name → getValue()
```

在迴圈最前面加：

```js
            if (field.type === 'custom') {
                const { element, getValue } = field.render();
                element.dataset.fieldName = field.name;
                form.appendChild(element);
                customGetters[field.name] = getValue;
                return; // 跳過後續 select/text 處理
            }
```

接著在 `form.onsubmit` 的結果組裝（`for (const [name, value] of formData.entries())` 之後、`cleanupAndResolve(result)` 之前）併入 custom 值：

```js
            for (const [name, getValue] of Object.entries(customGetters)) {
                result[name] = getValue();
            }
```

- [ ] **Step 2: 驗證語法**

Run: `node --input-type=module -e "import('./modules/modalManager.js').then(()=>console.log('OK')).catch(e=>{console.error(e);process.exit(1)})"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add modules/modalManager.js
git commit -m "feat(modal): support custom field type in showFormDialog"
```

---

## Task 7: 書籤列顯示標籤圓點

**Files:**
- Modify: `modules/ui/bookmarkRenderer.js`（`updateBookmarkElement`，約 `:389`，及 import）

- [ ] **Step 1: 加 import**

`modules/ui/bookmarkRenderer.js` 頂部 import 區新增：

```js
import * as tagManager from '../bookmark/tagManager.js';
```

- [ ] **Step 2: 在 updateBookmarkElement 渲染標籤圓點**

在 `updateBookmarkElement` 內、「Linked Tabs Icon」區塊之前，新增標籤圓點同步邏輯：

```js
    // Tag dots — reflect tags assigned to this bookmark.
    let tagContainer = item.querySelector('.bookmark-tags');
    const tags = tagManager.getTagsForBookmark(node.id);
    if (tags.length > 0) {
        if (!tagContainer) {
            tagContainer = document.createElement('span');
            tagContainer.className = 'bookmark-tags';
            // 放在標題 wrapper 之後、actions 之前
            const actions = item.querySelector('.bookmark-actions');
            item.insertBefore(tagContainer, actions);
        }
        tagContainer.innerHTML = '';
        for (const tag of tags) {
            const dot = document.createElement('span');
            dot.className = 'bookmark-tag-dot';
            dot.dataset.color = tag.color;
            dot.title = tag.name;
            tagContainer.appendChild(dot);
        }
    } else if (tagContainer) {
        tagContainer.remove();
    }
```

- [ ] **Step 3: 驗證語法**

Run: `node --input-type=module -e "import('./modules/ui/bookmarkRenderer.js').then(()=>console.log('OK')).catch(e=>{console.error(e);process.exit(1)})"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add modules/ui/bookmarkRenderer.js
git commit -m "feat(bookmark): render tag dots on bookmark rows"
```

---

## Task 8: 書籤／資料夾右鍵選單

**Files:**
- Create: `modules/ui/bookmarkContextMenu.js`
- Modify: `modules/ui/bookmarkRenderer.js`（`initBookmarkListeners` 加 contextmenu 委派）

- [ ] **Step 1: 建立選單模組**

新增 `modules/ui/bookmarkContextMenu.js`：

```js
/**
 * 書籤／資料夾的自訂右鍵選單。與分頁用的 contextMenuManager 分開，
 * 避免兩種情境耦合；沿用相同的 .custom-context-menu / .context-menu-item 樣式。
 */
import * as api from '../apiManager.js';
import * as tagManager from '../bookmark/tagManager.js';
import { createTagPicker, diffTagSelection } from '../bookmark/tagPicker.js';

/**
 * @param {number} x @param {number} y
 * @param {{id:string,url?:string,title?:string,isFolder:boolean}} node
 * @param {HTMLElement} originElement
 * @param {{ onScanFolder?: (folderId:string, tool:'duplicates'|'deadLinks')=>void,
 *           onTagsChanged?: (bookmarkId:string)=>void }} handlers
 */
export function showBookmarkContextMenu(x, y, node, originElement, handlers = {}) {
    document.querySelector('.custom-context-menu')?.remove();

    const menu = document.createElement('div');
    menu.className = 'custom-context-menu';
    menu.setAttribute('role', 'menu');
    menu.tabIndex = -1;
    if (x + 180 > window.innerWidth) x = window.innerWidth - 190;
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    const addItem = (label, onClick) => {
        const el = document.createElement('div');
        el.className = 'context-menu-item';
        el.setAttribute('role', 'menuitem');
        el.tabIndex = 0;
        el.innerHTML = `<span>${label}</span>`;
        el.addEventListener('click', (e) => { e.stopPropagation(); onClick(el); });
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); onClick(el); }
            else if (e.key === 'Escape') { e.preventDefault(); closeMenu(); }
        });
        menu.appendChild(el);
        return el;
    };

    if (node.isFolder) {
        addItem(api.getMessage('bmCtxScanDuplicates') || 'Find duplicates here',
            () => { handlers.onScanFolder?.(node.id, 'duplicates'); closeMenu(); });
        addItem(api.getMessage('bmCtxScanDeadLinks') || 'Check dead links here',
            () => { handlers.onScanFolder?.(node.id, 'deadLinks'); closeMenu(); });
    } else {
        if (node.url) {
            addItem(api.getMessage('copyUrl') || 'Copy URL', async (el) => {
                try { await navigator.clipboard.writeText(node.url); } catch {}
                closeMenu();
            });
        }
        addItem(api.getMessage('bmCtxManageTags') || 'Manage tags', (el) => {
            openTagPopover(el);
        });
    }

    document.body.appendChild(menu);
    menu.querySelector('.context-menu-item')?.focus();

    function openTagPopover(anchorEl) {
        // 將管理標籤展開為一個就地的勾選清單；勾選即時寫入。
        const original = tagManager.getTagsForBookmark(node.id).map(t => t.id);
        const picker = createTagPicker(original);
        picker.element.classList.add('tag-picker--popover');
        picker.element.addEventListener('tagselectionchange', async (e) => {
            const { tagId, checked } = e.detail;
            if (checked) await tagManager.addTagToBookmark(node.id, tagId);
            else await tagManager.removeTagFromBookmark(node.id, tagId);
            handlers.onTagsChanged?.(node.id);
        });
        menu.innerHTML = '';
        menu.appendChild(picker.element);
        picker.element.querySelector('input, button')?.focus();
    }

    function closeMenu() {
        menu.remove();
        document.removeEventListener('click', closeMenu);
        document.removeEventListener('contextmenu', handleOutside);
        if (originElement) originElement.focus();
    }
    function handleOutside(e) { if (!menu.contains(e.target)) closeMenu(); }
    setTimeout(() => {
        document.addEventListener('click', closeMenu);
        document.addEventListener('contextmenu', handleOutside);
    }, 0);
}
```

- [ ] **Step 2: 在 bookmarkRenderer 委派 contextmenu**

`modules/ui/bookmarkRenderer.js` 頂部新增 import：

```js
import { showBookmarkContextMenu } from './bookmarkContextMenu.js';
import { openBookmarkToolsDialog } from '../bookmark/bookmarkToolsUI.js';
```

在 `initBookmarkListeners`（約 `:167`）內、`container.addEventListener('keydown'...)` 之前新增 contextmenu 委派：

```js
    container.addEventListener('contextmenu', async (e) => {
        const bookmarkEl = e.target.closest('.bookmark-item');
        const folderEl = e.target.closest('.bookmark-folder');
        const targetEl = bookmarkEl || folderEl;
        if (!targetEl) return; // 空白處 → 用瀏覽器預設
        e.preventDefault();
        const id = targetEl.dataset.bookmarkId;
        const node = await api.getBookmark(id).catch(() => null);
        if (!node) return;
        showBookmarkContextMenu(e.clientX, e.clientY, {
            id,
            url: node.url,
            title: node.title,
            isFolder: !node.url,
        }, targetEl, {
            onTagsChanged: () => { if (currentRefreshCallback) currentRefreshCallback(); },
            onScanFolder: (folderId, tool) => openBookmarkToolsDialog(tool, { scopeFolderId: folderId }),
        });
    }, { signal });
```

- [ ] **Step 3: 驗證語法**

Run: `node --input-type=module -e "import('./modules/ui/bookmarkContextMenu.js').then(()=>console.log('OK')).catch(e=>{console.error(e);process.exit(1)})"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add modules/ui/bookmarkContextMenu.js modules/ui/bookmarkRenderer.js
git commit -m "feat(bookmark): right-click menu for tag assignment and folder scan"
```

---

## Task 9: 編輯書籤對話框加標籤欄位

**Files:**
- Modify: `modules/ui/bookmarkRenderer.js:188-204`（`edit-bookmark` action）

- [ ] **Step 1: 加 import**

頂部新增：

```js
import { createTagPicker, diffTagSelection } from '../bookmark/tagPicker.js';
```

- [ ] **Step 2: 改寫 edit-bookmark 區塊**

將 `:188-204` 的 `edit-bookmark` 分支整段替換為：

```js
            if (action === 'edit-bookmark') {
                try {
                    const node = await api.getBookmark(id);
                    if (!node) return;
                    const originalTagIds = tagManager.getTagsForBookmark(id).map(t => t.id);
                    let picker;
                    const result = await modal.showFormDialog({
                        title: api.getMessage("editBookmarkPromptForTitle"),
                        fields: [
                            { name: 'title', label: 'Name', defaultValue: node.title },
                            { name: 'url', label: 'URL', defaultValue: node.url },
                            {
                                name: 'tags',
                                type: 'custom',
                                render: () => {
                                    picker = createTagPicker(originalTagIds);
                                    return { element: picker.element, getValue: () => picker.getSelectedTagIds() };
                                },
                            },
                        ],
                        confirmButtonText: api.getMessage("saveButton")
                    });
                    if (result) {
                        if (result.title !== node.title || result.url !== node.url) {
                            await api.updateBookmark(id, { title: result.title, url: result.url });
                        }
                        const { toAdd, toRemove } = diffTagSelection(originalTagIds, result.tags || []);
                        for (const t of toAdd) await tagManager.addTagToBookmark(id, t);
                        for (const t of toRemove) await tagManager.removeTagFromBookmark(id, t);
                        handleRefresh();
                    }
                } catch (err) { console.error(err); }
            } else if (action === 'delete-bookmark') {
```

（注意：保留原本 `else if (action === 'delete-bookmark')` 起的後續分支不變，只替換到該 `else if` 之前。）

- [ ] **Step 3: 驗證語法**

Run: `node --input-type=module -e "import('./modules/ui/bookmarkRenderer.js').then(()=>console.log('OK')).catch(e=>{console.error(e);process.exit(1)})"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add modules/ui/bookmarkRenderer.js
git commit -m "feat(bookmark): manage tags from edit bookmark dialog"
```

---

## Task 10: 工具對話框範圍選擇器 + `pickFolder`

**Files:**
- Modify: `modules/modalManager.js`（抽出 `pickFolder` 可重用函式）
- Modify: `modules/bookmark/bookmarkToolsUI.js`（scope 狀態、範圍列、scope 化掃描）

- [ ] **Step 1: 在 modalManager 新增 `pickFolder`**

`modules/modalManager.js` 檔尾新增（複用既有資料夾樹渲染概念，回傳所選資料夾）：

```js
/**
 * 顯示一個資料夾選擇對話框，回傳 { id, path } 或 null。
 * 第一個選項固定為「全部」(id: null)。
 */
export function pickFolder({ title } = {}) {
    return new Promise(async (resolve) => {
        const form = document.createElement('form');
        form.className = 'add-bookmark-form';
        let selected = { id: null, path: api.getMessage('bmToolsScopeAll') || 'All bookmarks' };
        let selectedEl = null;

        const tree = await api.getBookmarkTree();
        const rootFolders = tree[0]?.children || [];

        form.innerHTML = `
            <h3 class="modal-title">${escapeHtml(title || api.getMessage('bmToolsChangeScope') || 'Choose folder')}</h3>
            <div class="modal-location-path"></div>
            <div class="modal-bookmark-tree"></div>
            <div class="modal-buttons">
                <button type="button" class="modal-button cancel-btn">${api.getMessage('cancelButton') || 'Cancel'}</button>
                <button type="submit" class="modal-button confirm-btn primary">${api.getMessage('confirmButton') || api.getMessage('saveButton') || 'OK'}</button>
            </div>`;

        const pathDiv = form.querySelector('.modal-location-path');
        const treeContainer = form.querySelector('.modal-bookmark-tree');
        pathDiv.textContent = selected.path;

        const pick = (id, path, el) => {
            selected = { id, path };
            pathDiv.textContent = path;
            if (selectedEl) selectedEl.classList.remove('selected');
            el.classList.add('selected');
            selectedEl = el;
        };

        // 「全部」列
        const allItem = document.createElement('div');
        allItem.className = 'bookmark-folder selected';
        allItem.tabIndex = 0;
        allItem.setAttribute('role', 'button');
        allItem.innerHTML = `<span class="bookmark-icon">▼</span><span class="bookmark-title">${escapeHtml(selected.path)}</span>`;
        allItem.addEventListener('click', () => pick(null, allItem.querySelector('.bookmark-title').textContent, allItem));
        treeContainer.appendChild(allItem);
        selectedEl = allItem;

        const renderFolders = (nodes, container, parentPath) => {
            nodes.forEach(node => {
                if (!node.children) return;
                const folderItem = document.createElement('div');
                folderItem.className = 'bookmark-folder';
                folderItem.dataset.bookmarkId = node.id;
                folderItem.tabIndex = 0;
                folderItem.setAttribute('role', 'button');
                const title = node.title || api.getMessage('bookmarksBar') || 'Bookmarks Bar';
                folderItem.innerHTML = `<span class="bookmark-icon">▼</span><span class="bookmark-title">${escapeHtml(title)}</span>`;
                const newPath = parentPath ? `${parentPath} / ${title}` : title;
                folderItem.addEventListener('click', () => pick(node.id, newPath, folderItem));
                container.appendChild(folderItem);
                const childBox = document.createElement('div');
                childBox.className = 'folder-content';
                childBox.style.display = 'block';
                container.appendChild(childBox);
                if (node.children.length) renderFolders(node.children, childBox, newPath);
            });
        };
        renderFolders(rootFolders, treeContainer, '');

        const { overlay, modalContent } = createModal(form);
        const cancelBtn = modalContent.querySelector('.cancel-btn');
        const done = (v) => { removeModal(overlay); resolve(v); };
        form.onsubmit = (e) => { e.preventDefault(); done(selected); };
        cancelBtn.onclick = () => done(null);
        overlay.onclick = (e) => { if (e.target === overlay) done(null); };
    });
}
```

- [ ] **Step 2: bookmarkToolsUI 加入 scope**

`modules/bookmark/bookmarkToolsUI.js`：

(a) 頂部 import 補上 `pickFolder`：把第 12 行改為
```js
import * as modal from '../modalManager.js';
```
已存在；新增使用 `modal.pickFolder`。

(b) 改 `openBookmarkToolsDialog` 簽名與 scope 狀態（替換 `:22-59`）：

```js
let currentScope = { id: null, path: '' };

export function openBookmarkToolsDialog(initialTab = 'tags', { scopeFolderId = null } = {}) {
    currentScope = { id: scopeFolderId, path: '' };

    const container = document.createElement('div');
    container.className = 'bm-tools';

    // 範圍列（僅對 duplicates / deadLinks 有意義）
    const scopeBar = document.createElement('div');
    scopeBar.className = 'bm-tools__scope';
    const scopeLabel = document.createElement('span');
    scopeLabel.className = 'bm-tools__scope-label';
    const scopeBtn = document.createElement('button');
    scopeBtn.className = 'bm-tools__scope-btn';
    scopeBtn.textContent = api.getMessage('bmToolsChangeScope') || 'Change scope';
    scopeBtn.addEventListener('click', async () => {
        const picked = await modal.pickFolder({});
        if (picked) {
            currentScope = { id: picked.id, path: picked.id ? picked.path : '' };
            updateScopeLabel();
            activateTab(getActiveTabName());
        }
    });
    scopeBar.appendChild(scopeLabel);
    scopeBar.appendChild(scopeBtn);
    container.appendChild(scopeBar);

    const tabBar = document.createElement('div');
    tabBar.className = 'bm-tools__tabs';
    const tabButtons = {};
    for (const tab of TABS) {
        const btn = document.createElement('button');
        btn.className = 'bm-tools__tab-btn';
        btn.dataset.tab = tab;
        btn.textContent = api.getMessage('bmTools' + capitalize(tab) + 'Tab') || tab;
        btn.addEventListener('click', () => activateTab(tab));
        tabBar.appendChild(btn);
        tabButtons[tab] = btn;
    }
    container.appendChild(tabBar);

    const content = document.createElement('div');
    content.className = 'bm-tools__content';
    container.appendChild(content);

    let activeTabName = 'tags';
    function getActiveTabName() { return activeTabName; }

    function updateScopeLabel() {
        const count = currentScope.id
            ? state.getBookmarkCacheUnderFolder(currentScope.id).length
            : (state.getBookmarkCache() || []).filter(b => b.type === 'bookmark').length;
        const scopeName = currentScope.id
            ? (currentScope.path || api.getMessage('bmToolsScopeFolder') || 'Selected folder')
            : (api.getMessage('bmToolsScopeAll') || 'All bookmarks');
        scopeLabel.textContent = (api.getMessage('bmToolsScopeStatus') || 'Scope: {name} ({n})')
            .replace('{name}', scopeName).replace('{n}', String(count));
        // tags tab 與範圍無關 → 隱藏範圍列
        scopeBar.style.display = (activeTabName === 'tags') ? 'none' : 'flex';
    }

    function activateTab(tab) {
        activeTabName = tab;
        for (const t of TABS) tabButtons[t].classList.toggle('active', t === tab);
        content.innerHTML = '';
        if (tab === 'tags') renderTagsView(content);
        else if (tab === 'duplicates') renderDuplicatesView(content, currentScope.id);
        else if (tab === 'deadLinks') renderDeadLinksView(content, currentScope.id);
        updateScopeLabel();
    }

    modal.showCustomDialog({
        title: api.getMessage('bmToolsTitle') || 'Bookmark Tools',
        content: container,
    });
    activateTab(TABS.includes(initialTab) ? initialTab : 'tags');
}
```

(c) `renderDuplicatesView` 改用 scope（`:143`）：

把 `function renderDuplicatesView(root) {` 改為 `function renderDuplicatesView(root, scopeFolderId = null) {`，並把 `const groups = dedupe.findDuplicates();` 改為：
```js
    const items = scopeFolderId
        ? state.getBookmarkCacheUnderFolder(scopeFolderId)
        : undefined;
    const groups = dedupe.findDuplicates(items);
```

(d) `renderDeadLinksView` 改用 scope（`:241`）：

把 `function renderDeadLinksView(root) {` 改為 `function renderDeadLinksView(root, scopeFolderId = null) {`，並把掃描按鈕內取書籤的那段（`:277-282`）改為：
```js
        const cache = scopeFolderId
            ? state.getBookmarkCacheUnderFolder(scopeFolderId)
            : (state.getBookmarkCache() || []);
        const bookmarks = cache.filter(b => b.type === 'bookmark').map(b => ({
            id: String(b.id),
            url: b.url,
            title: b.title || '',
        }));
```
並把該函式內重繪自身的呼叫（`:373` 的 `renderDeadLinksView(root);`）改為 `renderDeadLinksView(root, scopeFolderId);`。

(e) `renderDuplicatesView` 內重繪自身（`:234` 的 `renderDuplicatesView(root);`）改為 `renderDuplicatesView(root, scopeFolderId);`。

- [ ] **Step 3: 驗證語法**

Run: `node --input-type=module -e "import('./modules/bookmark/bookmarkToolsUI.js').then(()=>console.log('OK')).catch(e=>{console.error(e);process.exit(1)})"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add modules/modalManager.js modules/bookmark/bookmarkToolsUI.js
git commit -m "feat(bookmark): scope folder selector in bookmark tools"
```

---

## Task 11: 串接右鍵資料夾 → 限定範圍掃描

> Task 8 已把 `onScanFolder` 接到 `openBookmarkToolsDialog(tool, { scopeFolderId })`，Task 10 已讓對話框依 scope 掃描。本任務只做整合驗證（手動）。

- [ ] **Step 1: 建置並手動驗證**

Run: `make`
然後 `chrome://extensions` → 重新載入未封裝項目 → 開啟側邊欄。

手動檢查清單：
- 在某資料夾上按右鍵 → 出現「找重複／查死連結」。
- 點「找重複」→ 工具對話框開在 duplicates，範圍列顯示該資料夾名稱與筆數。
- 「變更範圍」可切到「全部」或其他資料夾，列表與筆數隨之更新。
- 刪除動作只影響該範圍內的書籤。

- [ ] **Step 2: Commit（若整合中有微調）**

```bash
git add -A && git commit -m "chore(bookmark): wire folder context-menu scan to scoped dialog" --allow-empty
```

---

## Task 12: i18n 字串

**Files:**
- Modify: `_locales/en/messages.json`（先補英文；其餘語系沿用既有補 key 流程）

- [ ] **Step 1: 在 `_locales/en/messages.json` 新增 key**

```json
"bmCtxManageTags": { "message": "Manage tags" },
"bmCtxScanDuplicates": { "message": "Find duplicates in this folder" },
"bmCtxScanDeadLinks": { "message": "Check dead links in this folder" },
"bmToolsChangeScope": { "message": "Change scope" },
"bmToolsScopeAll": { "message": "All bookmarks" },
"bmToolsScopeFolder": { "message": "Selected folder" },
"bmToolsScopeStatus": { "message": "Scope: {name} ({n})" }
```

（`copyUrl`、`bmToolsCreateTag`、`bmToolsCreateTagPrompt`、`cancelButton`、`saveButton`、`confirmButton`、`bookmarksBar` 等沿用既有 key。若 `confirmButton` 不存在則 `pickFolder` 已 fallback 到 `saveButton`。）

- [ ] **Step 2: 補齊其餘語系**

依專案慣例（最近一次 `i18n: fill missing keys`），用既有腳本或 `update-multilingual-docs` 流程把上述 key 補進其餘語系（先以英文佔位，待翻譯）。

Run: `make`（確認載入無 i18n 缺 key 警告）

- [ ] **Step 3: Commit**

```bash
git add _locales/
git commit -m "i18n: add keys for tag assignment and scoped scan"
```

---

## Task 13: CSS 樣式

**Files:**
- Modify: `sidepanel.css`（標籤圓點、tag-picker、scope 列）

- [ ] **Step 1: 新增樣式**

在 `sidepanel.css` 既有 `.bm-tools__tag-chip` 區塊（約 `:3249`）後新增：

```css
/* 書籤列上的標籤圓點 */
.bookmark-tags { display: inline-flex; gap: 3px; align-items: center; margin: 0 6px; }
.bookmark-tag-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.bookmark-tag-dot[data-color="grey"]   { background: #5f6368; }
.bookmark-tag-dot[data-color="blue"]   { background: #1a73e8; }
.bookmark-tag-dot[data-color="red"]    { background: #d93025; }
.bookmark-tag-dot[data-color="yellow"] { background: #f9ab00; }
.bookmark-tag-dot[data-color="green"]  { background: #1e8e3e; }
.bookmark-tag-dot[data-color="pink"]   { background: #f538a0; }
.bookmark-tag-dot[data-color="purple"] { background: #a142f4; }
.bookmark-tag-dot[data-color="cyan"]   { background: #007b83; }

/* Tag picker（編輯對話框內與右鍵 popover 共用） */
.tag-picker__list { display: flex; flex-direction: column; gap: 6px; max-height: 180px; overflow-y: auto; }
.tag-picker__row { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.tag-picker__create { margin-top: 8px; background: none; border: none; color: var(--accent-color); cursor: pointer; padding: 4px 0; }
.tag-picker--popover { padding: 8px; min-width: 180px; }

/* 工具對話框範圍列 */
.bm-tools__scope { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 0; }
.bm-tools__scope-label { font-size: 0.85em; color: var(--secondary-text-color, #5f6368); }
.bm-tools__scope-btn { background: none; border: 1px solid var(--border-color, #ccc); border-radius: 4px; padding: 2px 8px; cursor: pointer; }
```

- [ ] **Step 2: 建置確認樣式載入**

Run: `make`
Expected: 建置成功，無錯誤。

- [ ] **Step 3: Commit**

```bash
git add sidepanel.css
git commit -m "style(bookmark): tag dots, tag picker, scope bar"
```

---

## Task 14: E2E — 貼標籤流程

**Files:**
- Create: `usecase_tests/puppeteer_tests/happy_path_bookmark_tagging.test.js`

- [ ] **Step 1: 參考既有 E2E 模式**

先讀 `usecase_tests/puppeteer_tests/happy_path_edit_bookmark.test.js` 與 `jest.setup.js`，沿用其載入擴充功能、開 sidepanel、建立測試書籤的 helper 與選擇器慣例（不要自創新框架）。

- [ ] **Step 2: 撰寫測試**

依既有模式撰寫，覆蓋：
1. 透過編輯對話框：開啟某書籤的編輯 → tag picker 勾一個既有標籤（或新增）→ 儲存 → 該書籤列出現 `.bookmark-tag-dot`。
2. 透過右鍵：對書籤按右鍵 → 「管理標籤」→ 勾選 → 關閉 → `.bookmark-tag-dot` 數量增加；再取消勾選 → 圓點消失。

斷言以 `.bookmark-tag-dot` 的數量與 `data-color` 驗證。

- [ ] **Step 3: 跑測試**

Run: `npm test -- happy_path_bookmark_tagging`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add usecase_tests/puppeteer_tests/happy_path_bookmark_tagging.test.js
git commit -m "test(e2e): bookmark tag assignment via dialog and right-click"
```

---

## Task 15: E2E — 局部掃描流程

**Files:**
- Create: `usecase_tests/puppeteer_tests/happy_path_scoped_scan.test.js`

- [ ] **Step 1: 撰寫測試**

沿用既有 E2E 模式，建立兩個資料夾各含書籤（其中一個資料夾內放兩個相同 URL 製造重複），覆蓋：
1. 對含重複的資料夾按右鍵 → 「找重複」→ 工具對話框開在 duplicates，範圍列文字含該資料夾名稱。
2. 重複清單只列出該資料夾內的重複，不含另一資料夾。
3. 「變更範圍」切到「全部」→ 列表筆數變化符合預期。

- [ ] **Step 2: 跑測試**

Run: `npm test -- happy_path_scoped_scan`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add usecase_tests/puppeteer_tests/happy_path_scoped_scan.test.js
git commit -m "test(e2e): scoped folder duplicate scan"
```

---

## Task 16: 全量驗證與收尾

- [ ] **Step 1: 全單元測試**

Run: `npm run test:unit`
Expected: 全 PASS（含既有 colorUtils/functionUtils/searchUtils 與新增三支）

- [ ] **Step 2: E2E happy path**

Run: `npm run test:ci`
Expected: PASS（不破壞既有 happy_path）

- [ ] **Step 3: 連動檢視**

依 `RULE_002_ARCHITECTURE.md` 確認改動 `bookmarkRenderer.js` 未影響拖放（手動拖一個書籤）、搜尋高亮、folder 展開。右鍵與拖放並存無衝突。

- [ ] **Step 4: 更新 GEMINI.md key_files（若需要）**

新增了 `modules/bookmark/tagPicker.js` 與 `modules/ui/bookmarkContextMenu.js`，依 `CLAUDE.md` §2 同步更新 `GEMINI.md` 的 `key_files` 描述。

```bash
git add GEMINI.md && git commit -m "docs(gemini): describe tagPicker and bookmarkContextMenu modules"
```

- [ ] **Step 5: Session 收尾筆記**

依 CLAUDE.md 慣例寫 `.agent/notes/NOTE_20260529.md` 記錄批 A 變更摘要與後續批次脈絡。

---

## Self-Review（已執行）

- **Spec 覆蓋**：#1 標籤入口（右鍵 Task 8 / 編輯框 Task 9）、書籤列顯示（Task 7）、tagPicker 單一職責（Task 4/5）✓；#2 局部掃描（Task 1/2/3/10/11）✓；AI 整理排除（未出現於任何任務）✓。
- **Placeholder**：無 TBD；所有程式步驟附完整碼。E2E（Task 14/15）以「沿用既有模式」描述而非貼完整檔，因其強依賴 `jest.setup.js` helper —— 已要求先讀既有測試對齊選擇器，屬合理（避免臆造不存在的 helper）。
- **型別一致**：`createTagPicker`/`getSelectedTagIds`/`diffTagSelection`/`getBookmarkCacheUnderFolder`/`filterBookmarksUnderFolder`/`findDuplicates(items)`/`showBookmarkContextMenu`/`pickFolder` 在各任務間名稱一致。
- **風險**：`renderDeadLinksView`/`renderDuplicatesView` 行號為現況快照，執行時以函式名定位為準。
