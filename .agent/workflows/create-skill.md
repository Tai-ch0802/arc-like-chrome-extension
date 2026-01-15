---
description: 如何建立一個優秀的 Agent Skill
---

# 建立優秀的 Agent Skill

本工作流程描述如何建立符合 [Agent Skills 規範](https://agentskills.io) 的技能。

## 前置知識

Skills 是一組自定義指令，用來擴展 Agent 的功能。Agent 會根據 `description` 自動匹配並載入對應的技能。

## 目錄結構

```
.agent/skills/
└── skill-name/
    ├── SKILL.md              # 必要：核心指令 (< 500 行)
    ├── references/           # 選用：參考文件
    │   └── *.md
    ├── scripts/              # 選用：可執行腳本
    │   └── *.sh / *.py
    └── assets/               # 選用：靜態資源
        └── templates, images, etc.
```

## 步驟

### 1. 規劃技能範圍

決定技能的職責邊界：
- [ ] 這個技能要解決什麼問題？
- [ ] Agent 應該在什麼情境下使用它？
- [ ] 需要哪些參考資料或腳本支援？

### 2. 建立目錄

```bash
mkdir -p .agent/skills/<skill-name>
```

**命名規則**：
- 只能使用小寫字母、數字和連字號 (`a-z`, `0-9`, `-`)
- 不能以連字號開頭或結尾
- 不能有連續連字號 (`--`)
- 最長 64 字元

### 3. 撰寫 SKILL.md

建立 `.agent/skills/<skill-name>/SKILL.md`：

```markdown
---
name: skill-name
description: 描述技能做什麼，以及何時使用它。包含關鍵字幫助 Agent 識別相關任務。
---

# 技能標題

## 何時使用

描述觸發條件...

## 執行步驟

1. 第一步
2. 第二步
3. ...

## 範例

輸入與輸出範例...

## 邊界情況

常見問題處理...
```

#### Frontmatter 欄位

| 欄位 | 必要 | 說明 |
|------|------|------|
| `name` | ✅ | 技能名稱，需與目錄名稱相符 |
| `description` | ✅ | 1-1024 字元，描述用途與觸發時機 |
| `license` | ❌ | 授權資訊 |
| `compatibility` | ❌ | 環境需求（特定產品、套件、網路存取等） |
| `metadata` | ❌ | 額外的 key-value 資訊 |
| `allowed-tools` | ❌ | 預先核准的工具清單（實驗性） |

#### 撰寫優秀 description 的要點

✅ 好的範例：
```yaml
description: 從 PDF 檔案擷取文字與表格、填寫 PDF 表單、合併多個 PDF。當使用者處理 PDF 文件、提及表單或文件擷取時使用。
```

❌ 不好的範例：
```yaml
description: 處理 PDF。
```

### 4. 新增參考資料（選用）

若內容超過 500 行，拆分至 `references/`：

```bash
mkdir -p .agent/skills/<skill-name>/references
```

參考檔案範例：
- `REFERENCE.md` - 詳細技術參考
- `checklist.md` - 檢查清單
- 領域專屬文件

### 5. 新增腳本（選用）

若需要自動化腳本：

```bash
mkdir -p .agent/skills/<skill-name>/scripts
chmod +x .agent/skills/<skill-name>/scripts/*.sh
```

腳本應該：
- 自包含或清楚記載依賴
- 包含有用的錯誤訊息
- 妥善處理邊界情況

### 6. 驗證技能

使用 skills-ref 工具驗證（選用）：

// turbo
```bash
npx skills-ref validate .agent/skills/<skill-name>
```

手動檢查：
- [ ] `name` 與目錄名稱相符
- [ ] `description` 清楚描述用途與觸發時機
- [ ] SKILL.md 少於 500 行
- [ ] 檔案引用使用相對路徑

## 漸進式揭露原則

Agent 載入技能的方式：

1. **Metadata (~100 tokens)**：啟動時載入所有技能的 `name` 和 `description`
2. **Instructions (< 5000 tokens)**：啟用技能時載入完整 `SKILL.md`
3. **Resources**：按需載入 `scripts/`、`references/`、`assets/` 中的檔案

**最佳實踐**：保持 SKILL.md 精簡，詳細內容移至參考檔案。

## 範例：完整的技能結構

```
code-review/
├── SKILL.md                          # 核心指令
├── references/
│   ├── security-checklist.md         # 安全檢查清單
│   ├── performance-patterns.md       # 效能模式
│   └── style-guide.md                # 程式碼風格指南
└── scripts/
    └── lint-check.sh                 # 自動化檢查腳本
```
