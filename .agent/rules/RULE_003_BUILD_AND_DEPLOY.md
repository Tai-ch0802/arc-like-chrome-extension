---
description: 建置、預覽與部署說明
---

# 建置與部署

## 建置說明

本專案使用 `make` 進行建置與打包，**開發版與發布版是不同 target**：

```bash
# 開發版：產生 arc-sidebar-v<版本號>-dev.zip（原始碼直接打包）
make          # 等同 make package

# 發布版：產生 arc-sidebar-v<版本號>.zip（esbuild bundle + minify，供 Chrome Web Store）
make release

# 清理建置產物
make clean
```

> **需求**: 需要安裝 `jq` (命令列 JSON 處理工具) 才能自動讀取版本號；`make release` 另需 `npx esbuild`（npm devDependency）。

> ⚠️ **新增或改名檔案時，務必同步更新 `Makefile`**（開發版的 `DEV_SRC_FILES`、發布版的 `PROD_STATIC_FILES` 或 esbuild 指令），否則檔案不會進到 zip——過去發生過漏打包事故。

## 預覽/測試說明

要在 Chrome 中測試此擴充功能：

1. 前往 `chrome://extensions`
2. 開啟「開發人員模式」
3. 點擊「載入未封裝的項目」
4. 選擇此專案的根目錄

## 部署說明

1. 執行 `make package` 來產生一個 `.zip` 格式的打包檔案
2. 前往 [Chrome 開發人員資訊主頁](https://chrome.google.com/webstore/devconsole) 上傳該檔案並發布
