# 批 C：切換工作區還原 tab group Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 切換工作區時重建原本的 tab group（分群 + 標題 + 顏色），未分組分頁維持獨立。

**Architecture:** 把「快照映射」與「還原分群」的邏輯抽成兩個純函式（`buildSnapshotFromTabs`、`clusterCreatedTabsByGroup`）以便單元測試；`snapshotWindowTabs` 與 `switchWorkspace` 的 chrome-API 層保持薄。還原 group 為 best-effort（失敗不中斷切換）。

**Tech Stack:** Vanilla JS ESM、Chrome MV3 tabGroups API、Jest 單元 + Puppeteer E2E。

**測試指令：** 單元 `npm run test:unit`；E2E `npm test`；建置 `make`。
**前置：** 分支 `feat/workspace-restore-groups`（已建立）。只做 #4，#5 同步延後。

---

## 檔案結構

| 檔案 | 動作 |
|------|------|
| `modules/workspace/workspaceManager.js` | TabSnapshot typedef、新增兩個純函式、改寫 snapshotWindowTabs 與 switchWorkspace 還原、import addTabToNewGroup |
| `usecase_tests/unit_tests/workspaceGroups.test.mjs` | 兩個純函式的單元測試（新增） |
| `usecase_tests/puppeteer_tests/happy_path_workspace_group_restore.test.js` | E2E（新增，視穩定度） |

---

## Task C1: 純函式 `buildSnapshotFromTabs`

**Files:**
- Modify: `modules/workspace/workspaceManager.js`（新增 export）
- Test: `usecase_tests/unit_tests/workspaceGroups.test.mjs`（新增）

- [ ] **Step 1: 寫失敗測試**

新增 `usecase_tests/unit_tests/workspaceGroups.test.mjs`：

```js
import { buildSnapshotFromTabs } from '../../modules/workspace/workspaceManager.js';

const groupsById = new Map([
  [100, { title: 'Docs', color: 'blue' }],
]);

describe('buildSnapshotFromTabs', () => {
  it('帶上分組分頁的 group 資訊', () => {
    const tabs = [
      { url: 'https://a.com', title: 'A', pinned: false, groupId: 100 },
    ];
    expect(buildSnapshotFromTabs(tabs, groupsById)).toEqual([
      { url: 'https://a.com', title: 'A', pinned: false, groupKey: 100, groupTitle: 'Docs', groupColor: 'blue' },
    ]);
  });

  it('未分組分頁 (groupId -1) 不帶 group 欄位', () => {
    const tabs = [{ url: 'https://b.com', title: 'B', pinned: true, groupId: -1 }];
    expect(buildSnapshotFromTabs(tabs, groupsById)).toEqual([
      { url: 'https://b.com', title: 'B', pinned: true },
    ]);
  });

  it('過濾掉非 http/file/ftp 的分頁', () => {
    const tabs = [
      { url: 'chrome://newtab/', title: 'NT', groupId: -1 },
      { url: 'https://c.com', title: 'C', groupId: -1 },
    ];
    expect(buildSnapshotFromTabs(tabs, groupsById).map(s => s.url)).toEqual(['https://c.com']);
  });

  it('groupId 不在 map 中時不帶 group 欄位', () => {
    const tabs = [{ url: 'https://d.com', title: 'D', groupId: 999 }];
    expect(buildSnapshotFromTabs(tabs, groupsById)).toEqual([
      { url: 'https://d.com', title: 'D', pinned: false },
    ]);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npm run test:unit -- workspaceGroups`
Expected: FAIL（函式未匯出）

- [ ] **Step 3: 實作**

在 `modules/workspace/workspaceManager.js` 適當位置（建議在 `snapshotWindowTabs` 之前）新增 export：

```js
/**
 * 把 chrome.tabs.query 結果映射成 TabSnapshot[]，對分組分頁帶上 group 資訊。
 * 純函式，便於單元測試。
 * @param {Array<{url:string,title?:string,pinned?:boolean,groupId?:number}>} tabs
 * @param {Map<number,{title?:string,color:string}>} groupsById
 * @returns {Array}
 */
export function buildSnapshotFromTabs(tabs, groupsById) {
    return tabs
        .filter(t => t.url && /^(https?|file|ftp):/i.test(t.url))
        .map(t => {
            const snap = { url: t.url, title: t.title || '', pinned: Boolean(t.pinned) };
            const g = (t.groupId != null && t.groupId !== -1 && groupsById)
                ? groupsById.get(t.groupId)
                : null;
            if (g) {
                snap.groupKey = t.groupId;
                snap.groupTitle = g.title || '';
                snap.groupColor = g.color;
            }
            return snap;
        });
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npm run test:unit -- workspaceGroups`
Expected: PASS（4 passed）

