# GitHub Actions Self-Hosted Runner

在 Ubuntu 24.04 VM 上部署 GitHub Actions self-hosted runner。

## 快速開始

```bash
# 1. 將 scripts/action-runner/ 目錄複製到 VM 上
scp -r scripts/action-runner/ user@your-vm:~/action-runner/

# 2. SSH 進入 VM
ssh user@your-vm

# 3. 建立 .env 檔案
cd ~/action-runner
cp .env.example .env
nano .env  # 填入 GITHUB_TOKEN

# 4. 執行安裝腳本
sudo bash setup-runner.sh
```

完成！Runner 會自動以 systemd 服務啟動。

## 管理指令

```bash
# 查看狀態
sudo ~/actions-runner/svc.sh status

# 停止
sudo ~/actions-runner/svc.sh stop

# 啟動
sudo ~/actions-runner/svc.sh start

# 移除服務
sudo ~/actions-runner/svc.sh uninstall
```

## 環境變數

| 變數 | 必填 | 預設值 | 說明 |
|------|:----:|--------|------|
| `GITHUB_OWNER` | ✅ | - | GitHub 使用者名稱或組織名稱 |
| `GITHUB_REPO` | ✅ | - | GitHub 儲存庫名稱 |
| `GITHUB_TOKEN` | ✅ | - | GitHub PAT (需 `repo` 或 `Administration` 權限) |
| `RUNNER_NAME` | | `vm-runner-<hostname>` | Runner 顯示名稱 |
| `RUNNER_LABELS` | | `self-hosted,linux,x64` | Runner 標籤 |
| `RUNNER_WORKDIR` | | `_work` | 工作目錄 |
| `RUNNER_VERSION` | | `2.331.0` | Runner 版本 |
| `RUNNER_USER` | | `runner` | 執行 Runner 的系統使用者 |

## 安全注意事項

> ⚠️ **公開倉庫警告**：Self-hosted runner 用於公開倉庫時，外部 PR 可能執行任意程式碼。
> 建議在 Settings → Actions → General 中限制 fork PR 的工作流程權限。

## 腳本說明

| 檔案 | 說明 |
|------|------|
| `setup-runner.sh` | 一鍵安裝腳本（需 sudo） |
| `.env.example` | 環境變數範本 |
| `.env` | 實際環境變數（已加入 .gitignore） |
