import { isImageSrc } from '../../modules/utils/iconUtils.js';

describe('isImageSrc', () => {
  it('http / https favicon 視為圖片來源', () => {
    expect(isImageSrc('http://example.com/favicon.ico')).toBe(true);
    expect(isImageSrc('https://www.google.com/s2/favicons?domain=a.com')).toBe(true);
  });

  it('data: URI favicon 視為圖片來源（這正是溢出重疊 bug 的來源）', () => {
    expect(isImageSrc('data:image/svg+xml;base64,PHN2ZyB4bWxucz0i')).toBe(true);
    expect(isImageSrc('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
  });

  it('chrome / chrome-extension / blob / file scheme 視為圖片來源', () => {
    expect(isImageSrc('chrome://favicon/https://a.com')).toBe(true);
    expect(isImageSrc('chrome-extension://abc/icon.png')).toBe(true);
    expect(isImageSrc('blob:https://a.com/uuid')).toBe(true);
    expect(isImageSrc('file:///Users/x/icon.png')).toBe(true);
  });

  it('scheme 比對不分大小寫', () => {
    expect(isImageSrc('HTTPS://a.com/i.png')).toBe(true);
    expect(isImageSrc('Data:image/png;base64,AAAA')).toBe(true);
  });

  it('emoji / 短字串 / glyph 不視為圖片來源（應以文字渲染）', () => {
    expect(isImageSrc('🌐')).toBe(false);
    expect(isImageSrc('🔖')).toBe(false);
    expect(isImageSrc('📚')).toBe(false);
    expect(isImageSrc('•')).toBe(false);
    expect(isImageSrc('Workspace')).toBe(false);
  });

  it('非字串 / 空值防禦回傳 false', () => {
    expect(isImageSrc(undefined)).toBe(false);
    expect(isImageSrc(null)).toBe(false);
    expect(isImageSrc('')).toBe(false);
    expect(isImageSrc(123)).toBe(false);
    expect(isImageSrc({})).toBe(false);
  });

  it('不把含 scheme 字樣但非開頭的字串誤判（避免相對路徑/標題誤入）', () => {
    expect(isImageSrc('see http://a.com')).toBe(false);
    expect(isImageSrc('javascript:alert(1)')).toBe(false);
    expect(isImageSrc('mailto:a@b.com')).toBe(false);
  });
});
