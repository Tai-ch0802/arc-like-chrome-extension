# 統一搜尋:Spotlight 彈出視窗 + 全域 Cmd+Shift+K + filter 重構 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development。Steps 用 checkbox(`- [ ]`)。

**Goal:** 全域 Cmd+Shift+K 開啟置中彈出視窗式 Spotlight(重用命令面板資料層 + 9 動作)、移除側邊欄內命令面板 overlay、側邊欄 filter 重構(`tag:` 只作用書籤)。

**Architecture:** Spotlight 是獨立 `popup` 視窗(擴充頁),由 background 開窗/置中/失焦關閉。因是獨立視窗,item handler 不能用 `currentWindow`;以 background 記錄的「來源 normal 視窗 id」(`searchContext`)為作用目標。導航/開分頁/開設定在 Spotlight 內直接執行;側邊欄 UI 類動作(智慧分組/AI清理/書籤工具/管理工作區/重整書籤/AskAI/建立工作區/切換工作區)走「`storage.session` 旗標 + 開側邊欄消費」轉送。側邊欄搜尋 bar 維持原地過濾,新增純函式 `searchScope` 讓 `tag:` 查詢隱藏非書籤區塊。

**前置:** 分支 `feat/spotlight-search`(已建,spec 已 commit)。測試:`npm run test:unit` / `npm run test:ci` / `npm run test:full`;建置 `make` / `make release`。

> **與 spec 的差異(計畫據實修正):** spec 寫 `dataProvider.js`「不動」,但獨立視窗需修正其 workspace/bookmark/reading-list handler 的視窗目標(見 T3)。`nlSearch.js` 仍不動。

---

## T1: 純函式 `searchScope`(TDD)

**Files:**
- Modify: `modules/utils/searchUtils.js`(追加 export)
- Test: `usecase_tests/unit_tests/searchUtils.test.mjs`(追加)

- [ ] **Step 1: 失敗測試**(追加到 `searchUtils.test.mjs`，沿用既有 import 風格)

```js
import { searchScope } from '../../modules/utils/searchUtils.js';

describe('searchScope', () => {
  it('無 tag → 過濾面板各區塊', () => {
    expect(searchScope({ keywords: ['react'], tags: [] })).toEqual({ filterPanelSections: true });
  });
  it('有 tag → 不過濾面板區塊(只作用書籤)', () => {
    expect(searchScope({ keywords: [], tags: ['work'] })).toEqual({ filterPanelSections: false });
    expect(searchScope({ keywords: ['react'], tags: ['work'] })).toEqual({ filterPanelSections: false });
  });
  it('皆空 → 過濾(視為無查詢,由下游還原)', () => {
    expect(searchScope({ keywords: [], tags: [] })).toEqual({ filterPanelSections: true });
  });
  it('防禦:未傳參數 → 過濾', () => {
    expect(searchScope()).toEqual({ filterPanelSections: true });
  });
});
```

- [ ] **Step 2: 跑測試確認 FAIL**
  Run: `npm run test:unit -- searchUtils`
  Expected: FAIL（`searchScope is not a function`）

- [ ] **Step 3: 實作**(追加到 `searchUtils.js` 末端)

```js
/**
 * 決定一次搜尋是否要過濾「面板各區塊」(分頁/群組/其他視窗/閱讀清單)。
 * 規則:出現任何 tag: token 時,搜尋只作用於書籤,其餘區塊應整批隱藏,
 * 故 filterPanelSections = false(由 caller 改走 hideNonBookmarkSections)。
 * @param {{keywords?: string[], tags?: string[]}} [parsed]
 * @returns {{filterPanelSections: boolean}}
 */
export function searchScope({ keywords = [], tags = [] } = {}) {
    return { filterPanelSections: tags.length === 0 };
}
```

- [ ] **Step 4: 跑測試確認 PASS + 無回歸**
  Run: `npm run test:unit -- searchUtils` → PASS
  Run: `npm run test:unit` → 全綠

- [ ] **Step 5: Commit**
```bash
git add modules/utils/searchUtils.js usecase_tests/unit_tests/searchUtils.test.mjs
git commit -m "feat(search): searchScope helper to scope tag: queries to bookmarks"
```

---

## T2: 側邊欄 filter 重構(`tag:` 隱藏非書籤區塊)

**Files:**
- Modify: `modules/searchManager.js`

- [ ] **Step 1: import searchScope**
  在 `searchManager.js` 頂部 import 行(現有 `import { matchesAnyKeyword, extractDomain, parseSearchQuery, bookmarkMatchesTags } from './utils/searchUtils.js';`)加入 `searchScope`：
```js
import { matchesAnyKeyword, extractDomain, parseSearchQuery, bookmarkMatchesTags, searchScope } from './utils/searchUtils.js';
```

- [ ] **Step 2: 改寫 `handleSearch`**
  將現有 `handleSearch` 主體（過濾各區塊那段）改為:

