import { resolveTabGroupBadge } from '../../modules/ui/groupColors.js';

const groupMap = new Map([
  [10, { id: 10, title: 'Work', color: 'blue' }],
  [11, { id: 11, title: '', color: 'red' }], // 未命名群組
]);

describe('resolveTabGroupBadge', () => {
  it('回傳分頁所屬群組的 color 與 title', () => {
    expect(resolveTabGroupBadge({ groupId: 10 }, groupMap)).toEqual({ color: 'blue', title: 'Work' });
  });

  it('未命名群組 title 為空字串', () => {
    expect(resolveTabGroupBadge({ groupId: 11 }, groupMap)).toEqual({ color: 'red', title: '' });
  });

  it('未分組分頁 (groupId -1) 回傳 null', () => {
    expect(resolveTabGroupBadge({ groupId: -1 }, groupMap)).toBeNull();
  });

  it('groupId 不在 map 中回傳 null', () => {
    expect(resolveTabGroupBadge({ groupId: 99 }, groupMap)).toBeNull();
  });

  it('tab 缺 groupId 或為 null 時回傳 null', () => {
    expect(resolveTabGroupBadge({}, groupMap)).toBeNull();
    expect(resolveTabGroupBadge(null, groupMap)).toBeNull();
  });
});
