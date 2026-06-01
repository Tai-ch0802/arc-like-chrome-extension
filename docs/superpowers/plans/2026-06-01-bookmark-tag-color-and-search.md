# 書籤標籤強化 Implementation Plan

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development。Steps 用 checkbox。

**Goal:** 標籤可選顏色 + `tag:` 搜尋語法（含點圓點篩選）。
**Architecture:** 解析與比對抽成 `searchUtils.js` 純函式（TDD）；UI（色票 dialog、tag filter、點圓點）薄接線。
**前置:** 分支 `feat/bookmark-tag-color-and-search`（from merged main）。測試：`npm run test:unit` / `test:ci` / `test:full`。

---

## T1: 純函式 parseSearchQuery + bookmarkMatchesTags（TDD）
**Files:** `modules/utils/searchUtils.js`（追加 export）；`usecase_tests/unit_tests/searchUtils.test.mjs`（追加）

- [ ] **失敗測試**（追加到 searchUtils.test.mjs）：
```js
import { parseSearchQuery, bookmarkMatchesTags } from '../../modules/utils/searchUtils.js';

describe('parseSearchQuery', () => {
  it('分離 tag: token 與一般關鍵字', () => {
    expect(parseSearchQuery('react tag:工作')).toEqual({ keywords: ['react'], tags: ['工作'] });
  });
  it('支援引號包住含空白的標籤名', () => {
    expect(parseSearchQuery('tag:"side pj" hooks')).toEqual({ keywords: ['hooks'], tags: ['side pj'] });
  });
  it('多個 tag: 累積、tag 名小寫化', () => {
    expect(parseSearchQuery('tag:Work tag:Read')).toEqual({ keywords: [], tags: ['work', 'read'] });
  });
  it('空字串 → 皆空', () => {
    expect(parseSearchQuery('   ')).toEqual({ keywords: [], tags: [] });
  });
  it('純關鍵字、無 tag', () => {
    expect(parseSearchQuery('foo bar')).toEqual({ keywords: ['foo', 'bar'], tags: [] });
  });
});

describe('bookmarkMatchesTags', () => {
  it('需包含所有 required（AND、大小寫不敏感、精確名稱）', () => {
    expect(bookmarkMatchesTags(['Work', 'Read'], ['work'])).toBe(true);
    expect(bookmarkMatchesTags(['Work'], ['work', 'read'])).toBe(false);
  });
  it('required 為空 → true', () => {
    expect(bookmarkMatchesTags(['Work'], [])).toBe(true);
    expect(bookmarkMatchesTags([], [])).toBe(true);
  });
  it('精確比對，不做子字串', () => {
    expect(bookmarkMatchesTags(['Workspace'], ['work'])).toBe(false);
  });
});
```
- [ ] 跑 `npm run test:unit -- searchUtils` 確認 FAIL。
- [ ] **實作**（追加到 searchUtils.js）：
```js
/**
 * 將搜尋字串拆成一般關鍵字與 tag: 篩選。
 * 支援 tag:單詞 與 tag:"含空白名稱"；tag 名稱小寫化。
 * @param {string} query
 * @returns {{keywords: string[], tags: string[]}}
 */
export function parseSearchQuery(query) {
    const tags = [];
    if (typeof query !== 'string') return { keywords: [], tags };
    // 先抽出 tag:"..." 與 tag:\S+
    const rest = query.replace(/tag:"([^"]*)"|tag:(\S+)/gi, (_, quoted, bare) => {
        const name = (quoted !== undefined ? quoted : bare).trim().toLowerCase();
        if (name) tags.push(name);
        return ' ';
    });
    const keywords = rest.toLowerCase().split(/\s+/).filter(k => k.length > 0);
    return { keywords, tags };
}

/**
 * 書籤是否含全部 required 標籤（AND、大小寫不敏感、精確名稱比對）。
 * @param {string[]} bookmarkTagNames @param {string[]} requiredTagNames
 * @returns {boolean}
 */
export function bookmarkMatchesTags(bookmarkTagNames, requiredTagNames) {
    if (!requiredTagNames || requiredTagNames.length === 0) return true;
    const have = new Set((bookmarkTagNames || []).map(n => String(n).toLowerCase()));
    return requiredTagNames.every(req => have.has(String(req).toLowerCase()));
}
```
- [ ] 跑 `npm run test:unit -- searchUtils` 綠；全 `test:unit` 無回歸。
- [ ] Commit：`feat(search): parseSearchQuery + bookmarkMatchesTags pure helpers`

## T2: showTagDialog + 標籤建立/編輯接色票
**Files:** `modules/modalManager.js`（新增 showTagDialog）；`modules/bookmark/bookmarkToolsUI.js`

