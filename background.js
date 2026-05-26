// background.js

import { handleAlarm as handleRssAlarm } from './modules/rssManager.js';
import { generateGroupName } from './modules/aiManager.js';

const AI_AUTO_NAMING_KEY = 'aiAutoNamingEnabled';

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

// 監聯 RSS 定時抓取鬧鐘
chrome.alarms.onAlarm.addListener(handleRssAlarm);

// AI Auto Group Naming: 當使用者建立一個空白名稱的新群組時，由 background
// 統一處理避免多 sidepanel 重複觸發。generateGroupName 內部已限制只在
// model === 'available' 時執行（不會 silent kick off model download）。
chrome.tabGroups.onCreated.addListener(async (group) => {
    try {
        if (group.title && group.title.trim()) return; // user provided a title

        const settings = await chrome.storage.sync.get([AI_AUTO_NAMING_KEY]);
        if (settings[AI_AUTO_NAMING_KEY] === false) return; // disabled by user

        const tabs = await chrome.tabs.query({ groupId: group.id });
        if (!tabs || tabs.length === 0) return;

        const label = await generateGroupName(tabs.map(t => ({ title: t.title, url: t.url })));
        if (!label) return;

        // Re-check before writing: the user may have typed a title while
        // the AI request was in flight. Don't clobber human input.
        const current = await chrome.tabGroups.get(group.id);
        if (current.title && current.title.trim()) return;

        await chrome.tabGroups.update(group.id, { title: label });
    } catch (err) {
        // Group may have been removed, or AI call may have failed.
        // Naming is best-effort by design (PRD FR-1.06 silent skip).
        console.warn('[AI naming] skipped:', err && err.message ? err.message : err);
    }
});

// 監聽來自側邊面板的訊息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'openShortcutsPage') {
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
    return false;
  } else if (message.action === 'openAppearanceSettingsPage') {
    chrome.tabs.create({ url: 'chrome://settings/appearance' });
    return false;
  }
  // 不處理的 action：不攔截，讓 offscreen document 等其他 context 可以回應
});
