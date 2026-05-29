# 批 B：清理可視性 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 死連結清理結果顯示書籤完整資料夾路徑；AI 分頁清理結果顯示分頁所屬 tab group 的彩色圓點 + 群組名。

**Architecture:** 群組 badge 的判定抽成純函式 `resolveTabGroupBadge`（放在無副作用的 `groupColors.js`，可單元測試）；UI 端只做收集與渲染。死連結路徑用 renderer 端 `bookmarkId → path` map 查找，不動 `deadLinkChecker` 契約。

**Tech Stack:** Vanilla JS ESM、Chrome MV3、Jest（單元 .mjs + Puppeteer E2E）。

**測試指令：** 單元 `npm run test:unit`；E2E `npm test`；建置 `make`。
**前置：** 分支 `feat/cleanup-context-visibility`（已建立），批 A 已合併進 main 並含於本分支基底。

---

## 檔案結構

| 檔案 | 動作 |
|------|------|
| `modules/ui/groupColors.js` | 新增純函式 `resolveTabGroupBadge` |
| `modules/ui/aiCleanupUI.js` | 收集 groupId、查 groupMap、renderList 加 badge |
| `modules/bookmark/bookmarkToolsUI.js` | renderDeadLinksView 加資料夾路徑 |
| `sidepanel.css` | group badge 樣式（死連結路徑沿用 `.bm-tools__dup-path`） |
| `usecase_tests/unit_tests/tabGroupBadge.test.mjs` | `resolveTabGroupBadge` 單元測試（新增） |
| `usecase_tests/puppeteer_tests/happy_path_cleanup_context.test.js` | E2E（新增） |

---

## Task 1: 純函式 `resolveTabGroupBadge`

**Files:**
- Modify: `modules/ui/groupColors.js`（檔尾新增 export）
- Test: `usecase_tests/unit_tests/tabGroupBadge.test.mjs`（新增）

- [ ] **Step 1: 寫失敗測試**

新增 `usecase_tests/unit_tests/tabGroupBadge.test.mjs`：

```js
import { resolveTabGroupBadge } from '../../modules/ui/groupColors.js';

const groupMap = new Map([
  [10, { id: 10, title: 'Work', color: 'blue' }],
  [11, { id: 11, title: '', color: 'red' }], // 未命名群組
]);

describe('resolveTabGroupBadge', () => {
  it('回傳分頁所屬群組的 color 與 title', () => {
    expect(resolveTabGroupBadge({ groupId: 10 }, groupMap)).toEqual({ color: 'blue', title: 'Work' });
  });

  it('未命名群組 title 為空字串', () => {
    expect(resolveTabGroupBadge({ groupId: 11 }, groupMap)).toEqual({ color: 'red', title: '' });
  });

  it('未分組分頁 (groupId -1) 回傳 null', () => {
    expect(resolveTabGroupBadge({ groupId: -1 }, groupMap)).toBeNull();
  });

  it('groupId 不在 map 中回傳 null', () => {
    expect(resolveTabGroupBadge({ groupId: 99 }, groupMap)).toBeNull();
  });

  it('tab 缺 groupId 或為 null 時回傳 null', () => {
    expect(resolveTabGroupBadge({}, groupMap)).toBeNull();
    expect(resolveTabGroupBadge(null, groupMap)).toBeNull();
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npm run test:unit -- tabGroupBadge`
Expected: FAIL（函式未匯出）

- [ ] **Step 3: 實作**

在 `modules/ui/groupColors.js` 檔尾新增：

```js
/**
 * 判定某分頁該顯示的 tab group badge 資料。
 * @param {{groupId?: number}} tab
 * @param {Map<number, {title?: string, color: string}>} groupMap
 * @returns {{color: string, title: string} | null} 未分組或查無群組時回傳 null
 */
export function resolveTabGroupBadge(tab, groupMap) {
    if (!tab || tab.groupId == null || tab.groupId === -1) return null;
    const g = groupMap.get(tab.groupId);
    if (!g) return null;
    return { color: g.color, title: g.title || '' };
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npm run test:unit -- tabGroupBadge`
Expected: PASS（5 passed）

- [ ] **Step 5: Commit**

```bash
git add modules/ui/groupColors.js usecase_tests/unit_tests/tabGroupBadge.test.mjs
git commit -m "feat(cleanup): add resolveTabGroupBadge helper"
```

