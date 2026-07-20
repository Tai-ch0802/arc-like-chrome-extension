# BASE-015：側邊欄區塊排序（Sidebar Section Order）

> 分級：**T1**（單檔 SPEC，隨 PR 一起審）
> 狀態：實作中｜2026-07-20

## 背景與問題

sidepanel 的四大區塊（分頁、其他視窗、閱讀清單、書籤）順序硬編碼在 `sidepanel.html`，使用者無法依自己的使用習慣調整（例如書籤優先於分頁）。此需求源自「模組系統」規劃（已因 MV3 合規紅線撤案），其中「區塊可排序」的地基工程被保留獨立交付；未來的快訊（newswire, BASE-016）區塊也將以此機制參與排序。

前置限制：`#content-container` 的子節點目前是扁平 sibling（header row、list、divider 交錯），只有 `#reading-list-section` 有 wrapper——要做區塊層級排序，必須先把每個區塊收斂成一致的可搬移單元。

## 方案

1. **Wrapper 化**（`sidepanel.html`）：把四大區塊各自包進 `<section class="panel-section" data-section-id="...">`，id 沿用 `{name}-section` 慣例（`#reading-list-section` 為既有範本，僅補 class 與 data 屬性）。**所有既有元素 id 不變**——E2E 已逐檔驗證 selector 全走 id/class，wrapper 化零回歸。`panel-section` 是透明容器，零新 CSS。
2. **順序偏好**：新增 `chrome.storage.sync` key **`sectionOrder`**（`string[]`，元素為 `data-section-id`）。預設順序 `['tabs', 'otherWindows', 'readingList', 'bookmarks']`。
3. **合併規則**（`modules/utils/sectionOrder.js`，純函式 `mergeSectionOrder(stored, actual)`）：
   - 以 stored 為序，過濾掉 actual（目前 DOM 實際存在的區塊）沒有的 id——容忍他裝置存了本機沒有的區塊（未來 newswire / 版本差）。
   - actual 有、stored 沒有的 id，依 actual 原序 append 到尾端（新區塊出現在尾端）。
   - **讀取端不回寫 storage**——只有使用者實際拖曳才寫入，避免 A 機把 B 機才有的區塊 id 從共用順序中洗掉。
4. **套用**（`modules/ui/sectionOrderUI.js`）：`applySectionOrder()` 讀取 → merge → 依序 `appendChild` 回 `#content-container`。選 DOM 重排而非 CSS `order`：零新樣式、DOM 序＝視覺序＝tab 序（a11y 直觀）、`appendChild` 搬移保留節點身分與既有事件監聽。
5. **跨頁傳播**：沿用既有 settingsBridge 模式——options 只寫 storage；`resolveSettingChangeActions` 新增 `sectionOrder` → dispatch `sectionOrderChanged`；sidepanel 監聽後重跑 `applySectionOrder()`。
6. **設定 UI**（options「外觀」末端）：`#section-order-list` 拖曳清單，Sortable 沿 `dragDropManager` 慣例（重建 instance、`onEnd` 序列化 DOM 順序寫入）；列 label 重用既有 `tabsHeader` / `otherWindowsHeader` / `readingListHeader` / `bookmarksHeader` i18n key。`options.html` 需補掛 `lib/Sortable.min.js`。

排除方案：CSS `order`（需把容器改 flex，且視覺序≠DOM 序傷 a11y）；上下移按鈕（需求明文要拖曳；a11y 稽核若要求可後補，不互斥）；鎖定 Tabs 第一位（使用者拍板全部可排序；日後要鎖只需 Sortable `filter` 一行）。

## 影響面

| 檔案 | 變更 |
|---|---|
| `sidepanel.html` | 四區塊 wrapper 化（純結構包裹，內部節點不動） |
| `modules/utils/sectionOrder.js` | 新增：`DEFAULT_SECTION_ORDER`、`mergeSectionOrder` 純函式 |
| `modules/ui/sectionOrderUI.js` | 新增：`applySectionOrder()`、`initSectionOrder()` |
| `modules/uiManager.js` | +1 行 re-export |
| `sidepanel.js` | `initialize()` 接線＋監聽 `sectionOrderChanged` |
| `modules/ui/settingsBridge.js` | sync 分支 +1 條映射 |
| `options.js` | `renderAppearance` 末端新增排序清單 |
| `options.html` | 掛 `lib/Sortable.min.js` |
| `_locales/*/messages.json` ×14 | +`appearanceSectionOrderHeader`、`appearanceSectionOrderDesc` |
| `GEMINI.md` | key_files 補 2 新檔 |
| Makefile | 不需動（無新進入點） |

Storage schema：+`sectionOrder`（sync，`string[]`，僅使用者拖曳時寫入，無 migration 需求）。

## Test Impact

- **新增 unit**：`usecase_tests/unit_tests/sectionOrder.test.mjs` —— merge 的過濾／append／空值 fallback／不變性。
- **擴充 unit**：`settingsBridge.test.mjs` —— `sectionOrder` → `sectionOrderChanged` dispatch。
- **新增 E2E**：storage-driven（直接寫 `sectionOrder` → 斷言 `#content-container` 子節點順序）；不做 puppeteer 拖曳模擬（已知 flaky 來源，拖曳互動由 unit＋手動驗證涵蓋）。
- **既有 E2E**：selector 全走 id/class，預期零回歸；`accessibility_checks` 需跑一次確認 `<section>` wrapper 無 heading/landmark 影響。

## 驗收條件

- [ ] 預設（無 `sectionOrder`）時區塊順序與現行完全一致。
- [ ] options 外觀頁可拖曳調整四區塊順序，放開即寫入 storage。
- [ ] 開啟中的 sidepanel 於拖曳後即時重排（不需重載）。
- [ ] 順序跨裝置漫遊（sync storage）；storage 含未知 id 時不噴錯、不回寫。
- [ ] `npm run test:unit`、`npm run test:ci` 全綠；`make` 打包成功。
