import { findDuplicates } from '../../modules/bookmark/dedupe.js';

describe('findDuplicates(items)', () => {
  it('傳入限定清單時只在該清單內找重複', () => {
    const items = [
      { id: '1', type: 'bookmark', title: 'A', url: 'https://x.com/p', parentId: 'F1' },
      { id: '2', type: 'bookmark', title: 'A2', url: 'https://x.com/p#frag', parentId: 'F1' },
      { id: '3', type: 'bookmark', title: 'B', url: 'https://y.com', parentId: 'F2' },
    ];
    const groups = findDuplicates(items);
    expect(groups.length).toBe(1);
    expect(groups[0].bookmarks.map(b => b.id).sort()).toEqual(['1', '2']);
  });

  it('無重複時回傳空陣列', () => {
    const items = [
      { id: '1', type: 'bookmark', title: 'A', url: 'https://x.com', parentId: 'F1' },
      { id: '2', type: 'bookmark', title: 'B', url: 'https://y.com', parentId: 'F1' },
    ];
    expect(findDuplicates(items)).toEqual([]);
  });
});
