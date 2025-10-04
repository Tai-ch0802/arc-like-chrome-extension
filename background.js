// background.js

// 監聽快捷鍵指令
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'create-new-tab-right') {
    // 查詢當前作用中的分頁
    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (currentTab) {
        const newTab = await chrome.tabs.create({
            index: currentTab.index + 1,
            active: true
        });
        // 如果當前分頁在群組中，也將新分頁加入同一個群組
        if (currentTab.groupId > 0) {
            await chrome.tabs.group({
                groupId: currentTab.groupId,
                tabIds: newTab.id
            });
        }
    }
  }
});

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