---

## Task 2: AI 分頁清理顯示 group badge

**Files:**
- Modify: `modules/ui/aiCleanupUI.js`

- [ ] **Step 1: 加 import**

`modules/ui/aiCleanupUI.js` 頂部新增：

```js
import { GROUP_COLORS, resolveTabGroupBadge } from './groupColors.js';
```

- [ ] **Step 2: 收集 groupId 並查 group map**

在 `handleCleanupAction` 中，`tabsForAi` 的 `.map(t => ({...}))` 內新增 `groupId: t.groupId,`（放在 `lastAccessedMinutesAgo` 之後）。

在送 AI 之前（`tabsForAi.length === 0` 判斷之後、`generateCleanupSuggestions` 之前）新增：

```js
        let groupMap = new Map();
        try {
            const groups = await api.getTabGroupsInCurrentWindow();
            groupMap = new Map(groups.map(g => [g.id, g]));
        } catch { /* 無 group 或 API 不可用 → 無 badge */ }
```

把 `renderList(currentSuggestions, tabById);`（約 `:95`）改為：

```js
        renderList(currentSuggestions, tabById, groupMap);
```

- [ ] **Step 3: renderList 渲染 badge**

把 `function renderList(suggestions, tabById) {` 改為 `function renderList(suggestions, tabById, groupMap = new Map()) {`。

在建立 `title` 之後、append 到 `meta` 之前，插入 badge 邏輯（badge 放在標題列）。將原本：
```js
        meta.appendChild(title);
        meta.appendChild(reason);
```
改為：
```js
        const badge = resolveTabGroupBadge(tab, groupMap);
        if (badge) {
            const groupEl = document.createElement('span');
            groupEl.className = 'ai-cleanup-row__group';
            const dot = document.createElement('span');
            dot.className = 'ai-cleanup-row__group-dot';
            dot.style.background = GROUP_COLORS[badge.color] || GROUP_COLORS.grey;
            groupEl.appendChild(dot);
            if (badge.title) {
                const name = document.createElement('span');
                name.className = 'ai-cleanup-row__group-name';
                name.textContent = badge.title;
                groupEl.appendChild(name);
            }
            title.appendChild(groupEl);
        }
        meta.appendChild(title);
        meta.appendChild(reason);
```

- [ ] **Step 4: 驗證語法/載入**

Run: `npm run test:unit` (67+5=72 green，確認 import 與檔案解析無誤)
Run: `make`（建置 OK）

- [ ] **Step 5: Commit**

```bash
git add modules/ui/aiCleanupUI.js
git commit -m "feat(cleanup): show tab group badge in AI tab cleanup list"
```

---

## Task 3: 死連結結果顯示完整資料夾路徑

**Files:**
- Modify: `modules/bookmark/bookmarkToolsUI.js`（`renderDeadLinksView`）

- [ ] **Step 1: 建 pathById 並渲染路徑**

先 READ `renderDeadLinksView` 目前的內容。它在掃描按鈕 handler 內計算 `cache`（批 A 後已含 scope），再 `.map` 成 `bookmarks`。

(a) 在計算出 `cache`（`const cache = scopeFolderId ? state.getBookmarkCacheUnderFolder(scopeFolderId) : (state.getBookmarkCache() || []);`）之後，新增：
```js
        const pathById = new Map(cache.map(b => [String(b.id), b.path || []]));
```

(b) 在 unreachable 結果渲染迴圈中（目前建立 `t`(title) 與 `u`(url) 並 append 到 `meta` 的區塊，約 `:343-351`），於 `meta.appendChild(u);` 之後新增路徑列：
```js
            const path = pathById.get(String(r.bookmarkId)) || [];
            if (path.length) {
                const p = document.createElement('div');
                p.className = 'bm-tools__sub bm-tools__dup-path';
                p.textContent = path.join(' / ');
                meta.appendChild(p);
            }
```
（沿用既有 `.bm-tools__dup-path` 樣式；`.bm-tools__sub` 提供次要文字外觀。）

- [ ] **Step 2: 驗證**

Run: `make`（建置 OK）
Re-read 該段確認 `r.bookmarkId` 為結果物件實際欄位（`deadLinkChecker` 回傳 `bookmarkId`），且 `pathById` key 用 `String(...)` 對齊。