```js
async function handleSearch() {
    // 解析查詢：分離一般關鍵字與 tag: 篩選
    const { keywords, tags } = parseSearchQuery(ui.searchBox.value.trim());
    const { filterPanelSections } = searchScope({ keywords, tags });

    // 只用 keywords 編譯高亮正則（tag 不需要高亮）
    let regexes = [];
    if (keywords.length > 0) {
        regexes = keywords.map(keyword => new RegExp(`(${escapeRegExp(keyword)})`, 'gi'));
    }

    let tabCount = 0;
    let otherWindowsTabCount = 0;
    let readingListCount = 0;
    if (filterPanelSections) {
        // 一般/關鍵字查詢:照舊過濾分頁、其他視窗、閱讀清單
        tabCount = filterTabsAndGroups(keywords);
        otherWindowsTabCount = filterOtherWindowsTabs(keywords);
        readingListCount = filterReadingList(keywords, regexes);
    } else {
        // tag: 查詢:標籤只屬書籤,其餘區塊整批隱藏
        hideNonBookmarkSections();
    }

    const bookmarkCount = await filterBookmarks(keywords, regexes, tags);

    // 高亮匹配文字
    if (keywords.length > 0) {
        highlightMatches(regexes);
    } else {
        clearHighlights();
    }

    const event = new CustomEvent('searchResultUpdated', {
        detail: { tabCount: tabCount + otherWindowsTabCount + readingListCount, bookmarkCount }
    });
    document.dispatchEvent(event);
}
```

- [ ] **Step 3: 新增 `hideNonBookmarkSections` helper**
  在 `filterReadingList` 之後新增（沿用既有元素快取;切回關鍵字/空白時由既有 `filterTabsAndGroups` 等 toggle 還原):

```js
/**
 * tag: 查詢時呼叫:把分頁/群組/其他視窗/閱讀清單整批隱藏,只留書籤過濾。
 * 不需自行還原——切回關鍵字/空白查詢時,filterTabsAndGroups / filterOtherWindowsTabs /
 * filterReadingList 會以 toggle 重新評估可見性(空 keyword=全顯示)。
 */
function hideNonBookmarkSections() {
    // 目前視窗:分頁 + 群組 header
    for (const item of getTabElementsCache().values()) {
        item.classList.add('hidden');
    }
    for (const [, header] of getGroupHeaderElementsCache()) {
        header.classList.add('hidden');
    }
    // 其他視窗:分頁 + 群組 header + 視窗資料夾
    for (const item of getOtherTabElementsCache().values()) {
        item.classList.add('hidden');
    }
    for (const [, header] of getOtherGroupHeaderElementsCache()) {
        header.classList.add('hidden');
    }
    for (const [, folder] of getOtherWindowFolderElementsCache()) {
        folder.classList.add('hidden');
        const content = folder.nextElementSibling;
        if (content && content.classList.contains('folder-content')) {
            content.classList.add('hidden');
        }
    }
    // 閱讀清單項目
    const rl = document.getElementById('reading-list');
    if (rl) {
        rl.querySelectorAll('.reading-list-item').forEach(i => i.classList.add('hidden'));
    }
}
```

- [ ] **Step 4: 驗證建置**
  Run: `make`
  Expected: 成功產生 dev zip，無錯誤。
  Run: `npm run test:unit` → 全綠（無回歸）。

- [ ] **Step 5: Commit**
```bash
git add modules/searchManager.js
git commit -m "feat(search): tag: queries scope to bookmarks, hide tab/group/reading sections"
```

---

## T3: Spotlight 共用情境(searchContext / panelBridge)+ actions / dataProvider handler 改為視窗安全

**Files:**
- Create: `modules/commandPalette/searchContext.js`
- Create: `modules/commandPalette/panelBridge.js`
- Modify: `modules/commandPalette/actions.js`
- Modify: `modules/commandPalette/dataProvider.js`

- [ ] **Step 1: `searchContext.js`**
```js
/**
 * Spotlight 啟動時的「來源 normal 視窗」。Spotlight 為獨立 popup 視窗,
 * item handler 必須作用於使用者的瀏覽器視窗,而非 popup 本身。
 */
let originWindowId = null;

/** @param {number|null|undefined} id */
export function setOriginWindowId(id) {
    originWindowId = (typeof id === 'number') ? id : null;
}

/** @returns {number|null} */
export function getOriginWindowId() {
    return originWindowId;
}
```

