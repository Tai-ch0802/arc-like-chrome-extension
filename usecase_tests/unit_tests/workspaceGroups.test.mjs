import { buildSnapshotFromTabs } from '../../modules/workspace/workspaceManager.js';

const groupsById = new Map([
  [100, { title: 'Docs', color: 'blue' }],
]);

describe('buildSnapshotFromTabs', () => {
  it('帶上分組分頁的 group 資訊', () => {
    const tabs = [
      { url: 'https://a.com', title: 'A', pinned: false, groupId: 100 },
    ];
    expect(buildSnapshotFromTabs(tabs, groupsById)).toEqual([
      { url: 'https://a.com', title: 'A', pinned: false, groupKey: 100, groupTitle: 'Docs', groupColor: 'blue' },
    ]);
  });

  it('未分組分頁 (groupId -1) 不帶 group 欄位', () => {
    const tabs = [{ url: 'https://b.com', title: 'B', pinned: true, groupId: -1 }];
    expect(buildSnapshotFromTabs(tabs, groupsById)).toEqual([
      { url: 'https://b.com', title: 'B', pinned: true },
    ]);
  });

  it('過濾掉非 http/file/ftp 的分頁', () => {
    const tabs = [
      { url: 'chrome://newtab/', title: 'NT', groupId: -1 },
      { url: 'https://c.com', title: 'C', groupId: -1 },
    ];
    expect(buildSnapshotFromTabs(tabs, groupsById).map(s => s.url)).toEqual(['https://c.com']);
  });

  it('groupId 不在 map 中時不帶 group 欄位', () => {
    const tabs = [{ url: 'https://d.com', title: 'D', groupId: 999 }];
    expect(buildSnapshotFromTabs(tabs, groupsById)).toEqual([
      { url: 'https://d.com', title: 'D', pinned: false },
    ]);
  });
});
