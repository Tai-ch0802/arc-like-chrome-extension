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

// ISSUE-257 WP1 (FR-1.03a): on a browser without tab groups (Dia) every live
// tab reports groupId -1, so a plain re-snapshot would strip the group fields
// and push that upstream. carryForwardGroups keeps the previous snapshot's
// group info for tabs with the same URL.
import { carryForwardGroups } from '../../modules/workspace/workspaceManager.js';

describe('carryForwardGroups', () => {
  const previous = [
    { url: 'https://a.com', title: 'A', pinned: false, groupKey: 100, groupTitle: 'Docs', groupColor: 'blue' },
    { url: 'https://b.com', title: 'B', pinned: false, groupKey: 100, groupTitle: 'Docs', groupColor: 'blue' },
    { url: 'https://c.com', title: 'C', pinned: false },
  ];

  it('restores group fields by URL from the previous snapshot', () => {
    const fresh = [
      { url: 'https://b.com', title: 'B2', pinned: false },
      { url: 'https://a.com', title: 'A', pinned: true },
    ];
    expect(carryForwardGroups(fresh, previous)).toEqual([
      { url: 'https://b.com', title: 'B2', pinned: false, groupKey: 100, groupTitle: 'Docs', groupColor: 'blue' },
      { url: 'https://a.com', title: 'A', pinned: true, groupKey: 100, groupTitle: 'Docs', groupColor: 'blue' },
    ]);
  });

  it('leaves new URLs ungrouped and does not invent fields for previously ungrouped tabs', () => {
    const fresh = [{ url: 'https://c.com', title: 'C' }, { url: 'https://new.com', title: 'N' }];
    expect(carryForwardGroups(fresh, previous)).toEqual([
      { url: 'https://c.com', title: 'C' },
      { url: 'https://new.com', title: 'N' },
    ]);
  });

  it('keeps group fields the fresh snapshot already has (live groups win)', () => {
    const fresh = [{ url: 'https://a.com', title: 'A', groupKey: 7, groupTitle: 'Live', groupColor: 'red' }];
    expect(carryForwardGroups(fresh, previous)).toEqual(fresh);
  });

  it('consumes each previous entry once for duplicate URLs, in order', () => {
    const prev = [
      { url: 'https://d.com', title: 'D1', groupKey: 1, groupTitle: 'G1', groupColor: 'green' },
      { url: 'https://d.com', title: 'D2' },
    ];
    const fresh = [{ url: 'https://d.com', title: 'x' }, { url: 'https://d.com', title: 'y' }, { url: 'https://d.com', title: 'z' }];
    expect(carryForwardGroups(fresh, prev)).toEqual([
      { url: 'https://d.com', title: 'x', groupKey: 1, groupTitle: 'G1', groupColor: 'green' },
      { url: 'https://d.com', title: 'y' },
      { url: 'https://d.com', title: 'z' },
    ]);
  });

  it('tolerates a missing previous snapshot and never mutates inputs', () => {
    const fresh = [{ url: 'https://a.com', title: 'A' }];
    const frozen = JSON.stringify(previous);
    expect(carryForwardGroups(fresh, undefined)).toEqual(fresh);
    carryForwardGroups(fresh, previous);
    expect(JSON.stringify(previous)).toBe(frozen);
    expect(fresh[0].groupKey).toBeUndefined();
  });
});

describe('buildSnapshotFromTabs with carryFrom', () => {
  it('applies carry-forward when no live group map is available', () => {
    const tabs = [{ url: 'https://a.com', title: 'A', pinned: false, groupId: -1 }];
    const prev = [{ url: 'https://a.com', title: 'A', groupKey: 100, groupTitle: 'Docs', groupColor: 'blue' }];
    expect(buildSnapshotFromTabs(tabs, null, { carryFrom: prev })).toEqual([
      { url: 'https://a.com', title: 'A', pinned: false, groupKey: 100, groupTitle: 'Docs', groupColor: 'blue' },
    ]);
  });
});
