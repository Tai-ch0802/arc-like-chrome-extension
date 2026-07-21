// newswire 事件 ring buffer (BASE-016 N1)。
// 新→舊排列,cap 300 FIFO 淘汰;寫入 storage.local 以 2s debounce 批次,
// 避免高頻事件燒 storage 寫入。所有外部效果經 deps 注入(仿 syncEngine
// 的 DI 慣例),unit test 可注入 fake storage/timer。

import * as api from '../apiManager.js';

export const NEWSWIRE_EVENTS_KEY = 'newswireEvents';
export const EVENT_BUFFER_CAP = 300;
const PERSIST_DEBOUNCE_MS = 2000;

/**
 * @param {object} [deps]
 * @param {number} [deps.cap]
 * @param {number} [deps.persistDelayMs]
 * @param {Function} [deps.getStorage] (area, defaults) → Promise<object>
 * @param {Function} [deps.setStorage] (area, items) → Promise
 * @param {Function} [deps.setTimer] / {Function} [deps.clearTimer]
 */
export function createEventBuffer(deps = {}) {
    const {
        cap = EVENT_BUFFER_CAP,
        persistDelayMs = PERSIST_DEBOUNCE_MS,
        getStorage = api.getStorage,
        setStorage = api.setStorage,
        setTimer = (fn, ms) => setTimeout(fn, ms),
        clearTimer = (id) => clearTimeout(id),
    } = deps;

    let events = [];
    let timer = null;

    async function init() {
        const res = await getStorage('local', { [NEWSWIRE_EVENTS_KEY]: { events: [] } });
        const stored = res[NEWSWIRE_EVENTS_KEY];
        events = Array.isArray(stored?.events) ? stored.events.slice(0, cap) : [];
        return events;
    }

    function persistNow() {
        timer = null;
        return Promise.resolve(setStorage('local', { [NEWSWIRE_EVENTS_KEY]: { events } }))
            .catch((err) => console.warn('[newswire] buffer persist failed:', err?.message || err));
    }

    function schedulePersist() {
        if (timer) clearTimer(timer);
        timer = setTimer(persistNow, persistDelayMs);
    }

    /** 併入新事件(呼叫端已去重),依 tsSource 新→舊重排並裁到 cap。 */
    function append(fresh) {
        if (!Array.isArray(fresh) || !fresh.length) return events;
        events = fresh.concat(events);
        events.sort((a, b) => (b.tsSource || 0) - (a.tsSource || 0));
        if (events.length > cap) events = events.slice(0, cap);
        schedulePersist();
        return events;
    }

    function getEvents() {
        return events;
    }

    /** 立即落地(測試/終止前用);無待寫入時為 no-op。 */
    async function flush() {
        if (timer) { clearTimer(timer); timer = null; }
        await persistNow();
    }

    return { init, append, getEvents, flush };
}
