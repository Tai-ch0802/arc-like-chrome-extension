# 批 D：設定 → 獨立 options page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 把 sidepanel 內的設定 dialog 全面遷移到獨立 `options.html`（左側導覽 + 區塊），齒輪鈕改開 options page，sidepanel 透過 storage.onChanged bridge 即時反映設定變更，移除舊 dialog。

**Architecture:** options page 是獨立 context，只透過 chrome.storage 與 sidepanel 通訊。傳播邏輯抽成純函式 `resolveSettingChangeActions` 供單元測試。各 section 重用既有 manager（customThemeManager/backgroundImageManager/rssManager/aiManager）。

**Tech Stack:** Vanilla JS ESM、Chrome MV3 options_ui、Jest 單元 + Puppeteer E2E、esbuild（prod bundle）。

**測試指令：** 單元 `npm run test:unit`；E2E `npm test`；建置 `make`（dev）/`make release`（prod）。
**前置：** 分支 `feat/settings-options-page`。批 A/B/C 已合併。

**開發策略：** 先建 options page 並逐 section 填內容（此時舊 dialog 仍可用，齒輪仍開 modal），再加 bridge（D6），最後才切齒輪 + 移除舊 dialog（D7）+ 更新測試（D8）。避免中途出現壞掉的設定入口。

---

## 檔案結構

| 檔案 | 動作 |
|------|------|
| `manifest.json` | 加 `options_ui` |
| `Makefile` | dev 清單加 options.*；prod 加 esbuild bundle/minify/html strip |
| `options.html` | 新增：左 nav + section 容器，載入 options.js（type=module） |
| `options.css` | 新增：頁面版面 + 必要共用元件樣式 |
| `options.js` | 新增：頁面控制器（nav 切換、各 section、套用主題） |
| `modules/ui/settingsBridge.js` | 新增：`resolveSettingChangeActions` 純函式 + 套用 bridge |
| `modules/ui/settingManager.js` | 精簡：移除 dialog 建構/綁定，保留 applyTheme + 載入套用，齒輪改 openOptionsPage |
| `sidepanel.js` | 掛載 settings bridge |
| `_locales/*/messages.json` | 少量新 nav key |
| `usecase_tests/unit_tests/settingsBridge.test.mjs` | 新增 |
| `usecase_tests/puppeteer_tests/happy_path_settings_panel.test.js` | 更新（舊 dialog → openOptionsPage） |
| `usecase_tests/puppeteer_tests/happy_path_options_page.test.js` | 新增 |

---

## Task D1: Scaffold（manifest + options.html/css/js 骨架 + Makefile）

**Files:** Modify `manifest.json`, `Makefile`; Create `options.html`, `options.css`, `options.js`.

- [ ] **Step 1: manifest 加 options_ui**

在 `manifest.json` 的 `side_panel` 區塊之後（同層）新增：
```json
  "options_ui": {
    "page": "options.html",
    "open_in_tab": true
  },
```
（注意 JSON 逗號正確。）

- [ ] **Step 2: options.html 骨架**

Create `options.html`:
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Settings</title>
  <link rel="stylesheet" href="options.css">
</head>
<body>
  <div class="opt-shell">
    <nav class="opt-nav" id="opt-nav" aria-label="Settings sections"></nav>
    <main class="opt-content" id="opt-content"></main>
  </div>
  <script type="module" src="options.js"></script>
