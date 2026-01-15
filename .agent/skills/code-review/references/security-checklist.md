# 安全檢查清單

Chrome 擴充功能程式碼審查時的安全檢查項目。

## 權限審查

- [ ] 確認 `manifest.json` 只請求必要的權限
- [ ] 避免使用 `<all_urls>` 除非絕對必要
- [ ] 審查 `host_permissions` 的範圍是否過大

## 資料處理

- [ ] 使用者輸入是否經過驗證與清理
- [ ] 是否避免使用 `innerHTML`，改用 `textContent` 或 DOM API
- [ ] `eval()` 和 `new Function()` 是否被避免使用
- [ ] 敏感資料是否使用 `chrome.storage.local` 而非 `localStorage`

## 內容安全政策 (CSP)

- [ ] 確認沒有內聯腳本 (inline scripts)
- [ ] 確認沒有內聯事件處理器 (`onclick` 等 HTML 屬性)
- [ ] 外部資源是否來自可信任的來源

## API 使用

- [ ] Chrome API 回呼是否正確處理錯誤
- [ ] 是否檢查 `chrome.runtime.lastError`
- [ ] 跨來源請求是否必要且安全

## 第三方程式庫

- [ ] 第三方程式庫是否有已知漏洞
- [ ] 程式庫是否來自可信任的來源
- [ ] 是否定期更新依賴項
