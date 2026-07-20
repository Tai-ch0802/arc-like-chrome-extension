// Pure helpers for the sidebar section-order preference (BASE-015).
// No chrome.* / DOM dependencies so this can run in Node/jsdom unit tests.

export const SECTION_ORDER_KEY = 'sectionOrder';

export const DEFAULT_SECTION_ORDER = ['tabs', 'otherWindows', 'readingList', 'bookmarks'];

/**
 * Merge the stored order preference with the sections actually present.
 *
 * 規則(BASE-015):
 * - 以 stored 的先後為準,但過濾掉 actual 沒有的 id — 其他裝置可能存了
 *   本機沒有的區塊(版本差/未來功能),讀取端只忽略、不回寫,以免洗掉
 *   別台裝置的排序。
 * - actual 有、stored 沒有的 id 依 actual 原序補在尾端(新區塊出現在最後)。
 *
 * @param {unknown} stored storage.sync.sectionOrder 的值(容忍任何形狀)
 * @param {string[]} actual 目前實際存在的 section id,依預設順序
 * @returns {string[]} 套用順序(actual 的一個排列)
 */
export function mergeSectionOrder(stored, actual) {
    const storedArr = Array.isArray(stored) ? stored : [];
    const actualArr = Array.isArray(actual) ? actual : [];
    const actualSet = new Set(actualArr);
    const result = [];
    const seen = new Set();
    for (const id of storedArr) {
        if (actualSet.has(id) && !seen.has(id)) {
            result.push(id);
            seen.add(id);
        }
    }
    for (const id of actualArr) {
        if (!seen.has(id)) {
            result.push(id);
            seen.add(id);
        }
    }
    return result;
}
