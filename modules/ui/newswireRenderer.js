// newswire sidepanel 區塊 renderer (BASE-016 N1)。
//
// 資料流:初始經 `newswire:getState` 向 SW 回填 ring buffer;即時事件由
// SW 廣播 `newswire:events` runtime message(多個 sidepanel 各自收到,
// 跨視窗一致)。快訊標題為外部不可信內容——一律 textContent,點擊開原文
// 前再驗一次 URL scheme。暫停/未讀為本頁 UI 狀態;未讀水位(lastSeenTs)
// 經 `newswire:markSeen` 持久化(per-device)。
import * as api from '../apiManager.js';
import * as state from '../stateManager.js';

const MAX_ROWS = 300;
const NEWSWIRE_COLLAPSED_KEY = 'newswireCollapsed';

let els = null;
let paused = false;
let pending = [];          // 暫停期間累積的事件(新→舊)
let unreadCount = 0;
let latestTs = 0;          // 已呈現事件的最大 tsIngest,markSeen 水位
let enabledAny = false;
let collapsed = false;
let sentinelVisible = false;

const taipeiTime = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Taipei',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
});

function renderRow(ev) {
    const row = document.createElement('div');
    row.className = 'newswire-item';
    if (ev.importance === 0) row.classList.add('newswire-item--p0');
    else if (ev.importance === 1) row.classList.add('newswire-item--p1');
    row.dataset.eventId = ev.id;

    const time = document.createElement('span');
    time.className = 'newswire-item__time';
    time.textContent = taipeiTime.format(new Date(ev.tsSource || ev.tsIngest || Date.now()));

    const source = document.createElement('span');
    source.className = 'newswire-item__source';
    source.textContent = ev.source || '';

    const title = document.createElement('span');
    title.className = 'newswire-item__title';
    title.textContent = ev.title || '';
    title.title = ev.title || '';

    row.append(time, source, title);

    if (ev.url) {
        row.classList.add('newswire-item--link');
        row.addEventListener('click', () => {
            try {
                const u = new URL(ev.url);
                if (u.protocol === 'http:' || u.protocol === 'https:') api.createTab({ url: u.href });
            } catch { /* 非法 URL:不動作 */ }
        });
    }
    return row;
}

function trimRows() {
    while (els.list.children.length > MAX_ROWS) els.list.lastChild.remove();
}

/** 整批重繪(初始回填;events 已為新→舊)。 */
function renderAll(events) {
    els.list.textContent = '';
    const frag = document.createDocumentFragment();
    for (const ev of events) frag.appendChild(renderRow(ev));
    els.list.appendChild(frag);
    trimRows();
    for (const ev of events) latestTs = Math.max(latestTs, ev.tsIngest || 0);
}

/** 插入即時事件於頂部(events 新→舊;由舊到新逐一插到最上方保持排序)。 */
function prependEvents(events) {
    for (let i = events.length - 1; i >= 0; i--) {
        els.list.insertBefore(renderRow(events[i]), els.list.firstChild);
        latestTs = Math.max(latestTs, events[i].tsIngest || 0);
    }
    trimRows();
}

function refreshBadge() {
    if (unreadCount > 0) {
        els.badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
        els.badge.classList.remove('hidden');
    } else {
        els.badge.classList.add('hidden');
    }
}

function refreshControls() {
    // 有任一來源啟用才顯示操作鈕與內容;否則顯示空狀態+前往設定。
    const hasRows = els.list.children.length > 0;
    els.empty.classList.toggle('hidden', enabledAny || hasRows);
    els.pauseBtn.classList.toggle('hidden', !enabledAny);
    els.markReadBtn.classList.toggle('hidden', !enabledAny);
}

function markSeenNow() {
    if (!unreadCount && !latestTs) return;
    unreadCount = 0;
    refreshBadge();
    api.sendRuntimeMessage({ action: 'newswire:markSeen', ts: latestTs || Date.now() })
        .catch(() => { /* SW 剛好重啟:下次 getState 會重新對齊 */ });
}

