import { createEventBuffer, NEWSWIRE_EVENTS_KEY } from '../../modules/newswire/eventBuffer.js';

const mkEvent = (id, ts) => ({ id, tsSource: ts, tsIngest: ts, source: 'tree', sourceId: id, title: id });

function makeDeps(stored = { events: [] }) {
  const writes = [];
  const timers = [];
  return {
    writes,
    timers,
    deps: {
      cap: 5,
      persistDelayMs: 2000,
      getStorage: async (area, defaults) => ({ ...defaults, [NEWSWIRE_EVENTS_KEY]: stored }),
      setStorage: async (area, items) => { writes.push(items); },
      setTimer: (fn) => { timers.push(fn); return timers.length; },
      clearTimer: (id) => { timers[id - 1] = null; },
    },
  };
}

describe('newswire eventBuffer (BASE-016 N1)', () => {
  it('init loads stored events and caps them', async () => {
    const { deps } = makeDeps({ events: [1, 2, 3, 4, 5, 6, 7].map((n) => mkEvent(`e${n}`, n)) });
    const buf = createEventBuffer(deps);
    const events = await buf.init();
    expect(events.length).toBe(5);
  });
  it('append sorts newest-first and trims to cap', async () => {
    const { deps } = makeDeps();
    const buf = createEventBuffer(deps);
    await buf.init();
    buf.append([mkEvent('a', 100), mkEvent('b', 300)]);
    buf.append([mkEvent('c', 200), mkEvent('d', 400), mkEvent('e', 50), mkEvent('f', 500)]);
    expect(buf.getEvents().map((e) => e.id)).toEqual(['f', 'd', 'b', 'c', 'a']); // cap 5, 'e'(50) 淘汰
  });
  it('debounces persists: only the last scheduled timer writes', async () => {
    const { deps, writes, timers } = makeDeps();
    const buf = createEventBuffer(deps);
    await buf.init();
    buf.append([mkEvent('a', 1)]);
    buf.append([mkEvent('b', 2)]);
    expect(writes.length).toBe(0);           // debounce 中,尚未寫入
    expect(timers[0]).toBeNull();            // 第一個 timer 被 clear
    await timers[1]();                       // 觸發最後一個 timer
    expect(writes.length).toBe(1);
    expect(writes[0][NEWSWIRE_EVENTS_KEY].events.map((e) => e.id)).toEqual(['b', 'a']);
  });
  it('flush persists immediately and cancels pending timer', async () => {
    const { deps, writes } = makeDeps();
    const buf = createEventBuffer(deps);
    await buf.init();
    buf.append([mkEvent('a', 1)]);
    await buf.flush();
    expect(writes.length).toBe(1);
  });
  it('append with empty list is a no-op (no timer scheduled)', async () => {
    const { deps, timers } = makeDeps();
    const buf = createEventBuffer(deps);
    await buf.init();
    buf.append([]);
    expect(timers.length).toBe(0);
  });
});
