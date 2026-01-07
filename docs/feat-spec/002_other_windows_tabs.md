# Feature Specification: Other Windows / 他のウィンドウ / 其他視窗

> [!NOTE]
> Special thanks to [Yuugou Ohno](https://github.com/YuugouOhno) for contributing this feature via [PR #2](https://github.com/Tai-ch0802/arc-like-chrome-extension/pull/2).

## English

### Overview
This feature introduces an "Other Windows" section in the sidebar, allowing users to view and access tabs from other open Chrome windows directly within the current sidebar. The content in this section is **read-only** and meant for quick navigation.

### Functional Requirements
1.  **Display Other Windows**:
    -   A new section titled "Other Windows" is displayed below the current window's tab list.
    -   Lists all open Chrome windows excluding the current active window.
    -   Windows with no tabs are hidden.
    -   Each window is displayed as a collapsible folder, titled "Window {index} ({tabCount})".

2.  **Tab & Group Rendering**:
    -   Inside each window folder, tabs are listed vertically.
    -   **Tab Groups**: Tabs belonging to a tab group are nested under a collapsible group header.
        -   Group header displays the group title and color.
        -   Group collapse/expand state is independent.
    -   **Ungrouped Tabs**: Displayed directly under the window folder.

3.  **Read-Only Interaction**:
    -   **Switch to Tab**: Clicking a tab instantly activates that tab and brings its window to the foreground (`window.focused = true`).
    -   **Collapse/Expand**: Folders and groups can be toggled.
    -   **No Drag & Drop**: Tabs and groups in this section typically **cannot** be rearranged or dragged interactively. This prevents accidental modifications to other windows.
    -   **Collapse/Expand**:
        -   Window folders can be toggled to show/hide their contents.
        -   Tab groups within windows can be toggled.

4.  **Live Updates**:
    -   The list updates automatically when windows are created or removed (`chrome.windows.onCreated`, `chrome.windows.onRemoved`).
    -   Updates when tabs/groups change (via existing listeners in `updateTabList`).

### Technical Details
-   **Files Modified**: `modules/ui/tabRenderer.js`, `sidepanel.js`, `sidepanel.html` (header addition implied), `messages.json` (i18n).
-   **API Used**: `chrome.windows.getAll`, `chrome.tabGroups.query`, `chrome.tabs.query`.

---

## 日本語

### 概要
この機能は、サイドバーに「他のウィンドウ」セクションを追加し、ユーザーが現在開いている他のChromeウィンドウのタブをサイドバー内で直接確認・アクセスできるようにします。このセクションの内容は**読み取り専用**であり、クイックナビゲーションを目的としています。

### 機能要件
1.  **他のウィンドウの表示**:
    -   現在のウィンドウのタブリストの下に「他のウィンドウ」というタイトルの新しいセクションを表示します。
    -   現在のアクティブなウィンドウを除く、開いているすべてのChromeウィンドウをリストアップします。
    -   タブのないウィンドウは非表示になります。
    -   各ウィンドウは「Window {index} ({tabCount})」というタイトルの折りたたみ可能なフォルダとして表示されます。

2.  **タブとグループのレンダリング**:
    -   各ウィンドウフォルダ内に、タブが垂直にリストされます。
    -   **タブグループ**: タブグループに属するタブは、折りたたみ可能なグループヘッダーの下にネストされます。
        -   グループヘッダーには、グループのタイトルと色が表示されます。
        -   グループの折りたたみ/展開状態は独立しています。
    -   **グループ化されていないタブ**: ウィンドウフォルダの直下に表示されます。

3.  **読み取り専用インタラクション**:
    -   **タブへの切り替え**: タブをクリックすると、即座にそのタブがアクティブになり、そのウィンドウが最前面に表示されます（`window.focused = true`）。
    -   **折りたたみ/展開**:
        -   ウィンドウフォルダをクリックして、内容の表示/非表示を切り替えることができます。
        -   ウィンドウ内のタブグループも切り替え可能です。

4.  **リアルタイム更新**:
    -   ウィンドウが作成または削除されると、リストが自動的に更新されます（`chrome.windows.onCreated`, `chrome.windows.onRemoved`）。
    -   タブやグループが変更された場合も更新されます（`updateTabList`内の既存のリスナー経由）。

### 技術詳細
-   **変更されたファイル**: `modules/ui/tabRenderer.js`、`sidepanel.js`、`sidepanel.html`、`messages.json`（多言語対応）。
-   **使用API**: `chrome.windows.getAll`、`chrome.tabGroups.query`、`chrome.tabs.query`。

---

## 繁體中文

### 概述
此功能在側邊欄中引進了「其他視窗」區塊，允許使用者直接在當前側邊欄中檢視並存取其他開啟的 Chrome 視窗中的分頁。此區塊內容為**唯讀**，旨在提供快速導航。

### 功能需求
1.  **顯示其他視窗**：
    -   在當前視窗的分頁列表下方顯示標題為「其他視窗」的新區塊。
    -   列出除當前活動視窗外的所有開啟 Chrome 視窗。
    -   隱藏沒有任何分頁的視窗。
    -   每個視窗顯示為可折疊的資料夾，標題格式為「Window {index} ({tabCount})」。

2.  **分頁與群組渲染**：
    -   在每個視窗資料夾內，分頁垂直排列。
    -   **分頁群組**：屬於分頁群組的分頁會巢狀顯示在可折疊的群組標題下方。
        -   群組標題顯示群組名稱與顏色。
        -   群組的折疊/展開狀態是獨立的。
    -   **未群組分頁**：直接顯示在視窗資料夾下方。

3.  **唯讀互動**：
    -   **切換至分頁**：點擊分頁即會將該分頁設為活動狀態，並將其視窗帶至最上層 (`window.focused = true`)。
    -   **折疊/展開**：
        -   點擊視窗資料夾可切換顯示/隱藏其內容。
        -   視窗內的分頁群組也可進行切換。

4.  **即時更新**：
    -   當視窗建立或移除時，列表會自動更新 (`chrome.windows.onCreated`, `chrome.windows.onRemoved`)。
    -   當分頁或群組變更時也會更新 (透過 `updateTabList` 中既有的監聽器)。

### 技術細節
-   **修改檔案**：`modules/ui/tabRenderer.js`, `sidepanel.js`, `sidepanel.html`, `messages.json` (多語言支援)。
-   **使用 API**：`chrome.windows.getAll`, `chrome.tabGroups.query`, `chrome.tabs.query`。