- [ ] **Step 2: `panelBridge.js`**(轉送 + 開分頁 helper)
```js
import { getOriginWindowId } from './searchContext.js';

/** 解析作用目標 normal 視窗 id:優先用啟動來源,否則退回最後聚焦的 normal 視窗。 */
async function resolveTargetWindowId() {
    const fromCtx = getOriginWindowId();
    if (typeof fromCtx === 'number') return fromCtx;
    const w = await chrome.windows.getLastFocused({ windowTypes: ['normal'] }).catch(() => null);
    return w && typeof w.id === 'number' ? w.id : null;
}

/**
 * 從 Spotlight(獨立視窗)請求側邊欄執行 UI 類動作:
 * 寫 session 旗標 → 在來源視窗開側邊欄 → 關閉 Spotlight。
 * @param {string} id @param {object} [extra]
 */
export async function requestPanelAction(id, extra = {}) {
    try {
        await chrome.storage.session.set({ pendingPanelAction: { id, ...extra, ts: Date.now() } });
        const winId = await resolveTargetWindowId();
        if (typeof winId === 'number') await chrome.sidePanel.open({ windowId: winId });
    } catch (err) {
        console.warn('[spotlight] requestPanelAction failed:', err && err.message ? err.message : err);
    } finally {
        if (typeof window !== 'undefined' && typeof window.close === 'function') window.close();
    }
}

/** 在來源 normal 視窗開新分頁(導航類:開書籤/閱讀清單)。 */
export async function openUrlInOrigin(url) {
    const winId = await resolveTargetWindowId();
    await chrome.tabs.create(typeof winId === 'number' ? { url, windowId: winId } : { url });
}
```

- [ ] **Step 3: 改寫 `actions.js` handlers**
  `actions.js` 現在只服務 Spotlight。頂部 import:
```js
import * as state from '../stateManager.js';
import { requestPanelAction } from './panelBridge.js';
import { getOriginWindowId } from './searchContext.js';
```
  將 `buildActions()` 內各 handler 改為:

```js
// smart-group
isVisible: () => state.isAiGroupingVisible(),
handler: () => requestPanelAction('smart-group'),

// ai-cleanup
isVisible: () => state.isAiCleanupVisible(),
handler: () => requestPanelAction('ai-cleanup'),

// new-tab-right（純 API,但作用於來源視窗的 active 分頁,不可用 currentWindow）
handler: async () => {
    let winId = getOriginWindowId();
    if (typeof winId !== 'number') {
        const w = await chrome.windows.getLastFocused({ windowTypes: ['normal'] }).catch(() => null);
        winId = w && typeof w.id === 'number' ? w.id : null;
    }
    if (typeof winId !== 'number') return;
    const [active] = await chrome.tabs.query({ active: true, windowId: winId });
    if (!active) return;
    const newTab = await chrome.tabs.create({ windowId: winId, index: active.index + 1, active: true });
    if (active.groupId > 0) await chrome.tabs.group({ groupId: active.groupId, tabIds: newTab.id });
},

// refresh-bookmarks
handler: () => requestPanelAction('refresh-bookmarks'),

// settings（獨立視窗可直接開選項頁,免側邊欄）
handler: () => chrome.runtime.openOptionsPage(),

// create-workspace（依賴側邊欄/目前視窗 → 轉送）
handler: () => requestPanelAction('create-workspace'),

// manage-workspaces
handler: () => requestPanelAction('manage-workspaces'),

// bookmark-tools
handler: () => requestPanelAction('bookmark-tools'),

// ask-ai-search（nlSearch 的 modal 須在側邊欄 document → 轉送）
handler: () => requestPanelAction('ask-ai-search'),
```
  移除原本對 `document.getElementById(...).click()` / `import('./nlSearch.js')` / `import('../workspace/workspaceUI.js')` 的呼叫。

- [ ] **Step 4: 改寫 `dataProvider.js` 受視窗影響的 handler**
  頂部 import 加:
```js
import { requestPanelAction, openUrlInOrigin } from './panelBridge.js';
```
  - `getWorkspaceResults` 的 handler 改為（移除 lazy import workspaceUI）:
```js
handler: () => requestPanelAction('switch-workspace', { workspaceId: w.id }),
```
  - `getBookmarkResults` 的 handler:
```js
handler: () => openUrlInOrigin(b.url),
```
  - `getReadingListResults` 的 handler:
```js
handler: () => openUrlInOrigin(e.url),
```
  - `getTabResults` handler **不變**（`chrome.tabs.update(t.id,{active:true})` + `chrome.windows.update(t.windowId,{focused:true})` 已用分頁自身 windowId,正確）。

- [ ] **Step 5: 驗證**
  Run: `make` → 成功（語法/匯入無誤）。
  Run: `npm run test:unit` → 全綠（dataProvider/actions 無既有單元測試亦不應破壞）。

- [ ] **Step 6: Commit**
```bash
git add modules/commandPalette/searchContext.js modules/commandPalette/panelBridge.js modules/commandPalette/actions.js modules/commandPalette/dataProvider.js
git commit -m "feat(spotlight): window-safe action/data handlers + panel-action bridge"
```

---

## T4: Spotlight 頁面(html + bootstrap + controller)

**Files:**
- Create: `spotlight.html`
- Create: `spotlight.js`
- Create: `modules/spotlight/spotlightController.js`

- [ ] **Step 1: `spotlight.html`**(仿 `options.html`;沿用 `sidepanel.css`)
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Search</title>
  <link rel="stylesheet" href="sidepanel.css">