- [ ] READ `modalManager.showCreateGroupDialog`（名稱 input + 色票 swatch + 鍵盤）與 `bookmarkToolsUI` 的 `renderTagsView`(create) 與 `buildTagRow`(rename)。
- [ ] 新增 `export function showTagDialog({ title, defaultName='', defaultColor='blue' })` → Promise<{name,color}|null>，仿 showCreateGroupDialog：名稱 input（預填 defaultName）+ 一排色票（`tagManager.getPresetColors()` 的 8 色；色票背景用既有 `.bm-tools__tag-chip[data-color]` 對映的 hex，或直接套 data-color class）。預選 defaultColor。確認鍵 resolve {name:trim, color}；取消/overlay resolve null。沿用 createModal/removeModal + focus。
- [ ] `bookmarkToolsUI`：
  - create 按鈕：改呼叫 `modal.showTagDialog({title: 建立標籤})`，結果非空 → `tagManager.createTag({name,color})`，append row。
  - `buildTagRow` 的 ✏️：改呼叫 `modal.showTagDialog({title:編輯標籤, defaultName:tag.name, defaultColor:tag.color})` → `tagManager.updateTag(id,{name,color})`，更新該列 chip 的 textContent + `dataset.color = color`，並 dispatch `refreshBookmarksRequired`（讓書籤列圓點換色）。
- [ ] 驗證：`make` OK；`test:unit` 綠。Commit：`feat(tags): color picker when creating/editing a tag`

## T3: searchManager 依 tag 篩選
**Files:** `modules/searchManager.js`

- [ ] import `parseSearchQuery, bookmarkMatchesTags`（from searchUtils）與 `tagManager`（getTagsForBookmark）。
- [ ] `handleSearch`：`const { keywords, tags } = parseSearchQuery(ui.searchBox.value.trim());` regexes 仍只由 keywords 建；分頁/閱讀清單仍只吃 `keywords`（tag token 已分離，不影響它們）；`filterBookmarks(keywords, regexes, tags)`。空判斷改為 `keywords.length===0 && tags.length===0` 才視為「無查詢→還原完整視圖」。
- [ ] `filterBookmarks(keywords, regexes, tags = [])`：早退條件改為 `keywords.length===0 && tags.length===0`。比對改為：`const kwOk = keywords.length===0 || (titleMatches||urlMatches); const tagOk = bookmarkMatchesTags(tagManager.getTagsForBookmark(item.id).map(t=>t.name), tags); return kwOk && tagOk;`（仍設定 `_titleMatches/_urlMatches` 供高亮；tag-only 時兩者皆 false、不高亮也 OK）。
- [ ] 驗證 `make`、`test:unit`。Commit：`feat(search): filter bookmarks by tag: tokens`

## T4: 點書籤圓點即篩選
**Files:** `modules/ui/bookmarkRenderer.js`

- [ ] 圓點渲染處（updateBookmarkElement 的 `.bookmark-tag-dot`）：加 `dot.dataset.tagName = tag.name`，並給游標提示（`cursor:pointer`，由 CSS）。
- [ ] 在 `initBookmarkListeners` 的委派 click handler 最前面攔截：`const dot = e.target.closest('.bookmark-tag-dot'); if (dot) { e.preventDefault(); e.stopPropagation(); const name = dot.dataset.tagName || ''; const token = /\s/.test(name) ? 'tag:"'+name+'"' : 'tag:'+name; const box = document.getElementById(<search input id>); if (box){ box.value = token; box.dispatchEvent(new Event('input', {bubbles:true})); box.focus(); } return; }`（先確認搜尋框實際 id/選擇器——讀 sidepanel.html / searchUI；用既有 input 事件觸發 debounce 搜尋，不要直接 import handleSearch 以免循環）。
- [ ] CSS：`.bookmark-tag-dot{cursor:pointer}`（sidepanel.css）。
- [ ] 驗證 `make`。Commit：`feat(bookmark): click a tag dot to filter by that tag`

## T5: i18n + E2E + 全量驗證 + 最終 review
- [ ] i18n：新增 key（編輯標籤標題、顏色 等，~3-5 個）× 14 語系（en + 翻譯），JSON 驗證。
- [ ] E2E（Puppeteer，沿用既有 setup）：
  - 建立帶顏色標籤 → 該標籤 chip / 對書籤貼上後書籤列圓點為該色；編輯改色 → 更新。
  - 對一書籤貼標籤，搜尋框輸入 `tag:<name>` → 只列該書籤；點該書籤圓點 → 搜尋框成 `tag:<name>` 並篩選。
  跑兩次穩定。
- [ ] 全量：`test:unit`、`test:ci`、`test:full`（全綠）、`make`/`make release`。
- [ ] 文件：GEMINI key_files 視需要、`.agent/notes`；最終整體 code review。
- [ ] Commit + 收尾（本批可獨立 merge——與 Drive 無關、不涉敏感權限）。

## Self-Review
- 覆蓋：顏色(T2)、tag: 搜尋(T1+T3)、點圓點(T4)、i18n/E2E(T5)。
- 純函式 TDD（T1）；UI 走 make/E2E。
- 風險：搜尋框 id/觸發方式以實際程式為準（T4 要先讀）；tag-only 查詢時分頁/閱讀清單不受影響（已分離 keywords）。
