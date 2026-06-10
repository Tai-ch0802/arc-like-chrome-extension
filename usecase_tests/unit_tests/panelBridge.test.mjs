import { classifyPendingAction, PANEL_ACTION_TTL_MS } from '../../modules/commandPalette/panelBridge.js';

describe('classifyPendingAction (ISSUE-162 A1/A3)', () => {
  const NOW = 1_000_000;
  const fresh = (overrides = {}) => ({ id: 'smart-group', windowId: 7, ts: NOW - 100, ...overrides });

  it('寄給我的新鮮動作 → execute', () => {
    expect(classifyPendingAction(fresh(), 7, NOW)).toBe('execute');
  });

  it('寄給別的視窗 → ignore(且呼叫端不得清旗標)', () => {
    expect(classifyPendingAction(fresh({ windowId: 99 }), 7, NOW)).toBe('ignore');
  });

  it('過期動作 → expired(任何 panel 都該清旗標)', () => {
    const stale = fresh({ ts: NOW - PANEL_ACTION_TTL_MS - 1 });
    expect(classifyPendingAction(stale, 7, NOW)).toBe('expired');
    // 即使是寄給別的視窗,過期優先 → 由看到的人清掉
    expect(classifyPendingAction({ ...stale, windowId: 99 }, 7, NOW)).toBe('expired');
  });

  it('剛好在 TTL 邊界內 → execute', () => {
    expect(classifyPendingAction(fresh({ ts: NOW - PANEL_ACTION_TTL_MS }), 7, NOW)).toBe('execute');
  });

  it('缺 windowId → 視為廣播,execute(向後相容防呆)', () => {
    const p = fresh();
    delete p.windowId;
    expect(classifyPendingAction(p, 7, NOW)).toBe('execute');
  });

  it('null / 缺 id → ignore', () => {
    expect(classifyPendingAction(null, 7, NOW)).toBe('ignore');
    expect(classifyPendingAction({}, 7, NOW)).toBe('ignore');
    expect(classifyPendingAction({ windowId: 7, ts: NOW }, 7, NOW)).toBe('ignore');
  });

  it('缺 ts → 不套 TTL,照定址判斷', () => {
    const p = fresh();
    delete p.ts;
    expect(classifyPendingAction(p, 7, NOW)).toBe('execute');
    expect(classifyPendingAction({ ...p, windowId: 99 }, 7, NOW)).toBe('ignore');
  });
});
