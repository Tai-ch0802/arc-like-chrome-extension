/**
 * Spotlight 啟動時的「來源 normal 視窗」。Spotlight 為獨立 popup 視窗,
 * item handler 必須作用於使用者的瀏覽器視窗,而非 popup 本身。
 */
let originWindowId = null;

/** @param {number|null|undefined} id */
export function setOriginWindowId(id) {
    originWindowId = (typeof id === 'number') ? id : null;
}

/** @returns {number|null} */
export function getOriginWindowId() {
    return originWindowId;
}
