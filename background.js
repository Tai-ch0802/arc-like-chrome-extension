// 首次安裝擴充功能時執行的程式碼
chrome.runtime.onInstalled.addListener(() => {
  // 這個設定會告訴瀏覽器，當使用者點擊工具列圖示「或觸發 _execute_action 指令」時，
  // 自動開關側邊欄。
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));
});

// 監聽來自側邊面板的訊息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'openShortcutsPage') {
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  } else if (message.action === 'openAppearanceSettingsPage') {
    chrome.tabs.create({ url: 'chrome://settings/appearance' });
  }
});