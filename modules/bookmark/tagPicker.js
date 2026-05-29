/**
 * Tag Picker — 共用的「標籤勾選」元件與其純邏輯。
 * 元件只負責呈現與回傳選取狀態，寫入由呼叫端決定（單一職責）。
 */

/**
 * 比較原本與選取後的標籤集合，算出差異。
 * @param {string[]} original 原本已貼的 tagId
 * @param {string[]} selected 使用者選取後的 tagId
 * @returns {{toAdd: string[], toRemove: string[]}}
 */
export function diffTagSelection(original, selected) {
    const o = new Set(original);
    const s = new Set(selected);
    return {
        toAdd: selected.filter(id => !o.has(id)),
        toRemove: original.filter(id => !s.has(id)),
    };
}
