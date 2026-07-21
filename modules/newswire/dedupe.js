// newswire L1 去重 (BASE-016 N1)。
// (source, source_id) 精確去重:NewsEvent.id 即 `${source}:${sourceId}`。
// in-memory Map 依插入序 FIFO 淘汰;種子來自 ring buffer 既有事件 id,
// 使 SW 重啟/Tree history replay 不會重複入列。純函式工廠,零依賴。

export const DEDUPE_CAP = 1000;

/**
 * @param {string[]} [seedIds] 既有事件 id(通常來自 eventBuffer)
 * @param {number} [cap] 上限,超過淘汰最舊
 */
export function createDedupeSet(seedIds = [], cap = DEDUPE_CAP) {
    const map = new Map();
    const add = (id) => {
        if (map.has(id)) return;
        map.set(id, true);
        if (map.size > cap) map.delete(map.keys().next().value);
    };
    for (const id of seedIds) add(id);
    return {
        has: (id) => map.has(id),
        add,
        get size() { return map.size; },
    };
}
