---
description: 建置、預覽與部署說明
---

# 建置與部署

## 建置說明

本專案使用 `make` 進行建置與打包。

```bash
# 產生 arc-sidebar-v<版本號>.zip 檔案
make
# 或
make package
```

> **需求**: 需要安裝 `jq` (一個命令列 JSON 處理工具) 才能自動讀取版本號。

## 預覽/測試說明

要在 Chrome 中測試此擴充功能：

1. 前往 `chrome://extensions`
2. 開啟「開發人員模式」
3. 點擊「載入未封裝的項目」
4. 選擇此專案的根目錄

## 部署說明

1. 執行 `make package` 來產生一個 `.zip` 格式的打包檔案
2. 前往 [Chrome 開發人員資訊主頁](https://chrome.google.com/webstore/devconsole) 上傳該檔案並發布
