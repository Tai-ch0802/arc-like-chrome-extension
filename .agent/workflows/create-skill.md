---
description: 如何建立一個優秀的 Agent Skill
---

# 建立優秀的 Agent Skill

本工作流程描述如何建立符合 [Agent Skills 規範](https://agentskills.io) 的技能。

> [!TIP]
> 本專案已安裝 `skill-creator` 技能，提供完整的初始化與打包腳本。

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

詳細指引請參考 `skill-creator` 技能的 SKILL.md。

### 2. 初始化技能（推薦）

使用 `init_skill.py` 腳本自動建立技能目錄結構：

// turbo
```bash
python .agent/skills/skill-creator/scripts/init_skill.py <skill-name> --path .agent/skills
```

腳本會自動建立：
- `SKILL.md` 模板（含 TODO 提示）
- `scripts/` 目錄與範例腳本
- `references/` 目錄與範例文件
- `assets/` 目錄與範例資源

**命名規則**：
- 只能使用小寫字母、數字和連字號 (`a-z`, `0-9`, `-`)
- 不能以連字號開頭或結尾
- 不能有連續連字號 (`--`)
- 最長 64 字元

### 3. 撰寫 SKILL.md

編輯 `.agent/skills/<skill-name>/SKILL.md`，完成 TODO 項目：

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

若內容超過 500 行，拆分至 `references/`。

參考設計模式：
- **Multi-step processes**: 參見 `.agent/skills/skill-creator/references/workflows.md`
- **Output formats**: 參見 `.agent/skills/skill-creator/references/output-patterns.md`

### 5. 新增腳本（選用）

腳本應該：
- 自包含或清楚記載依賴
- 包含有用的錯誤訊息
- 妥善處理邊界情況

記得設定執行權限：
```bash
chmod +x .agent/skills/<skill-name>/scripts/*.py
```

### 6. 驗證技能

使用 `quick_validate.py` 驗證技能結構：

// turbo
```bash
python .agent/skills/skill-creator/scripts/quick_validate.py .agent/skills/<skill-name>
```

手動檢查：
- [ ] `name` 與目錄名稱相符
- [ ] `description` 清楚描述用途與觸發時機
- [ ] SKILL.md 少於 500 行
- [ ] 檔案引用使用相對路徑
- [ ] 刪除不需要的範例檔案

### 7. 打包技能（選用）

若需要分發技能，使用 `package_skill.py` 打包：

// turbo
```bash
python .agent/skills/skill-creator/scripts/package_skill.py .agent/skills/<skill-name>
```

這會建立一個 `<skill-name>.skill` 檔案（zip 格式）。

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