- [ ] **Step 3: Commit**

```bash
git add modules/bookmark/bookmarkToolsUI.js
git commit -m "feat(bookmark): show folder path in dead-link results"
```

---

## Task 4: CSS 樣式

**Files:**
- Modify: `sidepanel.css`

- [ ] **Step 1: 新增 group badge 樣式**

找到既有 `.ai-cleanup-row__reason` 或 `.ai-cleanup-row__title` 規則附近，新增：

```css
.ai-cleanup-row__group { display: inline-flex; align-items: center; gap: 4px; margin-left: 8px; font-size: 0.8em; color: var(--secondary-text-color, #5f6368); vertical-align: middle; }
.ai-cleanup-row__group-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; flex: none; }
.ai-cleanup-row__group-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px; }
```

（死連結路徑沿用既有 `.bm-tools__dup-path` / `.bm-tools__sub`，無需新增。）

- [ ] **Step 2: 建置確認**

Run: `make`（OK）；確認 `grep -c "{" sidepanel.css` 與 `grep -c "}" sidepanel.css` 相等。

- [ ] **Step 3: Commit**

```bash
git add sidepanel.css
git commit -m "style(cleanup): tab group badge in AI cleanup list"
```

---

## Task 5: E2E + 全量驗證 + 收尾

**Files:**
- Create: `usecase_tests/puppeteer_tests/happy_path_cleanup_context.test.js`

- [ ] **Step 1: 研究既有 E2E**

讀 `usecase_tests/puppeteer_tests/setup.js` 與一支既有測試，沿用 harness。

- [ ] **Step 2: 寫死連結路徑 E2E（較可控）**

死連結掃描依賴網路，AI 清理依賴模型——兩者在 E2E 不穩。優先寫**死連結路徑**的結構驗證：
- 在某資料夾內建立一個指向必然無法連線的 URL 的書籤（例如 `http://nonexistent.invalid.test/`，HEAD 會 fetch 失敗 → unreachable），開 Bookmark Tools → Dead Links → Start scan → 等掃描完成 → 斷言該 unreachable 列存在且包含 `.bm-tools__dup-path`，文字含該資料夾名。
- 若網路/逾時導致掃描在 CI 過慢或不穩，改為 scope 到該單一資料夾（批 A 能力）以縮短掃描；若仍不穩，標記為 DONE_WITH_CONCERNS 並保留可穩定通過的部分。

group badge 的 E2E 因需可用的 AI 模型而難以穩定；以 Task 1 的單元測試 + 手動驗證覆蓋，E2E 不強求（若 harness 可注入 fake suggestions 再補）。

run：`npm test -- happy_path_cleanup_context`（跑兩次確認穩定）。

- [ ] **Step 3: 全量驗證**

Run: `npm run test:unit`（全綠，含新 tabGroupBadge）
Run: `npm run test:ci`（happy path 全綠，無回歸）
Run: `make`（建置 OK）

- [ ] **Step 4: 文件收尾**

- 視需要更新 `GEMINI.md` 的 `key_files`（`aiCleanupUI.js` 若已列出則補述 group badge；`bookmarkToolsUI.js` 補述死連結路徑）。
- 寫 `.agent/notes/NOTE_20260529_phase12_batchB.md` 記錄批 B 變更與後續批次脈絡。

```bash
git add -A && git commit -m "test(e2e): dead-link folder path; docs for batch B"
```

- [ ] **Step 5: 最終 code review（整批）**

派最終 reviewer 對 `git diff <batchB-base>..HEAD` 做整體審查。

---

## Self-Review（已執行）
- **Spec 覆蓋**：死連結路徑（Task 3）、group badge（Task 1 邏輯 + Task 2 渲染）、CSS（Task 4）、測試（Task 1 單元 + Task 5 E2E）✓。
- **Placeholder**：無；純邏輯附完整碼與測試。E2E（Task 5）誠實標註 AI/網路依賴的限制與務實替代（單元 + 結構驗證），非空泛 placeholder。
- **型別一致**：`resolveTabGroupBadge(tab, groupMap)`、`renderList(suggestions, tabById, groupMap)`、`pathById`、`r.bookmarkId` 跨任務一致。
- **風險**：行號為現況快照，以函式名定位為準；死連結 E2E 可能因網路不穩需降級為結構驗證。
