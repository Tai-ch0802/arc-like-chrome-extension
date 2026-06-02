# NOTE 2026-06-02 — Material 3 UI 重構（feat/m3-ui-overhaul）

## 背景
PR#151（spotlight）合併後,使用者回報三類 UI 問題並要求改善:
1. 工作區列頭部冗餘（下拉 + 齒輪兩個控制項）。
2. 全介面 emoji 圖示廉價、風格不一。
3. 整體視覺風格不一致（圓角、線條、動畫、focus 散亂）。

決策（經 AskUserQuestion 確認）:① dialog 列點擊即切換 ② Material Symbols Outlined
③ 替換範圍涵蓋側邊欄/Spotlight/設定頁/工作區圖示 ④ M3「更全面」、**色彩主題全保留**。
分支:自最新 main 開 `feat/m3-ui-overhaul`,獨立 PR。計畫檔:`~/.claude/plans/piped-juggling-scone.md`。

## 階段（每階段 commit、保持測試綠）
- **P1**（`39d8512`）sidepanel.css `:root` 新增 M3 token:shape scale（--arc-radius-xs/sm/md/lg/full）、
  state layer 不透明度與覆蓋色（color-mix over 主題 token）、elevation 階（1/3/5 alias 既有 shadow）、
  統一 focus ring、motion 語意 alias。純加法。
- **P2**（`39d8512`）`modules/icons.js` 改 Material Symbols Outlined（viewBox `0 -960 960 960`、
  fill=currentColor）。`ICONS` map（40 icon,以 gstatic 端點抓取、驗證 960 座標系）+
  `renderIcon`/`renderIconEl`/`hasIcon`;既有 12 個 `*_ICON_SVG` 沿用同名匯出、改以 Material
  Symbols 重繪、尺寸不變,呼叫端不需更動。`.m3-icon` 基礎類別。
- **P3**（`ffc358d`）emoji→SVG 全面替換:
  - 3a chevron 狀態化:單一 expand_more SVG + `is-collapsed` class（CSS rotate -90deg）取代
    `▶/▼` textContent;`dragDropManager` 拖曳展開改讀 `aria-expanded`;6 個 E2E + `setup.js`
    （新增 `waitForChevron`）改判 class/aria。
  - 3b 側邊欄動作鈕:`data-icon` 屬性 + sidepanel.js 注入;動作鈕拆 `.btn-icon`/`.btn-label`,
    `data-i18n` 移到 label span（避免 textContent=message 洗掉圖示）;14 locale 去動作鈕 emoji。
  - 3c Spotlight/命令列/Ask AI:actions.js icon→icon-id;buildRow dispatch 加 hasIcon 分支
    （favicon img → icon-id SVG → 文字）;dataProvider/nlSearch/spotlight onerror 改 SVG。
  - 3d 設定頁:AI 狀態徽章/RSS 控制/重啟提示/低對比警告改 SVG;aiGrouperUI 下載態改更新
    `.btn-label`;14 locale 清理 prose emoji。
- **P4**（`3c43e1c`）工作區列收斂為單一 `#workspace-switch-btn`→開管理 dialog;切換搬進
  dialog（每列 `.workspace-manage__switch` 點擊即切換,`performSwitch`,成功後關 dialog）;
  rename/delete/cloud 改 Material Symbols;`workspaceManager.resolveWorkspaceIcon`（icon-id→SVG、
  舊 emoji→經跳脫文字、其餘→work）+ `isValidWorkspaceIcon`（放寬守衛接受 icon-id 或 <=4 emoji,
  仍拒任意長遠端字串）;PRESET_ICONS 改 icon-id。
- **P5**（`80a495f`）套用 token 至元件 + 修對抗式 review 發現:
  - 圓角/elevation/focus-ring/state-layer-pressed 套用至 input/button/modal/menu/列/工作區鈕。
  - **修 [major]** sidepanel.js `manage-workspaces` 指向已移除 id → 改 `#workspace-switch-btn`;
    `#settings-toggle` Material Symbols(fill) 的 stroke 著色失效 → 改 color;清單列雙 focus ring →
    unified ring 僅作用於 `<button>`。
  - **修 [minor]** driveSyncBadge 的 ↻/☁︎/⚠ → Material Symbols(sync/cloud/warning,
    glyph→iconId + renderIcon + escapeHtml,同步單元測試);工作區 dialog 改 scoped close handle;
    renderIconEl 防 null + label 跳脫;ws-emoji 尺寸對齊。

## 驗證
- `test:unit` **239 綠**(含改寫的 driveSyncBadge 測試);四 entrypoint + sidepanel.css esbuild 解析 OK;
  `make` dev build 含所有新檔。所有 icon-id 引用皆存在(腳本核對 **0 遺漏**)。
- E2E:核心套件(chevron toggle、tab_to_bookmark、empty_folder、search_group_expand、
  workspace_group_restore、sidepanel_load、spotlight)逐一綠。
- **已知 flake**:`scroll_position_on_tab_click` 在 `npm test`(maxWorkers=2,40+ 套件並行)下
  常逾時(129s),但 **solo 0.5s 通過**(已 4 次)——屬機器資源 starvation、非本次回歸
  (timeout 非斷言失敗;serial maxWorkers=1 用以取得權威乾淨紀錄)。

## 對抗式 review（每階段獨立 workflow,3 視角）
- icon 系統 / 完整性 / 安全(data: SVG via <img> = secure static mode、textContent/escapeHtml 無 XSS)。
- 工作區 P4 流程 / 向後相容 / 無殘留舊 DOM 引用。
- CSS/M3/a11y 回歸(token 解析、跨主題 color-mix、focus 不重疊/不裁切、reduced-motion 涵蓋 chevron)。

## 已知取捨 / 後續（非阻斷）
- **AI 分頁群組「名稱」的 emoji**（`aiManager.js` prompt 第 ~338 行刻意指示 AI 為群組加 emoji
  前綴）**保留**:Chrome 原生分頁群組標題無法用 SVG、且屬內容生成功能。如要移除需改 prompt
  行為,待使用者確認。
- `.header-action-btn` 基底為 danger-red:`#ai-cleanup-btn`/`#bookmark-tools-btn` 沿用紅色
  （僅 `#ai-group-btn` 有 info-blue override）。屬**既有**樣式,非本次造成;如要中性化非破壞性
  動作鈕色彩,為可選 follow-up（使用者要求保留色彩,故未動）。
- 部分 M3 token（radius-xs/full、state-layer-hover/accent、easing-emphasized）作為完整 scale
  保留,目前未全部引用（無害）。

## MV3 合規
inline SVG 經 innerHTML 為合法 markup（manifest CSP `script-src 'self'; object-src 'none'` 不需變更）;
無外部字型/CDN（Material Symbols path 內嵌）;workspace/textUtils/icons 於 SW 情境僅匯入不執行 DOM API。