function onLiveEvents(events) {
    if (!Array.isArray(events) || !events.length) return;
    if (paused) {
        pending = events.concat(pending);
        return;
    }
    prependEvents(events);
    if (sentinelVisible && document.hasFocus()) {
        markSeenNow(); // 頂部在視野內:即到即讀(FR-12)
    } else {
        unreadCount += events.length;
        refreshBadge();
    }
    refreshControls();
}

function togglePause() {
    paused = !paused;
    const key = paused ? 'newswireResumeBtn' : 'newswirePauseBtn';
    const label = api.getMessage(key) || (paused ? 'Resume' : 'Pause');
    els.pauseBtn.textContent = label;
    els.pauseBtn.title = label;
    if (!paused && pending.length) {
        // 繼續:一次補齊暫停期間累積的事件(維持時間序,FR-13/AC-10)。
        const batch = pending;
        pending = [];
        onLiveEvents(batch);
    }
}

function setCollapsed(next) {
    collapsed = next;
    els.toggle.setAttribute('aria-expanded', String(!next));
    els.list.classList.toggle('collapsed', next);
    els.empty.classList.toggle('force-hidden', next);
}

function applyVisibility(visible) {
    els.section.style.display = visible ? '' : 'none';
}

/** sidepanel 初始化進入點(不進首屏關鍵路徑,掛在 init 尾端)。 */
export async function initNewswireSection() {
    els = {
        section: document.getElementById('newswire-section'),
        toggle: document.getElementById('newswire-toggle'),
        badge: document.getElementById('newswire-unread-badge'),
        pauseBtn: document.getElementById('newswire-pause-btn'),
        markReadBtn: document.getElementById('newswire-mark-read-btn'),
        sentinel: document.getElementById('newswire-top-sentinel'),
        list: document.getElementById('newswire-list'),
        empty: document.getElementById('newswire-empty'),
        emptyCta: document.getElementById('newswire-empty-cta'),
    };
    if (!els.section || !els.list) return;

    applyVisibility(state.isNewswireVisible());
    document.addEventListener('newswireVisibilityChanged', (e) => {
        applyVisibility(e.detail?.visible !== false);
    });

    const { [NEWSWIRE_COLLAPSED_KEY]: storedCollapsed } =
        await api.getStorage('sync', { [NEWSWIRE_COLLAPSED_KEY]: false });
    setCollapsed(storedCollapsed === true);
    els.toggle.addEventListener('click', async () => {
        setCollapsed(!collapsed);
        await api.setStorage('sync', { [NEWSWIRE_COLLAPSED_KEY]: collapsed });
    });

    els.badge.addEventListener('click', (e) => {
        e.stopPropagation(); // badge 在 toggle 按鈕內:點徽章=標記已讀,不觸發收合
        markSeenNow();
    });
    els.pauseBtn.addEventListener('click', togglePause);
    els.markReadBtn.addEventListener('click', markSeenNow);
    els.emptyCta.addEventListener('click', () => api.openOptionsPage());

    // 頂部 sentinel 進入視野=使用者看著列表頂 → 未讀歸零(FR-12 的捲動重置)。
    if (typeof IntersectionObserver === 'function') {
        const io = new IntersectionObserver((entries) => {
            sentinelVisible = entries[0]?.isIntersecting === true;
            if (sentinelVisible && unreadCount > 0 && document.hasFocus()) markSeenNow();
        });
        io.observe(els.sentinel);
    }

    api.addRuntimeMessageListener((message) => {
        if (!message || typeof message !== 'object') return;
        if (message.type === 'newswire:events') {
            onLiveEvents(message.events || []);
        } else if (message.type === 'newswire:status') {
            enabledAny = Object.values(message.statuses || {}).some((s) => s !== 'disabled');
            refreshControls();
        }
        // 不回應、不 return true:留給其他 listener。
    });

    try {
        const st = await api.sendRuntimeMessage({ action: 'newswire:getState' });
        if (st && !st.error) {
            enabledAny = st.enabledAny === true;
            renderAll(Array.isArray(st.events) ? st.events : []);
            const lastSeen = st.lastSeenTs || 0;
            unreadCount = (st.events || []).filter((e) => (e.tsIngest || 0) > lastSeen).length;
            refreshBadge();
        }
    } catch (err) {
        console.warn('[newswire] getState failed:', err?.message || err);
    }
    refreshControls();
}