</head>
<body class="spotlight-body">
  <div class="spotlight-shell">
    <input type="text" id="spotlight-input" class="cmd-palette-input" autocomplete="off" spellcheck="false">
    <div id="spotlight-results" class="cmd-palette-results" role="listbox"></div>
  </div>
  <script type="module" src="spotlight.js"></script>
</body>
</html>
```

- [ ] **Step 2: `spotlight.js`**(bootstrap:主題 + i18n + hydrate state + 來源視窗 + 初始化 controller)
```js
import * as api from './modules/apiManager.js';
import { applyTheme } from './modules/ui/settingManager.js';
import * as customTheme from './modules/ui/customThemeManager.js';
import * as state from './modules/stateManager.js';
import * as workspaceManager from './modules/workspace/workspaceManager.js';
import { setOriginWindowId } from './modules/commandPalette/searchContext.js';
import { initSpotlight } from './modules/spotlight/spotlightController.js';

async function applyOwnTheme() {
    try {
        const { theme } = await api.getStorage('sync', { theme: 'geek' });
        if (theme === 'custom') { await customTheme.loadAndApplyCustomTheme(); }
        else { applyTheme(theme); }
    } catch (e) { console.warn('spotlight theme apply failed', e); }
}

function localizeStatic() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const msg = api.getMessage(el.getAttribute('data-i18n'));
        if (msg) el.textContent = msg;
    });
    const input = document.getElementById('spotlight-input');
    if (input) input.placeholder = api.getMessage('cmdPalettePlaceholder') || 'Search tabs, bookmarks, actions…';
}

document.addEventListener('DOMContentLoaded', async () => {
    // i18n 必須在套用任何字串前載入自訂字典
    const uiLang = await state.initUiLanguage();
    await api.loadCustomI18n(uiLang);
    await applyOwnTheme();
    localizeStatic();

    // 取得 background 記錄的來源 normal 視窗,讓 handler 作用於使用者視窗
    try {
        const { spotlightOriginWindowId } = await chrome.storage.session.get('spotlightOriginWindowId');
        setOriginWindowId(spotlightOriginWindowId);
    } catch { /* ignore */ }

    // Hydrate data provider + action 可見性判斷所讀的 state
    await Promise.all([
        state.loadBookmarkCache(),
        state.initAiGroupingVisibility(),
        state.initAiCleanupVisibility(),
        workspaceManager.initWorkspaces(),
    ]);

    initSpotlight();
});
```

- [ ] **Step 3: `modules/spotlight/spotlightController.js`**(由 `commandPalette/index.js` 萃取列渲染/導航/執行,去除 overlay 開關;容器為 spotlight 視窗)
```js
/**
 * Spotlight controller — renders dataProvider results into the popup window,
 * keyboard navigation + Enter to execute. The window itself is the overlay,
 * so there is no open/close/backdrop logic here (Esc / blur close the window).
 */
import * as api from '../apiManager.js';
import { searchAll } from '../commandPalette/dataProvider.js';
import { debounce } from '../utils/functionUtils.js';

let inputEl, resultsEl;
/** @type {Array<{item: object, row: HTMLElement}>} */
let currentResults = [];
let activeIndex = 0;
/** Monotonic id so a late-arriving stale refresh() doesn't overwrite a newer one. */
let currentRequestId = 0;

export function initSpotlight() {
    inputEl = document.getElementById('spotlight-input');
    resultsEl = document.getElementById('spotlight-results');
    if (!inputEl || !resultsEl) return;

    inputEl.addEventListener('input', debouncedRefresh);
    inputEl.addEventListener('keydown', handleInputKeydown);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { e.preventDefault(); window.close(); }
    });

    inputEl.focus();
    refresh(); // 空白 → 引導預設
}

function handleInputKeydown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); moveActive(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveActive(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); executeActive(); }
}

const debouncedRefresh = debounce(() => refresh(), 100);

async function refresh() {
    const myId = ++currentRequestId;
    const query = inputEl.value;
    const groups = await searchAll(query);
    if (myId !== currentRequestId) return; // 丟棄過期結果
    renderGroups(groups);
}

function renderGroups(groups) {
    resultsEl.innerHTML = '';
    currentResults = [];
    activeIndex = 0;

    if (groups.length === 0) {
        inputEl.removeAttribute('aria-activedescendant');
        const empty = document.createElement('div');
        empty.className = 'cmd-palette-empty';
        empty.textContent = api.getMessage('cmdPaletteEmpty') || 'No results';
        resultsEl.appendChild(empty);
        return;
    }

    const frag = document.createDocumentFragment();
    for (const group of groups) {
        const header = document.createElement('div');
        header.className = 'cmd-palette-group-header';
        header.textContent = api.getMessage(group.titleKey) || group.titleKey;
        frag.appendChild(header);
        for (const item of group.items) {
            const row = buildRow(item, currentResults.length);
            currentResults.push({ item, row });
            frag.appendChild(row);
        }
    }
    resultsEl.appendChild(frag);
    setActive(0);
}

