# PRD: Opinionated Design — 極簡美學打磨計畫

| Attribute | Details |
| :--- | :--- |
| **Version** | v1.0 |
| **Status** | Draft |
| **Author** | Antigravity Agent |
| **Reviewers** | Tai |
| **Created** | 2026-02-27 |
| **Last Updated** | 2026-02-27 |
| **Strategic Context** | 產品戰略二：推行「固執的極簡美學」以解決設定臃腫問題 |

## 1. Introduction

### 1.1 Problem Statement

許多擴充功能走的是「All-in-One 瑞士刀」路線——超過 100 個設定選項、同時支援多種顯示模式、可自訂 CSS。這讓使用者介面變得繁忙且有學習曲線，導致有大量使用者安裝後短時間內就解除安裝。

我們的套件需要走完全相反的路線——**Opinionated Design**。就像 Arc 瀏覽器不給你改 Tab Bar 的選項，因為他們相信自己的設計已經是最好的。我們需要透過圓潤的微動畫、絲滑的過渡效果、和精心打磨的視覺語言，讓使用者打開側邊欄的第一秒就被驚艷。

### 1.2 Goals & Objectives

- **目標 1**: 全面導入微動畫 (Micro-Animations) 系統，涵蓋分頁切換、群組展開/收合、Hover 回饋。
- **目標 2**: 強化拖曳體驗 (Drag & Drop Polish)，加入阻尼感、投影特效和吸附動畫。
- **目標 3**: 改良毛玻璃/材質感設計 (Glassmorphism)，讓側邊欄呈現現代化的視覺質感。
- **目標 4**: 統一設計語言 (Design Token System)，建立 CSS 變數系統以確保視覺一致性。

### 1.3 Success Metrics (KPIs)

- 使用者第一印象評分：在社群調查中 80% 以上評為「好看 / 非常好看」。
- Chrome Web Store 評價中「美觀」、「好看」相關關鍵字出現率提升 50%。
- 安裝後 7 天留存率提升 5%（減少因「看起來太陽春」而解安裝）。

## 2. User Stories

| ID | As a (Role) | I want to (Action) | So that (Benefit) | Priority |
| :--- | :--- | :--- | :--- | :--- |
| US-01 | 對美感有要求的使用者 | 看到分頁在 Hover 時有細膩的浮起陰影或半透明漸變效果 | 我感覺這個工具是高品質的，跟 Arc 一樣精緻 | High |
| US-02 | 效率型使用者 | 拖曳分頁時看到流暢的跟隨動畫和位移引導 | 我確認拖曳目標位置，操作更安心精準 | High |
| US-03 | 新使用者 | 第一次開啟側邊欄時看到柔和的淡入動畫和毛玻璃效果 | 我被驚喚，覺得這個工具很現代、很高級 | High |
| US-04 | 開發者 | 在維護 CSS 時有統一的 Design Token 系統 | 我能快速調整主題色而不破壞整體設計 | Medium |

## 3. Functional Requirements

### 3.1 微動畫系統 (Micro-Animation System)

| 需求編號 | 需求描述 | 優先級 |
| :--- | :--- | :--- |
| FR-1.01 | 分頁項目在 Hover 時，**應**呈現微妙的位移 (translateX 2~3px) 與陰影加深效果，回饋時間 ≤ 150ms。 | High |
| FR-1.02 | 分頁群組在展開/收合時，**應**使用平滑高度過渡動畫 (max-height 或 FLIP 技術)，避免突兀的跳動。 | High |
| FR-1.03 | 分頁切換時（點擊切換到另一分頁），**應**有微妙的 active indicator 滑動動畫（而非瞬間切換）。 | Medium |
| FR-1.04 | 新增分頁加入列表時，**應**有淡入 (fade-in) + 滑入 (slide-in) 的進場動畫。 | Medium |
| FR-1.05 | 分頁關閉時，**應**有極短的收縮淡出動畫 (shrink-out)，而非瞬間消失。 | Medium |
| FR-1.06 | 所有動畫**應**遵循 `prefers-reduced-motion` 媒體查詢，在使用者啟用「減少動態效果」時自動停用。 | High |

### 3.2 拖曳體驗打磨 (Drag & Drop Polish)

