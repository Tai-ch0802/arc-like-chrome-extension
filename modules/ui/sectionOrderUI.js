// Sidebar section-order applier (BASE-015).
//
// options 頁只寫 storage.sync.sectionOrder(拖曳清單在 options.js renderAppearance);
// 本模組在 sidepanel 端讀取偏好,依 data-section-id 以 appendChild 重排
// #content-container 下的 .panel-section wrapper — DOM 搬移保留節點身分與
// 既有事件監聽,因此不需要任何 renderer 重繪。後續變更經 settingsBridge
// 派發的 sectionOrderChanged 事件驅動。
import * as api from '../apiManager.js';
import { contentContainer } from './elements.js';
import { SECTION_ORDER_KEY, DEFAULT_SECTION_ORDER, mergeSectionOrder } from '../utils/sectionOrder.js';

/** 讀取偏好並重排區塊 wrapper;無偏好或形狀不符時還原預設順序。 */
export async function applySectionOrder() {
    if (!contentContainer) return;
    const sections = [...contentContainer.querySelectorAll(':scope > [data-section-id]')];
    if (!sections.length) return;
    const byId = new Map(sections.map(el => [el.dataset.sectionId, el]));
    // canonical 基準必須是「預設順序」而非目前 DOM 順序 — merge 的 fallback 段
    // 依 actual 排列,若拿 DOM 現況當 actual,清除偏好後會停在現況、永遠回不到預設。
    const canonical = [
        ...DEFAULT_SECTION_ORDER.filter(id => byId.has(id)),
        ...[...byId.keys()].filter(id => !DEFAULT_SECTION_ORDER.includes(id)),
    ];
    const stored = (await api.getStorage('sync', { [SECTION_ORDER_KEY]: [] }))[SECTION_ORDER_KEY];
    const order = mergeSectionOrder(stored, canonical);
    for (const id of order) contentContainer.appendChild(byId.get(id));
}

/** 套用初始順序並訂閱後續變更(sectionOrderChanged 由 settingsBridge 派發)。 */
export function initSectionOrder() {
    document.addEventListener('sectionOrderChanged', () => {
        applySectionOrder().catch(err => console.warn('[sectionOrder] apply failed:', err));
    });
    return applySectionOrder();
}