- [ ] **Step 5: Commit**

```bash
git add modules/workspace/workspaceManager.js usecase_tests/unit_tests/workspaceGroups.test.mjs
git commit -m "feat(workspace): add buildSnapshotFromTabs with group capture"
```

---

## Task C2: 純函式 `clusterCreatedTabsByGroup`

**Files:**
- Modify: `modules/workspace/workspaceManager.js`（新增 export）
- Test: `usecase_tests/unit_tests/workspaceGroups.test.mjs`（追加 describe）

- [ ] **Step 1: 追加失敗測試**

在 `workspaceGroups.test.mjs` 檔案頂部 import 改為：
```js
import { buildSnapshotFromTabs, clusterCreatedTabsByGroup } from '../../modules/workspace/workspaceManager.js';
```
並追加：
```js
describe('clusterCreatedTabsByGroup', () => {
  it('依 groupKey 分群並保留出現順序', () => {
    const snap = [
      { url: 'a', groupKey: 1, groupTitle: 'G1', groupColor: 'blue' },
      { url: 'b', groupKey: 2, groupTitle: 'G2', groupColor: 'red' },
      { url: 'c', groupKey: 1, groupTitle: 'G1', groupColor: 'blue' },
      { url: 'd' }, // 未分組
    ];
    const createdTabIds = [11, 12, 13, 14];
    expect(clusterCreatedTabsByGroup(snap, createdTabIds)).toEqual([
      { tabIds: [11, 13], title: 'G1', color: 'blue' },
      { tabIds: [12], title: 'G2', color: 'red' },
    ]);
  });

  it('略過建立失敗 (createdTabIds 為 null) 的 index', () => {
    const snap = [
      { url: 'a', groupKey: 1, groupTitle: 'G1', groupColor: 'blue' },
      { url: 'b', groupKey: 1, groupTitle: 'G1', groupColor: 'blue' },
    ];
    const createdTabIds = [null, 22];
    expect(clusterCreatedTabsByGroup(snap, createdTabIds)).toEqual([
      { tabIds: [22], title: 'G1', color: 'blue' },
    ]);
  });

  it('排除 pinned 分頁（無法進 group）', () => {
    const snap = [
      { url: 'a', groupKey: 1, groupTitle: 'G1', groupColor: 'blue', pinned: true },
      { url: 'b', groupKey: 1, groupTitle: 'G1', groupColor: 'blue' },
    ];
    expect(clusterCreatedTabsByGroup(snap, [31, 32])).toEqual([
      { tabIds: [32], title: 'G1', color: 'blue' },
    ]);
  });

  it('沒有任何 group 時回傳空陣列', () => {
    const snap = [{ url: 'a' }, { url: 'b' }];
    expect(clusterCreatedTabsByGroup(snap, [41, 42])).toEqual([]);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npm run test:unit -- workspaceGroups`
Expected: FAIL（clusterCreatedTabsByGroup 未匯出）

- [ ] **Step 3: 實作**

在 `workspaceManager.js` 新增 export（緊接 `buildSnapshotFromTabs` 之後）：

