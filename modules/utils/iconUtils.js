/**
 * 判斷字串是否為可作為 <img> src 的圖片來源(URL/URI),用以區分 favicon 與 emoji/glyph。
 *
 * 背景:Spotlight 結果列的圖示來源 item.icon 可能是 favicon(分頁的 favIconUrl)或短字串
 * (emoji,例如書籤 🔖)。若只認 http/https/chrome:// 而漏掉 data:/blob:/chrome-extension:/
 * file:,則 data URI favicon 會被當成 textContent 渲染,在固定寬度的圖示框內水平溢出並與
 * 相鄰列文字重疊。此函式集中判斷,凡屬下列 scheme 即視為圖片來源。
 *
 * 設計取捨:未知 scheme(如 protocol-relative //host、android-app://)刻意回傳 false 而以
 * 文字渲染;Chrome 的 favIconUrl 實務上不會是這些形式,且 .cmd-palette-icon 的
 * overflow:hidden 已能避免任何殘字溢出,故不擴充白名單以免誤判。
 *
 * @param {unknown} s
 * @returns {boolean}
 */
export function isImageSrc(s) {
    return typeof s === 'string'
        && /^(https?:|chrome:|chrome-extension:|data:|blob:|file:)/i.test(s);
}
