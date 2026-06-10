import {
  normalizeUrlForMatch,
  scoreSnapshotSimilarity,
  matchWindowsToWorkspaces,
} from '../../modules/workspace/workspaceManager.js';

describe('normalizeUrlForMatch', () => {
  it('去除 #fragment', () => {
    expect(normalizeUrlForMatch('https://a.com/page#section-2')).toBe('https://a.com/page');
  });

  it('無 fragment 時原樣返回', () => {
    expect(normalizeUrlForMatch('https://a.com/page?q=1')).toBe('https://a.com/page?q=1');
  });

  it('非字串輸入返回空字串', () => {
    expect(normalizeUrlForMatch(null)).toBe('');
    expect(normalizeUrlForMatch(undefined)).toBe('');
  });
});

describe('scoreSnapshotSimilarity', () => {
  it('完全相同 → 1', () => {
    const urls = ['https://a.com/', 'https://b.com/'];
    expect(scoreSnapshotSimilarity(urls, [...urls])).toBe(1);
  });

  it('完全不同 → 0', () => {
    expect(scoreSnapshotSimilarity(['https://a.com/'], ['https://b.com/'])).toBe(0);
  });

  it('任一側為空 → 0', () => {
    expect(scoreSnapshotSimilarity([], ['https://a.com/'])).toBe(0);
    expect(scoreSnapshotSimilarity(['https://a.com/'], [])).toBe(0);
  });

  it('部分重疊以較大集合為分母(子集不會滿分)', () => {
    // 視窗只有 2 個分頁、快照有 4 個 → 2/4,不該因為是子集就 1.0
    const win = ['https://a.com/', 'https://b.com/'];
    const snap = ['https://a.com/', 'https://b.com/', 'https://c.com/', 'https://d.com/'];
    expect(scoreSnapshotSimilarity(win, snap)).toBe(0.5);
  });

  it('multiset 語意:重複 URL 各自計數', () => {
    const a = ['https://a.com/', 'https://a.com/'];
    const b = ['https://a.com/'];
    expect(scoreSnapshotSimilarity(a, b)).toBe(0.5);
  });

  it('fragment 差異不影響相似度', () => {
    expect(scoreSnapshotSimilarity(
      ['https://a.com/doc#intro'],
      ['https://a.com/doc#usage'],
    )).toBe(1);
  });
});

describe('matchWindowsToWorkspaces', () => {
  const ws = (id, urls) => ({ id, urls });
  const win = (windowId, urls) => ({ windowId, urls });

  it('session restore 的典型情境:兩視窗各自綁回正確工作區', () => {
    const result = matchWindowsToWorkspaces(
      [
        win(101, ['https://work.com/a', 'https://work.com/b']),
        win(102, ['https://play.com/x', 'https://play.com/y', 'https://play.com/z']),
      ],
      [
        ws('ws_work', ['https://work.com/a', 'https://work.com/b']),
        ws('ws_play', ['https://play.com/x', 'https://play.com/y', 'https://play.com/z']),
      ],
    );
    expect(result).toEqual([
      { windowId: 101, workspaceId: 'ws_work', score: 1 },
      { windowId: 102, workspaceId: 'ws_play', score: 1 },
    ]);
  });

  it('低於門檻不綁定', () => {
    const result = matchWindowsToWorkspaces(
      [win(101, ['https://a.com/', 'https://b.com/', 'https://c.com/'])],
      [ws('ws_1', ['https://a.com/', 'https://x.com/', 'https://y.com/'])],
      { threshold: 0.6 },
    );
    expect(result).toEqual([]);
  });

  it('greedy 1:1:同一工作區不會綁到兩個視窗,高分者優先', () => {
    const snapUrls = ['https://a.com/', 'https://b.com/', 'https://c.com/'];
    const result = matchWindowsToWorkspaces(
      [
        win(101, ['https://a.com/', 'https://b.com/']),          // score 2/3
        win(102, [...snapUrls]),                                  // score 1
      ],
      [ws('ws_1', snapUrls)],
    );
    expect(result).toEqual([{ windowId: 102, workspaceId: 'ws_1', score: 1 }]);
  });

  it('使用者重啟後小幅瀏覽過仍可綁回(0.6 門檻容忍)', () => {
    // 5 個分頁中 1 個被導航走 → 4/5 = 0.8 ≥ 0.6
    const snap = ['https://a.com/', 'https://b.com/', 'https://c.com/', 'https://d.com/', 'https://e.com/'];
    const winUrls = ['https://a.com/', 'https://b.com/', 'https://c.com/', 'https://d.com/', 'https://navigated-away.com/'];
    const result = matchWindowsToWorkspaces([win(101, winUrls)], [ws('ws_1', snap)]);
    expect(result).toHaveLength(1);
    expect(result[0].workspaceId).toBe('ws_1');
  });

  it('空輸入安全返回空陣列', () => {
    expect(matchWindowsToWorkspaces([], [])).toEqual([]);
    expect(matchWindowsToWorkspaces(undefined, undefined)).toEqual([]);
  });
});