```js
/**
 * 把已成功建立的還原分頁依其原始 groupKey 分群，供 addTabToNewGroup 重建。
 * 排除：建立失敗 (id 為 null/undefined)、未分組、pinned（無法進 group）。
 * 純函式。
 * @param {Array} snapshotTabs - TabSnapshot[]，與 createdTabIds 同 index 對齊
 * @param {Array<number|null>} createdTabIds - 每個 index 對應的新分頁 id（失敗為 null）
 * @returns {Array<{tabIds: number[], title: string, color: string}>}
 */
export function clusterCreatedTabsByGroup(snapshotTabs, createdTabIds) {
    const order = [];
    const byKey = new Map();
    for (let i = 0; i < snapshotTabs.length; i++) {
        const s = snapshotTabs[i];
        const tabId = createdTabIds[i];
        if (tabId == null) continue;
        if (s.groupKey == null) continue;
        if (s.pinned) continue;
        if (!byKey.has(s.groupKey)) {
            byKey.set(s.groupKey, { tabIds: [], title: s.groupTitle || '', color: s.groupColor });
            order.push(s.groupKey);
        }
        byKey.get(s.groupKey).tabIds.push(tabId);
    }
    return order.map(k => byKey.get(k)).filter(c => c.tabIds.length > 0);
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npm run test:unit -- workspaceGroups`
Expected: PASS（共 8 passed：C1 的 4 + C2 的 4）

- [ ] **Step 5: Commit**

```bash
git add modules/workspace/workspaceManager.js usecase_tests/unit_tests/workspaceGroups.test.mjs
git commit -m "feat(workspace): add clusterCreatedTabsByGroup for group restore"
```

---

## Task C3: 快照時捕捉 group（接線 snapshotWindowTabs）

**Files:**
- Modify: `modules/workspace/workspaceManager.js`（`snapshotWindowTabs`，約 `:203-214`；以及 TabSnapshot typedef `:36-40`）

- [ ] **Step 1: 更新 typedef**

把 `@typedef {Object} TabSnapshot` 區塊（`:36-40`）改為：
```js
 * @typedef {Object} TabSnapshot
 * @property {string} url
 * @property {string} title
 * @property {boolean} [pinned]
 * @property {number} [groupKey]    - 快照當下的原始 groupId，僅作同一快照內分群識別
 * @property {string} [groupTitle]
 * @property {string} [groupColor]
```

- [ ] **Step 2: 改寫 snapshotWindowTabs**

把 `snapshotWindowTabs`（`:203-214`）整段改為：
```js
async function snapshotWindowTabs(windowId) {
    const [tabs, groups] = await Promise.all([
        chrome.tabs.query({ windowId }).catch(() => []),
        chrome.tabGroups.query({ windowId }).catch(() => []),
    ]);
    const groupsById = new Map(groups.map(g => [g.id, { title: g.title, color: g.color }]));
    // Don't snapshot chrome:// or about: pages — buildSnapshotFromTabs filters them.
    return buildSnapshotFromTabs(tabs, groupsById);
}
```

- [ ] **Step 3: 驗證**

Run: `npm run test:unit`（全綠，含 workspaceGroups）
Run: `make`（建置 OK）

- [ ] **Step 4: Commit**

```bash
git add modules/workspace/workspaceManager.js
git commit -m "feat(workspace): capture tab group info in snapshots"
```

---

## Task C4: 還原時重建 group（接線 switchWorkspace）

**Files:**
- Modify: `modules/workspace/workspaceManager.js`（import + `switchWorkspace` 還原段 `:263-296`）

- [ ] **Step 1: 加 import**

把頂部 import 改為（新增 `addTabToNewGroup`）：
```js
import { getStorage, setStorage, setStorageStrict, addTabToNewGroup } from '../apiManager.js';
```

- [ ] **Step 2: 還原迴圈記錄 created id**

把 `switchWorkspace` 的還原迴圈（`let createdCount = 0;` 到迴圈結束，`:263-279`）改為：
```js
    let createdCount = 0;
    const createdTabIds = [];
    // Sequential create keeps the restored tab order stable. ~30ms/tab × 30 tabs
    // ≈ 1s worst case, acceptable for an explicit user action behind a confirm.
    for (let i = 0; i < snapshotTabs.length; i++) {
        const s = snapshotTabs[i];
        try {
            const newTab = await chrome.tabs.create({
                windowId,
                url: s.url,
                active: i === 0,
                pinned: s.pinned || false,
            });
            createdTabIds.push(newTab.id);
            createdCount++;
        } catch (err) {
            createdTabIds.push(null);
            console.warn('[workspace] failed to restore tab', s.url, err);
        }
    }
```

- [ ] **Step 3: 重建 group（best-effort，放在關閉舊分頁之後、setActiveWorkspace 之前）**

