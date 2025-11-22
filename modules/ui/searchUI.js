import * as api from '../apiManager.js';
import { searchBox, searchResultCount } from './elements.js';

/**
 * 更新搜尋結果計數顯示
 * @param {number} tabCount - 可見分頁數量
 * @param {number} bookmarkCount - 可見書籤數量
 */
export function updateSearchResultCount(tabCount, bookmarkCount) {
    if (tabCount === 0 && bookmarkCount === 0) {
        searchResultCount.textContent = api.getMessage('searchNoResults') || 'No results found';
        searchResultCount.classList.remove('hidden');
    } else if (searchBox.value.trim().length > 0) {
        // 使用 i18n 訊息格式化文字
        const message = api.getMessage('searchResultCount', [tabCount.toString(), bookmarkCount.toString()]);
        searchResultCount.textContent = message || `${tabCount} tabs, ${bookmarkCount} bookmarks`;
        searchResultCount.classList.remove('hidden');
    } else {
        searchResultCount.classList.add('hidden');
    }
}