| 需求編號 | 需求描述 | 優先級 |
| :--- | :--- | :--- |
| FR-2.01 | 拖曳分頁時，被拖曳的元素**應**呈現略微放大 (scale 1.03) + 毛玻璃陰影的「浮起」效果。 | High |
| FR-2.02 | 拖曳進入書籤資料夾的 Drop Zone 時，目標資料夾**應**以 highlight 脈動動畫 (pulse) 作為接收回饋。 | High |
| FR-2.03 | 拖曳放下後，元素**應**以彈性回彈 (spring-like easing) 動畫落定到最終位置。 | Medium |
| FR-2.04 | 拖曳佔位符 (placeholder)**應**使用虛線框 + 漸變背景，清楚標示即將插入的位置。 | Medium |

### 3.3 材質感設計 (Glassmorphism / Material)

| 需求編號 | 需求描述 | 優先級 |
| :--- | :--- | :--- |
| FR-3.01 | 側邊欄整體背景**應**支援 `backdrop-filter: blur()` 毛玻璃效果（在用戶設有背景圖片時啟用）。 | High |
| FR-3.02 | Toast 通知、Modal 對話框**應**使用半透明背景 + 模糊效果的材質感設計。 | Medium |
| FR-3.03 | 深色模式**應**使用有層次的灰色系（不同的 opacity 疊加），而非單一純黑。 | High |

### 3.4 Design Token 系統

| 需求編號 | 需求描述 | 優先級 |
| :--- | :--- | :--- |
| FR-4.01 | 建立統一的 CSS Custom Properties 系統，涵蓋：色彩 (color)、間距 (spacing)、圓角 (radius)、動畫時長 (duration)、緩動函數 (easing)。 | High |
| FR-4.02 | 所有元件的視覺屬性**應**引用 Design Token，禁止 hardcode 色碼或尺寸。 | High |
| FR-4.03 | Design Token **應**支援動態主題切換（Light/Dark/Custom），透過切換 root CSS 類別即可全域更新。 | High |

## 4. Acceptance Criteria

### AC for FR-1.01: 分頁 Hover 微動畫

```gherkin
Given 側邊欄顯示分頁列表
When 使用者將滑鼠游標移入某個分頁項目
Then 該分頁在 150ms 內產生 2~3px 的右移位移
  And 該分頁的 box-shadow 加深
When 使用者將滑鼠移出
Then 該分頁在 150ms 內恢復原始狀態
```

### AC for FR-1.06: 無障礙動畫降級

```gherkin
Given 使用者的系統偏好設定為「減少動態效果」(prefers-reduced-motion: reduce)
When 側邊欄載入
Then 所有微動畫時長設為 0ms 或使用即時切換
  And 拖曳特效簡化為基本的顏色變化
```

### AC for FR-2.01: 拖曳浮起效果

```gherkin
Given 側邊欄顯示分頁列表
When 使用者開始拖曳一個分頁
Then 被拖曳的分頁元素呈現 scale(1.03) 放大效果
  And 元素下方出現擴散陰影 (drop-shadow)
  And 元素背景增加毛玻璃效果
When 拖曳結束放下
Then 元素以 spring easing 動畫恢復至正常大小
```

### AC for FR-4.01: Design Token 系統

```gherkin
Given 開發者查看 CSS 原始碼
When 搜尋 hardcode 的色碼值 (如 #xxx 或 rgb())
Then 除了 Design Token 定義檔之外，不應出現任何 hardcode 色碼
  And 所有視覺屬性均引用 var(--arc-*) 變數
```

## 5. Non-Functional Requirements

- **Performance**: 所有動畫必須使用 GPU-accelerated 屬性 (`transform`, `opacity`)，不觸發 Layout/Reflow。FPS 在動畫期間應維持 ≥ 55。
- **Compatibility**: 毛玻璃效果 (backdrop-filter) 在不支援的瀏覽器上自動降級為半透明純色背景。
- **Accessibility**: 嚴格遵循 `prefers-reduced-motion` 媒體查詢。
- **Maintainability**: Design Token 系統應有文件化的命名規範 (e.g., `--arc-color-primary`, `--arc-anim-duration-fast`)。

## 6. Out of Scope

- 不新增更多使用者可調的設定項目（堅持 Opinionated 路線）。
- 不開放使用者自訂 CSS（保持設計的純粹性）。
- 不做 Popup 模式（專注 Sidebar 單一模式做到極致）。
- 不做動畫速度/幅度的使用者調校。

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| v1.0 | 2026-02-27 | Antigravity Agent | Initial draft |
