import { buildSnapshotFromTabs, clusterCreatedTabsByGroup } from '../../modules/workspace/workspaceManager.js';

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

describe('clusterCreatedTabsByGroup', () => {
  it('依 groupKey 分群並保留出現順序', () => {
    const snap = [
      { url: 'a', groupKey: 1, groupTitle: 'G1', groupColor: 'blue' },
      { url: 'b', groupKey: 2, groupTitle: 'G2', groupColor: 'red' },
      { url: 'c', groupKey: 1, groupTitle: 'G1', groupColor: 'blue' },
      { url: 'd' }, // 未分組
    ];
    const createdTabIds = [11, 12, 13, 14];
    expect(clusterCreatedTabsByGroup(snap, createdTabIds)).toEqual([
      { tabIds: [11, 13], title: 'G1', color: 'blue' },
      { tabIds: [12], title: 'G2', color: 'red' },
    ]);
  });

  it('略過建立失敗 (createdTabIds 為 null) 的 index', () => {
    const snap = [
      { url: 'a', groupKey: 1, groupTitle: 'G1', groupColor: 'blue' },
      { url: 'b', groupKey: 1, groupTitle: 'G1', groupColor: 'blue' },
    ];
    const createdTabIds = [null, 22];
    expect(clusterCreatedTabsByGroup(snap, createdTabIds)).toEqual([
      { tabIds: [22], title: 'G1', color: 'blue' },
    ]);
  });

  it('排除 pinned 分頁（無法進 group）', () => {
    const snap = [
      { url: 'a', groupKey: 1, groupTitle: 'G1', groupColor: 'blue', pinned: true },
      { url: 'b', groupKey: 1, groupTitle: 'G1', groupColor: 'blue' },
    ];
    expect(clusterCreatedTabsByGroup(snap, [31, 32])).toEqual([
      { tabIds: [32], title: 'G1', color: 'blue' },
    ]);
  });

  it('沒有任何 group 時回傳空陣列', () => {
    const snap = [{ url: 'a' }, { url: 'b' }];
    expect(clusterCreatedTabsByGroup(snap, [41, 42])).toEqual([]);
  });
});