在 `if (oldTabIds.length > 0) { ... }` 區塊之後、`await setActiveWorkspace(windowId, targetId);` 之前，新增：
```js
    // Best-effort: rebuild the tab groups the snapshot captured. A failure here
    // must NOT undo the successful tab restore, so it's fully wrapped.
    try {
        const clusters = clusterCreatedTabsByGroup(snapshotTabs, createdTabIds);
        for (const c of clusters) {
            try {
                await addTabToNewGroup(c.tabIds, c.title, c.color, windowId);
            } catch (err) {
                console.warn('[workspace] failed to restore tab group', c.title, err);
            }
        }
    } catch (err) {
        console.warn('[workspace] group restore failed', err);
    }
```

- [ ] **Step 4: 驗證**

Run: `npm run test:unit`（全綠）
Run: `make`（建置 OK）
Re-read `switchWorkspace` 確認：createdCount 守衛仍在、createdTabIds 與 snapshotTabs 同 index、grouping 在 try/catch 內、回傳與既有相同。

- [ ] **Step 5: Commit**

```bash
git add modules/workspace/workspaceManager.js
git commit -m "feat(workspace): rebuild tab groups when switching workspace"
```

---

## Task C5: E2E + 全量驗證 + 收尾

**Files:**
- Create: `usecase_tests/puppeteer_tests/happy_path_workspace_group_restore.test.js`（視穩定度）

- [ ] **Step 1: 研究既有 E2E**

讀 `usecase_tests/puppeteer_tests/setup.js` 與 `happy_path_tab_group_toggle.test.js`（涉及 tab groups）與任何 workspace 相關 E2E（若有）。了解如何在測試中建立 tab group、開分頁、操作工作區切換。

- [ ] **Step 2: 嘗試 E2E（謹慎，可降級）**

理想流程：開兩三個分頁並把其中兩個分到一個有名稱+顏色的 group → 建立/快照成工作區 A → 切到另一工作區（或建空白）→ 切回 A → 斷言 A 的分頁還原且該 group 重建（`chrome.tabGroups.query` 找到對應 title/color，且兩個分頁的 groupId 相同）。

切換工作區會關閉整窗分頁、操作整個 window，E2E 可能不穩或影響其他測試。若不穩：
- 退而求其次，用 `page.evaluate` 直接在擴充 context 呼叫 `snapshotWindowTabs` 等不可行（內部函式未匯出）——故改以**單元測試（C1/C2）為核心覆蓋**，E2E 若無法穩定就標記 DONE_WITH_CONCERNS 並說明，不提交 flaky 測試。
- 跑兩次確認穩定才提交。

- [ ] **Step 3: 全量驗證**

Run: `npm run test:unit`（全綠，含 workspaceGroups 8 例）
Run: `npm run test:ci`（happy path 全綠，無回歸）
Run: `make`（建置 OK）

- [ ] **Step 4: 文件收尾**

- 更新 `GEMINI.md` 的 `key_files`：`workspaceManager.js` 補述「批C：快照捕捉 + 還原 tab group」。
- 寫 `.agent/notes/NOTE_20260529_phase12_batchC.md`（變更摘要 + #5 延後到 Google Drive 方向 + 批 D 待做）。

```bash
git add -A && git commit -m "test(e2e)/docs: workspace group restore + batch C note"
```

- [ ] **Step 5: 最終 code review（整批）**

派最終 reviewer 對 `git diff <batchC-base>..HEAD` 做整體審查（重點：still-best-effort、createdTabIds 對齊、pinned 排除、不破壞既有切換安全邏輯）。

---

## Self-Review（已執行）
- **Spec 覆蓋**：快照捕捉 group（C1+C3）、還原重建 group（C2+C4）、pinned 排除（C2）、建失敗對齊（C2）、best-effort（C4）✓。#5 正確排除（無任何 sync 任務）。
- **Placeholder**：純函式皆附完整碼與測試；E2E 誠實標註整窗操作的不穩風險與降級策略。
- **型別一致**：`buildSnapshotFromTabs(tabs, groupsById)`、`clusterCreatedTabsByGroup(snapshotTabs, createdTabIds)`、`addTabToNewGroup(tabIds, title, color, windowId)`、`groupKey/groupTitle/groupColor` 跨任務一致。
- **風險**：行號為現況快照，以函式名定位為準；E2E 可能降級為單元覆蓋。