function buildRow(item, index) {
    const row = document.createElement('div');
    row.className = 'cmd-palette-row';
    row.dataset.index = String(index);
    row.id = `spotlight-row-${index}`;
    row.setAttribute('role', 'option');
    row.setAttribute('aria-selected', 'false');

    const icon = document.createElement('span');
    icon.className = 'cmd-palette-icon';
    const isUrlIcon = typeof item.icon === 'string'
        && (item.icon.startsWith('http://') || item.icon.startsWith('https://') || item.icon.startsWith('chrome://'));
    if (isUrlIcon) {
        const img = document.createElement('img');
        img.src = item.icon;
        img.alt = '';
        img.onerror = () => { img.replaceWith(document.createTextNode('🌐')); };
        icon.appendChild(img);
    } else {
        icon.textContent = item.icon || '•';
    }

    const meta = document.createElement('div');
    meta.className = 'cmd-palette-meta';
    const title = document.createElement('div');
    title.className = 'cmd-palette-title';
    title.textContent = item.titleKey ? (api.getMessage(item.titleKey) || item.titleKey) : (item.title || '');
    meta.appendChild(title);
    if (item.subtitle) {
        const subtitle = document.createElement('div');
        subtitle.className = 'cmd-palette-subtitle';
        subtitle.textContent = item.subtitle;
        meta.appendChild(subtitle);
    }

    row.appendChild(icon);
    row.appendChild(meta);
    row.addEventListener('click', () => {
        activeIndex = parseInt(row.dataset.index, 10) || 0;
        executeActive();
    });
    return row;
}

