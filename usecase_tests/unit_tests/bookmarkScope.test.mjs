import { filterBookmarksUnderFolder } from '../../modules/bookmark/bookmarkUtils.js';

// 模擬 stateManager 的扁平快取結構：{ id, title, url, parentId, type }
const CACHE = [
  { id: 'F1', type: 'folder', parentId: '1' },
  { id: 'b1', type: 'bookmark', url: 'https://a.com', parentId: 'F1' },
  { id: 'F2', type: 'folder', parentId: 'F1' },          // F1 的子資料夾
  { id: 'b2', type: 'bookmark', url: 'https://b.com', parentId: 'F2' },
  { id: 'F3', type: 'folder', parentId: '1' },           // 另一棵
  { id: 'b3', type: 'bookmark', url: 'https://c.com', parentId: 'F3' },
];

describe('filterBookmarksUnderFolder', () => {
  it('收集資料夾子樹（含巢狀）內的書籤', () => {
    const ids = filterBookmarksUnderFolder(CACHE, 'F1').map(b => b.id).sort();
    expect(ids).toEqual(['b1', 'b2']);
  });

  it('不含其他資料夾的書籤', () => {
    const ids = filterBookmarksUnderFolder(CACHE, 'F3').map(b => b.id);
    expect(ids).toEqual(['b3']);
  });

  it('空資料夾回傳空陣列', () => {
    const ids = filterBookmarksUnderFolder(CACHE, 'F2-empty');
    expect(ids).toEqual([]);
  });

  it('無 folderId 回傳全部書籤（不含資料夾節點）', () => {
    const ids = filterBookmarksUnderFolder(CACHE, null).map(b => b.id).sort();
    expect(ids).toEqual(['b1', 'b2', 'b3']);
  });

  it('cache 非陣列時防禦回傳空陣列', () => {
    expect(filterBookmarksUnderFolder(null, 'F1')).toEqual([]);
  });
});