</body>
</html>
```

- [ ] **Step 3: options.css 基礎版面**

Create `options.css`:
```css
:root { color-scheme: light dark; }
body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; background: var(--bg-color, #fff); color: var(--text-color, #202124); }
.opt-shell { display: flex; min-height: 100vh; max-width: 1000px; margin: 0 auto; }
.opt-nav { width: 200px; flex: none; border-right: 1px solid var(--border-color, #e0e0e0); padding: 16px 8px; }
.opt-nav__item { display: block; width: 100%; text-align: left; background: none; border: none; padding: 10px 12px; border-radius: 6px; cursor: pointer; color: inherit; font-size: 14px; }
.opt-nav__item:hover { background: var(--hover-bg, rgba(0,0,0,0.05)); }
.opt-nav__item.active { background: var(--accent-color, #1a73e8); color: #fff; }
.opt-content { flex: 1; padding: 24px 32px; }
.opt-section { display: none; }
.opt-section.active { display: block; }
.opt-section h2 { margin-top: 0; font-size: 18px; }
.opt-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 0; border-bottom: 1px solid var(--border-color, #eee); }
.opt-row__label { font-size: 14px; }
.opt-row__desc { font-size: 12px; color: var(--secondary-text-color, #5f6368); margin-top: 2px; }
```

- [ ] **Step 4: options.js 骨架（nav + section 框架 + 套用主題）**

Create `options.js`:
```js
import * as api from './modules/apiManager.js';
import { applyTheme } from './modules/ui/settingManager.js';
import * as customTheme from './modules/ui/customThemeManager.js';

// Section registry — each entry: { id, labelKey, render(container) }
const SECTIONS = [
    { id: 'appearance', labelKey: 'settingsNavAppearance', render: renderAppearancePlaceholder },
    { id: 'language',   labelKey: 'settingsNavLanguage',   render: c => placeholder(c, 'Language') },
    { id: 'features',   labelKey: 'settingsNavFeatures',   render: c => placeholder(c, 'Features') },
    { id: 'ai',         labelKey: 'settingsNavAi',         render: c => placeholder(c, 'AI & Experimental') },
    { id: 'rss',        labelKey: 'settingsNavRss',        render: c => placeholder(c, 'RSS') },
    { id: 'shortcuts',  labelKey: 'settingsNavShortcuts',  render: c => placeholder(c, 'Shortcuts') },
    { id: 'about',      labelKey: 'settingsNavAbout',      render: c => placeholder(c, 'About') },
];

function placeholder(container, text) {
    const h = document.createElement('h2');
    h.textContent = text;
    container.appendChild(h);
}
function renderAppearancePlaceholder(c) { placeholder(c, 'Appearance'); }

async function applyOwnTheme() {
    try {
        const { theme } = await api.getStorage('sync', { theme: 'geek' });
        if (theme === 'custom') { await customTheme.loadAndApplyCustomTheme(); }
        else { applyTheme(theme); }
    } catch (e) { console.warn('options theme apply failed', e); }
}

function buildNav(navEl, contentEl) {
    const sectionEls = {};
    for (const s of SECTIONS) {
        const btn = document.createElement('button');
        btn.className = 'opt-nav__item';
        btn.dataset.section = s.id;
        btn.textContent = api.getMessage(s.labelKey) || s.id;
        btn.addEventListener('click', () => activate(s.id));
        navEl.appendChild(btn);

        const sec = document.createElement('section');
        sec.className = 'opt-section';
        sec.dataset.section = s.id;
        contentEl.appendChild(sec);
        s.render(sec);
        sectionEls[s.id] = { btn, sec };
    }
    function activate(id) {
        for (const [sid, { btn, sec }] of Object.entries(sectionEls)) {
            const on = sid === id;
            btn.classList.toggle('active', on);
            sec.classList.toggle('active', on);
        }
    }
    activate(SECTIONS[0].id);
}

document.addEventListener('DOMContentLoaded', () => {
    applyOwnTheme();
    buildNav(document.getElementById('opt-nav'), document.getElementById('opt-content'));
});
```

Note: `applyTheme` must be exported from settingManager.js (it already is, `:14`). Confirm before relying on it.

- [ ] **Step 5: Makefile — dev 清單**

把 `DEV_SRC_FILES` 加入三個檔案（在 `sidepanel.js` 後）：
```
    sidepanel.js \
    options.html \
    options.css \
    options.js \
```

- [ ] **Step 6: Makefile — prod build**

在 `build-prod` 的 sidepanel 處理之後新增 options 處理：
```makefile
	@npx esbuild options.js --bundle --minify --outfile=$(PROD_BUILD_DIR)/options.js
	@npx esbuild options.css --minify --outfile=$(PROD_BUILD_DIR)/options.css
	@cp options.html $(PROD_BUILD_DIR)/options.html
	@sed -i.bak 's/type="module" //' $(PROD_BUILD_DIR)/options.html
```
（接在既有 `@sed ... sidepanel.html` 與 `@rm -f $(PROD_BUILD_DIR)/*.bak` 之間，確保 `*.bak` 清除仍涵蓋 options.html.bak。）

- [ ] **Step 7: 驗證**

Run: `make`（dev 建置 OK，zip 含 options.html/js/css — 可 `unzip -l arc-sidebar-v*-dev.zip | grep options` 確認）
Run: `make release`（prod 建置 OK，`unzip -l arc-sidebar-v*.zip | grep options` 確認 options.js 已 bundle、options.html 已 strip type=module）
Run: `npm run test:unit`（不破壞，目前數量綠）

- [ ] **Step 8: Commit**
```bash
git add manifest.json Makefile options.html options.css options.js
git commit -m "feat(options): scaffold options page (nav + sections + build wiring)"
```

Report：dev/prod zip 是否含 options.*、測試結果、commit SHA。

---

## Task D2: 外觀 section（主題 / 自訂主題 / 背景圖）

**Files:** Modify `options.js`（實作 `renderAppearancePlaceholder` → 正式 `renderAppearance`）。

- [ ] **Step 1: 參照既有 dialog 程式碼**

READ `modules/ui/settingManager.js` 的 `buildSettingsDialogContent`（`:35-343`）中與**主題下拉、自訂主題面板、背景圖片**相關的片段，以及 `bindSettingsEventHandlers`（`:344+`）中對應的 handler（theme select `:350-377`、appearance/custom theme、background image）。也讀 `modules/ui/customThemeManager.js` 與 `modules/ui/backgroundImageManager.js` 的 export（它們是 context-agnostic、走 chrome.storage）。

- [ ] **Step 2: 在 options.js 實作 renderAppearance**

把 SECTIONS 的 appearance render 換成 `renderAppearance`，建立：
- 主題下拉（選項同既有：geek/google/darcula/geek-blue/christmas/custom；用既有 i18n key）。`change` handler：`await api.setStorage('sync', { theme })`；若選 custom → 呼叫 `customTheme` 套用並顯示自訂面板；同時 `applyTheme`/`customTheme` **套用到 options page 自身**（即時預覽）。**不要 dispatch 任何 CustomEvent**（sidepanel 由 D6 bridge 反映）。
- 自訂主題面板：重用 `customThemeManager` 既有的色彩編輯/匯入匯出 API（與 dialog 相同呼叫）。
- 背景圖片：重用 `backgroundImageManager` 既有的上傳/不透明度/模糊/位置 API；變更後 `await bgImage.loadAndApplyBackgroundImage()` 套用到 options page 自身。

用 `.opt-row` 版面包裝各控制項。

- [ ] **Step 3: 驗證**

Run: `make`（OK）；手動：`chrome://extensions` → 本擴充 → 詳細資料 → 擴充功能選項（或 `chrome-extension://<id>/options.html`）開啟 options page，確認外觀 section 控制項可操作、主題即時套用到頁面。
Run: `npm run test:unit`（不破壞）

- [ ] **Step 4: Commit**
```bash
git add options.js
git commit -m "feat(options): appearance section (theme/custom theme/background)"
```

---

## Task D3: 語言 + 功能顯示 section

**Files:** Modify `options.js`（`language`、`features` 兩個 render）。

- [ ] **Step 1: 參照**

READ `settingManager.js` 中 UI 語言下拉（`:408-411`）與各功能 toggle（reading list `:395`、AI 分組 `:418`、AI 自動命名 `:431`、AI 清理 `:439`、hover 摘要 `:451`、RL 摘要 `:459`）的建構與 handler，及其 storage key（見 spec §3）。

- [ ] **Step 2: 實作 renderLanguage**

UI 語言下拉（選項沿用既有 13+ 語系 + auto）。`change`：`await api.setStorage('sync', { uiLanguage })`。**不 reload**（sidepanel 由 D6 bridge reload；options page 自身可選擇 reload 以套用新語言，建議 reload options page 自身：`window.location.reload()`）。

- [ ] **Step 3: 實作 renderFeatures**

六個 toggle，每個 `.opt-row` 一列（label + desc + checkbox）。`change` handler：只 `await api.setStorage('sync', { <key>: e.target.checked })`。鍵：`readingListVisible`/`aiGroupingVisible`/`aiCleanupVisible`/`aiAutoNamingEnabled`/`hoverSummarizeEnabled`/`readingListSummaryEnabled`。**不 dispatch CustomEvent**。載入時用 `api.getStorage('sync', {...defaults})` 設定各 checkbox 初值（注意預設：多數預設 true，依既有 state 預設值）。

- [ ] **Step 4: 驗證**

Run: `make`；`npm run test:unit`。手動開 options page 確認語言/功能 section 可操作、storage 有寫入（DevTools Application → Storage）。

- [ ] **Step 5: Commit**
```bash
git add options.js
git commit -m "feat(options): language and feature-visibility sections"
```

---

## Task D4: RSS section

**Files:** Modify `options.js`（`rss` render）。

- [ ] **Step 1: 參照**

READ `settingManager.js` 的 `renderRssList`（`:482-...`）與相關 handler（新增/刪除/暫停/立即取得/間隔），及 `modules/rssManager.js` 的 export。

- [ ] **Step 2: 實作 renderRss**

把 RSS 訂閱清單 CRUD 重建在 options 的 rss section（版面用 `.opt-row` / 清單），重用 `rssManager` 的 API（getSubscriptions/add/remove/pause/fetchNow/setInterval 等，依實際 export 名）。新增訂閱用 `<input>` + 按鈕（options page 有空間，不需 modal prompt，可直接行內輸入）。

- [ ] **Step 3: 驗證**

Run: `make`；`npm run test:unit`。手動確認 RSS section 可新增/刪除訂閱、寫入 `rssSubscriptions`。

- [ ] **Step 4: Commit**
```bash
git add options.js
git commit -m "feat(options): RSS subscriptions section"
```

---

## Task D5: AI 模型狀態 + 快捷鍵 + 關於 section

**Files:** Modify `options.js`（`ai`、`shortcuts`、`about` render）。

- [ ] **Step 1: 參照**

READ `settingManager.js` 的 `detectAiModelStatus`（`:705-784`）、`getStatusBadge`（`:691`）、快捷鍵與關於區塊片段。

- [ ] **Step 2: 實作**

- **renderAi**：呼叫 AI 模型偵測邏輯（重用 `detectAiModelStatus` 的判定，或把它抽成 options 用版本），顯示 LanguageModel / Summarizer 可用性徽章 + 下載進度 + 設定指南（連到 chrome://flags / on-device-internals 的步驟文字）。
- **renderShortcuts**：顯示目前快捷鍵（Ctrl/Cmd+I、Alt+T）+ 按鈕連到 `chrome://extensions/shortcuts`（用 `chrome.tabs.create({url})`）。
- **renderAbout**：官網 / GitHub 連結。

- [ ] **Step 3: 驗證**

Run: `make`；`npm run test:unit`。手動開 options page 三個 section。

- [ ] **Step 4: Commit**
```bash
git add options.js
git commit -m "feat(options): AI status, shortcuts, and about sections"
```

---

## Task D6: Propagation bridge（純函式 + 接線 sidepanel）

**Files:** Create `modules/ui/settingsBridge.js`; Test `usecase_tests/unit_tests/settingsBridge.test.mjs`; Modify `sidepanel.js`.

- [ ] **Step 1: 寫失敗測試**

Create `usecase_tests/unit_tests/settingsBridge.test.mjs`:
```js
import { resolveSettingChangeActions } from '../../modules/ui/settingsBridge.js';

describe('resolveSettingChangeActions', () => {
  it('sync theme → applyTheme action', () => {
    const actions = resolveSettingChangeActions({ theme: { newValue: 'google' } }, 'sync');
    expect(actions).toContainEqual({ type: 'applyTheme', value: 'google' });
  });
  it('sync readingListVisible → dispatch event action', () => {
    const actions = resolveSettingChangeActions({ readingListVisible: { newValue: false } }, 'sync');
    expect(actions).toContainEqual({ type: 'dispatch', event: 'readingListVisibilityChanged', detail: { visible: false } });
  });
  it('sync uiLanguage → reload action', () => {
    const actions = resolveSettingChangeActions({ uiLanguage: { newValue: 'ja' } }, 'sync');
    expect(actions).toContainEqual({ type: 'reload' });
  });
  it('local custom_bg_image_data → applyBackground action', () => {
    const actions = resolveSettingChangeActions({ custom_bg_image_data: { newValue: 'x' } }, 'local');
    expect(actions).toContainEqual({ type: 'applyBackground' });
  });
  it('unrelated key → no actions', () => {
    expect(resolveSettingChangeActions({ someOtherKey: { newValue: 1 } }, 'sync')).toEqual([]);
  });
  it('aiCleanupVisible / aiGroupingVisible → dispatch their events', () => {
    expect(resolveSettingChangeActions({ aiCleanupVisible: { newValue: true } }, 'sync'))
      .toContainEqual({ type: 'dispatch', event: 'aiCleanupVisibilityChanged', detail: { visible: true } });
    expect(resolveSettingChangeActions({ aiGroupingVisible: { newValue: true } }, 'sync'))
      .toContainEqual({ type: 'dispatch', event: 'aiGroupingVisibilityChanged', detail: { visible: true } });
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**
Run: `npm run test:unit -- settingsBridge` → FAIL.

- [ ] **Step 3: 實作純函式 + 套用**

Create `modules/ui/settingsBridge.js`:
```js
/**
 * Settings propagation bridge.
 *
 * The options page (separate context) only writes to chrome.storage. The
 * sidepanel reacts to storage.onChanged. resolveSettingChangeActions maps a
 * change set to a list of UI actions; applySettingChanges executes them.
 */
import * as api from '../apiManager.js';
import { applyTheme } from './settingManager.js';
import * as customTheme from './customThemeManager.js';
import * as bgImage from './backgroundImageManager.js';

/**
 * Pure: map a storage change set to UI actions. No side effects.
 * @param {Object} changes chrome.storage.onChanged changes
 * @param {string} areaName 'sync' | 'local'
 * @returns {Array<object>}
 */
export function resolveSettingChangeActions(changes, areaName) {
    const actions = [];
    if (areaName === 'sync') {
        if (changes.theme) actions.push({ type: 'applyTheme', value: changes.theme.newValue });
        if (changes.customTheme) actions.push({ type: 'applyCustomTheme' });
        if (changes.backgroundImageConfig) actions.push({ type: 'applyBackground' });
        if (changes.uiLanguage) actions.push({ type: 'reload' });
        const evMap = {
            readingListVisible: 'readingListVisibilityChanged',
            aiGroupingVisible: 'aiGroupingVisibilityChanged',
            aiCleanupVisible: 'aiCleanupVisibilityChanged',
        };
        for (const [key, event] of Object.entries(evMap)) {
            if (changes[key]) actions.push({ type: 'dispatch', event, detail: { visible: changes[key].newValue } });
        }
    } else if (areaName === 'local') {
        if (changes.custom_bg_image_data) actions.push({ type: 'applyBackground' });
    }
    return actions;
}

/**
 * Executes the actions in the sidepanel context.
 */
export async function applySettingChanges(actions) {
    for (const a of actions) {
        try {
            if (a.type === 'applyTheme') {
                if (a.value === 'custom') await customTheme.loadAndApplyCustomTheme();
                else applyTheme(a.value);
            } else if (a.type === 'applyCustomTheme') {
                await customTheme.loadAndApplyCustomTheme();
            } else if (a.type === 'applyBackground') {
                await bgImage.loadAndApplyBackgroundImage();
            } else if (a.type === 'reload') {
                window.location.reload();
            } else if (a.type === 'dispatch') {
                document.dispatchEvent(new CustomEvent(a.event, { detail: a.detail }));
            }
        } catch (e) { console.warn('[settingsBridge] action failed', a, e); }
    }
}

/**
 * Subscribe in the sidepanel. Idempotent-safe.
 */
export function initSettingsBridge() {
    if (!chrome?.storage?.onChanged) return;
    chrome.storage.onChanged.addListener((changes, areaName) => {
        const actions = resolveSettingChangeActions(changes, areaName);
        if (actions.length) applySettingChanges(actions);
    });
}
```

Confirm exports exist: `applyTheme` (settingManager), `loadAndApplyCustomTheme` (customThemeManager), `loadAndApplyBackgroundImage` (backgroundImageManager). If names differ, adjust and report.

- [ ] **Step 4: 跑測試確認通過**
Run: `npm run test:unit -- settingsBridge` → 6 cases PASS. Full `npm run test:unit` green.

- [ ] **Step 5: 接線 sidepanel**

在 `sidepanel.js` 初始化處 import 並呼叫：
```js
import { initSettingsBridge } from './modules/ui/settingsBridge.js';
```
在 sidepanel 啟動序列（其他 init 旁）呼叫 `initSettingsBridge();`。確認不與既有 `subscribeToStorageChanges` 衝突（兩者都加 onChanged listener，獨立並存無妨）。

- [ ] **Step 6: 驗證 + Commit**
Run: `make`（OK）。
```bash
git add modules/ui/settingsBridge.js usecase_tests/unit_tests/settingsBridge.test.mjs sidepanel.js
git commit -m "feat(settings): storage.onChanged bridge to propagate options-page changes"
```

---

## Task D7: 齒輪改開 options page + 精簡 settingManager

**Files:** Modify `modules/ui/settingManager.js`（及確認無 dangling import）。

- [ ] **Step 1: 齒輪 handler 改 openOptionsPage**

把 `initThemeSwitcher`（`:785-817`）改為：保留載入套用主題/背景的區塊（`:802-816`），把齒輪 handler 換成：
```js
    settingsToggle.addEventListener('click', () => {
        if (chrome.runtime.openOptionsPage) {
            chrome.runtime.openOptionsPage();
        } else {
            chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
        }
    });
```

- [ ] **Step 2: 移除 dialog 程式碼**

刪除 `buildSettingsDialogContent`、`bindSettingsEventHandlers`、`renderRssList`、`detectAiModelStatus`、`getStatusBadge`、`getStatusBadge` 等**只服務舊 dialog**的函式，以及不再需要的 import（如 `modal`、`rss`，若僅 dialog 用）。**保留** `applyTheme`（export，options.js 與 bridge 都 import）、載入套用主題/背景的邏輯、以及任何 sidepanel 啟動仍需的 export。

- [ ] **Step 3: 確認無 dangling 參照**

Run（皆應只剩定義已移除、無外部引用，或已改指 options）：
```
grep -rn "buildSettingsDialogContent\|bindSettingsEventHandlers\|detectAiModelStatus\|renderRssList" modules/ sidepanel.js options.js
```
確認除了「已被刪除」外沒有殘留呼叫。`initThemeSwitcher` 仍被 sidepanel 呼叫 → 保留其名與載入邏輯。

- [ ] **Step 4: 驗證**
Run: `make`（OK，無 import 錯）；`npm run test:unit`（綠）。手動：sidepanel 齒輪 → 開啟 options page 分頁；在 options page 改 reading list 顯示 → 切回 sidepanel 確認即時反映（bridge 生效）。

- [ ] **Step 5: Commit**
```bash
git add modules/ui/settingManager.js
git commit -m "feat(settings): gear opens options page; remove in-sidepanel dialog"
```

---

## Task D8: i18n + 測試更新 + 全量驗證 + 收尾

**Files:** Modify `_locales/*/messages.json`; update `happy_path_settings_panel.test.js`; create `happy_path_options_page.test.js`.

- [ ] **Step 1: i18n nav key**

在所有 14 個 `_locales/<lang>/messages.json` 新增 7 個 nav key（英文 + 各語系翻譯，沿用批 B 的做法）：`settingsNavAppearance`/`settingsNavLanguage`/`settingsNavFeatures`/`settingsNavAi`/`settingsNavRss`/`settingsNavShortcuts`/`settingsNavAbout`。值（en / zh_TW）：Appearance/外觀、Language/語言、Features/功能顯示、AI & Experimental/AI 與實驗、RSS/RSS、Shortcuts/快捷鍵、About/關於（其餘語系給合理翻譯）。驗證所有檔 JSON valid（`for f in _locales/*/messages.json; do node -e "JSON.parse(require('fs').readFileSync('$f','utf8'))" && echo OK $f; done`）。

- [ ] **Step 2: 更新 settings_panel E2E**

`usecase_tests/puppeteer_tests/happy_path_settings_panel.test.js` 目前斷言點齒輪出現 `.modal-overlay`。改為斷言**點齒輪會開啟 options page**。由於 `chrome.runtime.openOptionsPage` 會開新分頁，E2E 中可改測：點齒輪後，存在一個 url 結尾為 `options.html` 的新分頁（用 `browser.pages()` 或監聽 target），或退一步直接 stub/驗證 click handler 觸發。若新分頁偵測在 harness 不穩，改為直接開 `chrome-extension://<id>/options.html` 驗證頁面渲染（與 D8 Step 3 的 options E2E 合併亦可）。務求穩定、不 flaky。

- [ ] **Step 3: options page E2E**

Create `usecase_tests/puppeteer_tests/happy_path_options_page.test.js`：直接導航到 `options.html`（取 extension id 後 `chrome-extension://<id>/options.html`），斷言左側 nav 七個項目、預設顯示外觀 section、點「功能顯示」切換 section、改一個 toggle 後 `chrome.storage.sync` 有對應寫入。跑兩次確認穩定。

- [ ] **Step 4: 全量驗證**
- `npm run test:unit`（全綠，含 settingsBridge）
- `npm run test:ci`（happy path 全綠，含更新後的 settings_panel）
- `make` 與 `make release`（dev + prod 皆 OK，zip 含 options.*）

- [ ] **Step 5: 文件收尾**
- 更新 `GEMINI.md`：新增 `options.html`/`options.js`/`settingsBridge.js` 的 key_files 描述；更新 `settingManager.js` 描述（精簡為 applyTheme + 載入套用 + 齒輪開 options page）。
- 寫 `.agent/notes/NOTE_20260529_phase12_batchD.md`（變更摘要 + #5 Google Drive 方向接續）。
```bash
git add -A && git commit -m "i18n/test/docs: options page nav keys, E2E updates, batch D notes"
```

- [ ] **Step 6: 最終 code review（整批）**
派最終 reviewer：重點 — 跨 context 只走 storage、bridge 涵蓋所有原 CustomEvent、舊 dialog 完全移除無 dangling、prod 打包含 options bundle、settings_panel 測試已更新。

---

## Self-Review（已執行）
- **Spec 覆蓋**：options_ui（D1）、左 nav IA（D1）、各 section 遷移（D2-D5）、bridge（D6）、齒輪 openOptionsPage + 移除 dialog（D7）、settings_panel 測試更新 + options E2E + 打包（D8）✓。#5 排除 ✓。
- **Placeholder**：確定性部分（manifest/scaffold/Makefile/bridge/gear）給完整碼；section 遷移誠實採「對照既有 dialog 程式碼改寫 + 換 handler 為 setStorage-only」（既有碼即規格，避免貼 300 行）。i18n/E2E 給明確步驟與穩定性要求。
- **型別一致**：`resolveSettingChangeActions(changes, areaName)`、`applySettingChanges`、`initSettingsBridge`、`renderAppearance/Language/Features/Rss/Ai/Shortcuts/About`、SECTIONS labelKey 跨任務一致。
- **風險**：行號為現況快照（以函式名定位）；section 遷移工作量大且依賴既有 manager export 名（D2-D5 要求先讀確認）；openOptionsPage 的 E2E 偵測可能需降級為直接導航 options.html。