function setActive(index) {
    if (currentResults.length === 0) return;
    activeIndex = Math.max(0, Math.min(currentResults.length - 1, index));
    currentResults.forEach((r, i) => {
        const on = i === activeIndex;
        r.row.classList.toggle('active', on);
        r.row.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    const active = currentResults[activeIndex];
    if (active) {
        inputEl.setAttribute('aria-activedescendant', active.row.id);
        active.row.scrollIntoView({ block: 'nearest' });
    }
}

function moveActive(delta) { setActive(activeIndex + delta); }

async function executeActive() {
    const current = currentResults[activeIndex];
    if (!current) return;
    try {
        await current.item.handler();
    } catch (err) {
        console.error('Spotlight action failed:', err);
    } finally {
        window.close();
    }
}
```

- [ ] **Step 4: 驗證建置**
  Run: `make` → 成功。（此時 Spotlight 尚無開窗入口,於 T5 接上;頁面本身可被 `chrome.runtime.getURL('spotlight.html')` 載入。）

- [ ] **Step 5: Commit**
```bash
git add spotlight.html spotlight.js modules/spotlight/spotlightController.js
git commit -m "feat(spotlight): popup search page (theme/i18n bootstrap + results controller)"
```

---

## T5: manifest command + background 開窗/置中/失焦關閉

**Files:**
- Modify: `manifest.json`
- Modify: `background.js`

- [ ] **Step 1: manifest 新增 command**
  在 `manifest.json` 的 `"commands"` 物件內（`create-new-tab-right` 之後）加入:
```json
    ,"open-search": {
      "suggested_key": {
        "default": "Ctrl+Shift+K",
        "mac": "Command+Shift+K"
      },
      "description": "__MSG_commandOpenSearch__"
    }
```
  （確保 JSON 逗號正確:`create-new-tab-right` 區塊結尾補逗號,或把新區塊放在其前。）

- [ ] **Step 2: background 開窗邏輯**
  在 `background.js`（建議置於檔尾的 `chrome.commands.onCommand` 之前）新增:
```js
// --- Spotlight popup window (Cmd+Shift+K) ---------------------------------
const SPOTLIGHT_URL = 'spotlight.html';
const SPOTLIGHT_W = 640;
const SPOTLIGHT_H = 480;
let spotlightWindowId = null;

/** SW 重啟會遺失 spotlightWindowId;以 popup 視窗 url 比對找回既有 Spotlight。 */
async function findExistingSpotlight() {
    try {
        const wins = await chrome.windows.getAll({ windowTypes: ['popup'], populate: true });
        const url = chrome.runtime.getURL(SPOTLIGHT_URL);
        for (const w of wins) {
            if ((w.tabs || []).some(t => t.url && t.url.startsWith(url))) return w.id;
        }
    } catch { /* ignore */ }
    return null;
}

async function openSpotlight() {
    try {
        if (spotlightWindowId == null) spotlightWindowId = await findExistingSpotlight();
        if (spotlightWindowId != null) {
            try { await chrome.windows.update(spotlightWindowId, { focused: true }); return; }
            catch { spotlightWindowId = null; }
        }
        const origin = await chrome.windows.getLastFocused({ windowTypes: ['normal'] }).catch(() => null);
        await chrome.storage.session.set({
            spotlightOriginWindowId: origin && typeof origin.id === 'number' ? origin.id : null
        });
        const opts = { url: SPOTLIGHT_URL, type: 'popup', focused: true, width: SPOTLIGHT_W, height: SPOTLIGHT_H };
        if (origin && typeof origin.left === 'number' && typeof origin.width === 'number') {
            opts.left = Math.max(0, origin.left + Math.round((origin.width - SPOTLIGHT_W) / 2));
            opts.top = Math.max(0, origin.top + Math.round((origin.height - SPOTLIGHT_H) / 3));
        }
        const win = await chrome.windows.create(opts);
        spotlightWindowId = win && typeof win.id === 'number' ? win.id : null;
    } catch (err) {
        console.warn('[spotlight] open failed:', err && err.message ? err.message : err);
    }
}

// 失焦自動關閉(排除短暫無焦點 WINDOW_ID_NONE)
chrome.windows.onFocusChanged.addListener((winId) => {
    if (spotlightWindowId != null && winId !== spotlightWindowId && winId !== chrome.windows.WINDOW_ID_NONE) {
        chrome.windows.remove(spotlightWindowId).catch(() => {});
    }
});
chrome.windows.onRemoved.addListener((winId) => {
    if (winId === spotlightWindowId) spotlightWindowId = null;
});
```

- [ ] **Step 3: 接上 commands.onCommand**
  將現有 `chrome.commands.onCommand.addListener(async (command) => {` 區塊開頭改為先處理 `open-search`:
```js
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'open-search') { await openSpotlight(); return; }
  if (command === 'create-new-tab-right') {
    // ...（既有邏輯不變）
```

- [ ] **Step 4: 驗證建置**
  Run: `make` → 成功。
  手動冒煙(可留待 T9 全量):`chrome://extensions` 重新載入未封裝 → 按 Cmd+Shift+K → Spotlight 視窗於畫面中央出現、自動聚焦輸入框、顯示引導群組;點視窗外 → 自動關閉。

- [ ] **Step 5: Commit**
```bash
git add manifest.json background.js
git commit -m "feat(spotlight): global Cmd+Shift+K opens centered popup, auto-close on blur"
```

---

## T6: 側邊欄消費 pendingPanelAction + 移除舊命令面板 overlay

**Files:**
- Modify: `sidepanel.js`
- Modify: `sidepanel.html`
- Delete: `modules/commandPalette/index.js`

- [ ] **Step 1: 移除 initCommandPalette import 與呼叫**
  - `sidepanel.js`:刪除 `import { initCommandPalette } from './modules/commandPalette/index.js';`
  - 刪除 init 區的 `initCommandPalette(); // Cmd+K / Ctrl+K unified search & actions overlay` 該行。

- [ ] **Step 2: 新增 pendingPanelAction 消費**
  在 `sidepanel.js` 適當位置（例如 `initialize` 之外的模組層）新增對映表與消費函式:
```js
// Spotlight(獨立視窗)轉送來的 UI 類動作:在側邊欄正確情境執行。
const PANEL_ACTION_HANDLERS = {
    'smart-group': () => document.getElementById('ai-group-btn')?.click(),
    'ai-cleanup': () => document.getElementById('ai-cleanup-btn')?.click(),
    'bookmark-tools': () => document.getElementById('bookmark-tools-btn')?.click(),
    'manage-workspaces': () => document.getElementById('workspace-manage-btn')?.click(),
    'refresh-bookmarks': () => document.dispatchEvent(new CustomEvent('refreshBookmarksRequired')),
    'ask-ai-search': async () => {
        const { openAskAiDialog } = await import('./modules/commandPalette/nlSearch.js');
        await openAskAiDialog();
    },
    'create-workspace': async () => {
        const { createWorkspaceFromCurrent } = await import('./modules/workspace/workspaceUI.js');
        await createWorkspaceFromCurrent();
    },
    'switch-workspace': async (extra) => {
        const { requestSwitchTo } = await import('./modules/workspace/workspaceUI.js');
        if (extra && extra.workspaceId) await requestSwitchTo(extra.workspaceId);
    },
};

async function consumePendingPanelAction() {
    let pending;
    try {
        ({ pendingPanelAction: pending } = await chrome.storage.session.get('pendingPanelAction'));
    } catch { return; }
    if (!pending || !pending.id) return;
    try { await chrome.storage.session.remove('pendingPanelAction'); } catch { /* ignore */ }
    const fn = PANEL_ACTION_HANDLERS[pending.id];
    if (!fn) return;
    try { await fn(pending); }
    catch (err) { console.warn('[panel-action] failed:', err && err.message ? err.message : err); }
}
```

- [ ] **Step 3: 在 init 與 session 變更時消費**
  - 在 `initialize()` 末端（事件監聽設置處附近）呼叫一次:`consumePendingPanelAction();`
  - 在模組層註冊監聽(靠近其他 addEventListener):
```js
chrome.storage.session.onChanged.addListener((changes) => {
    if (changes.pendingPanelAction && changes.pendingPanelAction.newValue) {
        consumePendingPanelAction();
    }
});
```

- [ ] **Step 4: 移除 sidepanel.html overlay markup**
  刪除 `sidepanel.html` 的整塊:
```html
    <!-- Command Palette (Cmd+K / Ctrl+K) -->
    <div id="command-palette-overlay" class="cmd-palette-overlay" hidden>
      ...
    </div>
```
  （第 130–142 行區塊,含 input/results/hint。）

- [ ] **Step 5: 刪除舊 index.js**
```bash
git rm modules/commandPalette/index.js
```
  確認無其他檔案 import 它:`grep -rn "commandPalette/index" --include=*.js .` 應為空。

- [ ] **Step 6: 驗證建置**
  Run: `make` → 成功。
  Run: `grep -rn "initCommandPalette\|command-palette-overlay" --include=*.js --include=*.html .` → 應為空。

- [ ] **Step 7: Commit**
```bash
git add sidepanel.js sidepanel.html
git rm modules/commandPalette/index.js
git commit -m "feat(spotlight): side panel consumes routed actions; remove in-panel palette overlay"
```

---

## T7: CSS — Spotlight 版面 + 清理 overlay 死碼

**Files:**
- Modify: `sidepanel.css`

- [ ] **Step 1: 移除 overlay 專屬規則**
  刪除 `.cmd-palette-overlay`（2962）、`.cmd-palette-overlay[hidden]`（2973）、`.cmd-palette-modal`（2977）三個規則區塊（overlay/置中定位專用,Spotlight 不再用）。保留 `.cmd-palette-input` / `-results` / `-group-header` / `-row` / `-icon` / `-meta` / `-title` / `-subtitle` / `-empty`（Spotlight 沿用）。`.cmd-palette-hint*` 若無人引用可一併移除（hint markup 已隨 overlay 刪除）。

- [ ] **Step 2: 新增 Spotlight 版面**(置於原 cmd-palette 區塊處)
```css
/* Spotlight popup window layout (spotlight.html) */
.spotlight-body {
    margin: 0;
    background: var(--main-bg-color);
    color: var(--text-color-primary);
    height: 100vh;
    overflow: hidden;
}
.spotlight-shell {
    display: flex;
    flex-direction: column;
    height: 100vh;
    padding: 12px;
    box-sizing: border-box;
    gap: 8px;
}
.spotlight-shell .cmd-palette-results {
    flex: 1 1 auto;
    overflow-y: auto;
    max-height: none;
}
```
  （若 `.cmd-palette-input` 原帶 modal 專屬邊距,於 `.spotlight-shell .cmd-palette-input` 視需要覆寫;以 `make` 後手動預覽為準。）

- [ ] **Step 3: 驗證**
  Run: `make` → 成功。
  手動:載入未封裝 → Cmd+Shift+K → 視窗版面正常、主題色正確(切深/淺色主題各試一次)。

- [ ] **Step 4: Commit**
```bash
git add sidepanel.css
git commit -m "style(spotlight): popup layout, remove dead command-palette overlay css"
```

---

## T8: build(Makefile)+ i18n + GEMINI.md

**Files:**
- Modify: `Makefile`
- Modify: `_locales/*/messages.json`（14 語系）
- Modify: `GEMINI.md`

- [ ] **Step 1: Makefile dev 來源**
  在 `DEV_SRC_FILES` 清單加入(於 `options.js` 之後):
```make
    spotlight.html \
    spotlight.js \
```
  （`modules` 已整包複製,`modules/spotlight/` 自動涵蓋。Spotlight CSS 併於 `sidepanel.css`,無新檔。）

- [ ] **Step 2: Makefile prod**
  在 prod 區段（options 之後,仿其兩行）加入:
```make
	@npx esbuild spotlight.js --bundle --minify --outfile=$(PROD_BUILD_DIR)/spotlight.js
	@cp spotlight.html $(PROD_BUILD_DIR)/spotlight.html
	@sed -i.bak 's/type="module" //' $(PROD_BUILD_DIR)/spotlight.html
```
  （prod 的 `.bak` 清理沿用既有規則;若 prod 有刪 `.bak` 的步驟,確認涵蓋 spotlight.html.bak。）

- [ ] **Step 3: i18n `commandOpenSearch` × 14**
  於每個 `_locales/<locale>/messages.json` 加入 `commandOpenSearch`(緊鄰其他 `command*` key,形狀同 `commandOpenSidePanel`)。英文:
```json
  "commandOpenSearch": {
    "message": "Open search",
    "description": "Command to open the centered Spotlight search window."
  },
```
  執行 `ls _locales` 取得全部 14 語系目錄,逐一加入並翻譯 `message`(沿用各語系既有用語風格;`description` 可保留英文)。範例:zh_TW「開啟搜尋」、zh_CN「打开搜索」、ja「検索を開く」、ko「검색 열기」等。
  驗證 JSON:`for f in _locales/*/messages.json; do jq empty "$f" || echo "BAD: $f"; done` → 無輸出。

- [ ] **Step 4: GEMINI.md key_files**
  在 `GEMINI.md` 的 `key_files` 描述新增 `spotlight.html` / `spotlight.js` / `modules/spotlight/spotlightController.js` / `modules/commandPalette/{searchContext,panelBridge}.js`,並更新 `commandPalette/index.js` 已移除、用途改為「資料層服務 Spotlight」之敘述。

- [ ] **Step 5: 驗證**
  Run: `make` → 成功(dev 含 spotlight)。
  Run: `make release` → 成功(prod bundle 含 spotlight、manifest command 正確)。
  解開 prod zip 抽查 `spotlight.html`(無 `type="module"`)、`spotlight.js`(已 bundle)。

- [ ] **Step 6: Commit**
```bash
git add Makefile _locales GEMINI.md
git commit -m "build,i18n: bundle spotlight page; commandOpenSearch x14; update key_files"
```

---

## T9: E2E + 全量驗證 + 最終 review + note

**Files:**
- Create: `usecase_tests/puppeteer_tests/happy_path_spotlight_search.test.js`
- Create/Modify: `.agent/notes/NOTE_20260602_spotlight_search.md`

- [ ] **Step 1: E2E（沿用既有 Puppeteer harness）**
  新增測試覆蓋(以實際 harness API 為準,參考現有 `happy_path_*.test.js`):
  1. **Spotlight 頁**:直接導航 `chrome-extension://<id>/spotlight.html` → `#spotlight-input` 自動聚焦;空白時 `#spotlight-results` 出現至少一個 `.cmd-palette-group-header`(引導群組);輸入字串 → 結果更新(列數變化)。
  2. **轉送旗標**:在 spotlight 頁點一個側邊欄類動作列(如「管理工作區」)→ `chrome.storage.session.get('pendingPanelAction')` 內含對應 `id`。（若 harness 不便讀 session,改為斷言點擊後視窗關閉行為或以 mock 包裝。）
  3. **側邊欄 tag scope**:側邊欄輸入 `tag:<name>` → 只剩該標籤書籤可見,`#reading-list .reading-list-item` 與分頁項目皆帶 `.hidden`;清空 → 還原。
  4. **舊 overlay 已移除**:`document.getElementById('command-palette-overlay')` 為 `null`。
  跑兩次確認穩定:`npm run test:ci`(若新測試屬 happy_path 子集)。

- [ ] **Step 2: 全量測試**
  Run: `npm run test:unit` → 全綠
  Run: `npm run test:ci` → 全綠
  Run: `npm run test:full` → 全綠(0 failed)

- [ ] **Step 3: 建置**
  Run: `make` 與 `make release` → 皆成功。

- [ ] **Step 4: 手動驗證清單**（記錄結果於 note）
  - Cmd+Shift+K 於:一般網頁 / `chrome://settings` / 新分頁 / 無 normal 視窗(僅 Spotlight 開著時再按)各情境。
  - 失焦自動關閉;`chrome://extensions/shortcuts` 可改綁。
  - 9 動作逐一:導航(切分頁/開書籤/開閱讀清單/切工作區)、開設定、向右開新分頁、智慧分組、AI 清理、書籤工具、管理工作區、重整書籤、Ask AI —— 側邊欄類會開側邊欄並執行於正確視窗。

- [ ] **Step 5: 最終整體 code review**(superpowers:subagent-driven-development 的 final reviewer)
  針對整個 feature 分支跑最終 review,修正 Critical/Important。

- [ ] **Step 6: note + commit**
  寫 `.agent/notes/NOTE_20260602_spotlight_search.md`(背景/做了什麼/驗證/已知 Minor/後續)。
```bash
git add usecase_tests/puppeteer_tests/happy_path_spotlight_search.test.js .agent/notes/NOTE_20260602_spotlight_search.md
git commit -m "test,docs: spotlight E2E + session note"
```

---

## 收尾(計畫外,實作完成後)
- `git fetch origin && git rebase origin/main`(解衝突後重跑 `test:ci` + `make`)。
- 提交 PR(雙語描述,遵循 pull-request skill)。

## Self-Review
- **Spec 覆蓋**:Spotlight 開窗(T5)、頁面/controller(T4)、9 動作 + 轉送(T3+T6)、移除 overlay(T6)、filter 重構/tag scope(T1+T2)、主題/i18n/build(T4/T8)、E2E/驗證(T9)。皆有對應任務。
- **型別一致**:`searchScope({keywords,tags})→{filterPanelSections}`、`requestPanelAction(id,extra)`/`pendingPanelAction:{id,...extra,ts}`/`PANEL_ACTION_HANDLERS[id](extra)`、`setOriginWindowId/getOriginWindowId`、`spotlightOriginWindowId`(session)前後一致。
- **無 placeholder**:各步驟含實際程式碼/指令;i18n ×14 為機械填值(提供 en + 範例 + jq 驗證),屬可執行指示。
- **風險**:`sidePanel.open` 手勢(commands/點擊皆屬手勢,列手動驗證);SW 重啟遺失 windowId(findExistingSpotlight 找回);失焦誤關(排除 WINDOW_ID_NONE);Spotlight state hydration(spotlight.js Promise.all 補齊 bookmark cache/可見性/workspaces)。
