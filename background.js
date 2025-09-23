// 首次安裝擴充功能時執行的程式碼
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));
});

// 讓使用者點擊工具列圖示時，可以打開/關閉側邊欄
chrome.action.onClicked.addListener(async (tab) => {
    const { enabled } = await chrome.sidePanel.getOptions({ tabId: tab.id });
    if (enabled) {
        chrome.sidePanel.setOptions({
            tabId: tab.id,
            enabled: false
        });
    } else {
        chrome.sidePanel.setOptions({
            tabId: tab.id,
            path: 'sidepanel.html',
            enabled: true
        });
        chrome.sidePanel.open({ tabId: tab.id });
    }
});
