import * as api from '../apiManager.js';
import { searchBox, searchResultCount, noSearchResults, contentContainer } from './elements.js';

/**
 * 設定搜尋載入狀態
 * @param {boolean} isLoading - 是否正在搜尋中
 */
export function setSearchLoading(isLoading) {
    if (isLoading) {
        // Hide content and empty state, show loading message
        if (contentContainer) contentContainer.classList.add('hidden');
        if (noSearchResults) noSearchResults.classList.add('hidden');

        const loadingText = api.getMessage('searchSearching') || 'Searching...';
        searchResultCount.textContent = loadingText;
        searchResultCount.classList.remove('hidden');
    }
}

/**
 * 更新搜尋結果計數顯示
 * Note: This function implicitly resets the loading state set by setSearchLoading(true)
 * by updating searchResultCount with actual results.
 * @param {number} tabCount - 可見分頁數量
 * @param {number} bookmarkCount - 可見書籤數量
 */
export function updateSearchResultCount(tabCount, bookmarkCount) {
    const isSearching = searchBox.value.trim().length > 0;

    if (isSearching) {
        if (tabCount === 0 && bookmarkCount === 0) {
            // No results found: Hide content, show big empty state
            searchResultCount.classList.add('hidden');
            if (contentContainer) contentContainer.classList.add('hidden');
            if (noSearchResults) noSearchResults.classList.remove('hidden');
        } else {
            // Results found: Show content, hide big empty state, show small count
            if (contentContainer) contentContainer.classList.remove('hidden');
            if (noSearchResults) noSearchResults.classList.add('hidden');

            const message = api.getMessage('searchResultCount', [tabCount.toString(), bookmarkCount.toString()]);
            searchResultCount.textContent = message || `${tabCount} tabs, ${bookmarkCount} bookmarks`;
            searchResultCount.classList.remove('hidden');
        }
    } else {
        // Not searching: Show content, hide all search feedback
        searchResultCount.classList.add('hidden');
        if (contentContainer) contentContainer.classList.remove('hidden');
        if (noSearchResults) noSearchResults.classList.add('hidden');
    }
}
