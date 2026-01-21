# Pull Request 提交前檢查清單

在建立 Pull Request 之前，請確認以下項目：

## 程式碼品質

- [ ] **Lint 檢查通過**: 程式碼符合專案的 coding style
- [ ] **無 Console 警告**: 控制台沒有新的錯誤或警告
- [ ] **無硬編碼**: 沒有硬編碼的密鑰、URL 或敏感資訊

## 測試

- [ ] **單元測試通過**: `npm test` 執行成功
- [ ] **新功能有測試**: 新增的功能已有對應的測試覆蓋
- [ ] **手動測試完成**: 已在本地手動驗證功能

## Git 相關

- [ ] **分支已推送**: 本地分支已推送至遠端
- [ ] **無 Merge Conflict**: 目標分支 (main) 沒有衝突
- [ ] **Commit 歷史清晰**: commit message 遵循 Conventional Commits

## PR 內容

- [ ] **標題清晰**: 使用 `type(scope): description` 格式
- [ ] **描述完整**: 包含變更摘要、變更內容、測試說明
- [ ] **雙語版本**: 包含繁體中文與英文描述
- [ ] **相關 Issue**: 已連結相關的 Issue (若有)
- [ ] **截圖/GIF**: UI 變更已附上視覺對照 (若適用)

## Reviewer 指定

- [ ] **指定 Reviewer**: 已指定適當的程式碼審查者
- [ ] **加入 Labels**: 已加入適當的標籤 (enhancement, bug, etc.)

## 額外檢查 (依情況)

- [ ] **文件更新**: README 或其他文件已同步更新
- [ ] **Breaking Changes**: 已標註任何破壞性變更
- [ ] **效能影響**: 已評估效能影響 (若為效能敏感變更)
- [ ] **安全性**: 變更不會引入安全漏洞

---

## 快速指令

```bash
# 檢查 lint
npm run lint

# 執行測試
npm test

# 檢查 git status
git status

# 推送分支
git push -u origin $(git branch --show-current)

# 建立 PR
gh pr create
```
