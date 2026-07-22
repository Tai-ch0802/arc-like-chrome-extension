// newswire SW 編排核心 (BASE-016 N1)。
// 單例持有各源連線(避開單連線數限制),事件管線:
//   adapter raw → normalizer → L1 dedupe → rules 分級/靜音 → ring buffer
//   → runtime message 廣播 sidepanel(P0 系統通知於 N4 接上)。
// 生命週期:background.js 於每次 SW 啟動呼叫 initNewswire();存活期間
// 20s keepalive(官方建議,涵蓋靜流時段),回收後由 newswireWatchdog
// alarm(30s)喚醒重建。storage 經 apiManager;alarms/runtime 為 SW 專屬。

import { getStorage, setStorage } from '../apiManager.js';
import { parseTree, parseFj, parseAlpaca, parseJin10 } from './normalizer.js';
import { createDedupeSet } from './dedupe.js';
import { classify, DEFAULT_RULES } from './rules.js';
import { createEventBuffer } from './eventBuffer.js';
import {
    createTreeAdapter,
    createFjAdapter,
    createAlpacaAdapter,
    createJin10Adapter,
    missingCreds,
} from './adapters.js';
import { canonicalizeNewswire } from './newswireSyncLogic.js';
import { buildP0Notification } from './notify.js';

export const NEWSWIRE_CONFIG_KEY = 'newswireConfig';
export const NEWSWIRE_KEYS_KEY = 'newswireKeys';
export const NEWSWIRE_LAST_SEEN_KEY = 'newswireLastSeenTs';
export const ALARM_NEWSWIRE_WATCHDOG = 'newswireWatchdog';

/**
 * Drive-agnostic bridge OUT (BASE-016 N3): the local working copy for the Drive
 * sync chain in background.js. Config missing → seed defaults; keys missing → {}.
 * @returns {Promise<{config:object, keys:object}>}
 */
export async function exportLocalNewswireState() {
    const res = await getStorage('local', { [NEWSWIRE_CONFIG_KEY]: null, [NEWSWIRE_KEYS_KEY]: {} });
    return {
        config: res[NEWSWIRE_CONFIG_KEY] || defaultNewswireConfig(),
        keys: res[NEWSWIRE_KEYS_KEY] || {},
    };
}

/**
 * Drive-agnostic bridge IN (BASE-016 N3): persist a merged result. Writes each of
 * config / keys ONLY when it actually differs (canonical compare) so an unchanged
 * sync fires no onChanged and the convergence loop settles. The config write
 * (when it happens) triggers handleNewswireConfigChange → adapters rebuild, which
 * is exactly right: a pulled-in setting change should re-evaluate connections.
 * @param {{config:object, localKeys:object}} merged
 */
export async function importMergedNewswireState(merged) {
    const res = await getStorage('local', { [NEWSWIRE_CONFIG_KEY]: null, [NEWSWIRE_KEYS_KEY]: {} });
    const patch = {};
    if (canonicalizeNewswire(res[NEWSWIRE_CONFIG_KEY]) !== canonicalizeNewswire(merged.config)) {
        patch[NEWSWIRE_CONFIG_KEY] = merged.config;
    }
    if (canonicalizeNewswire(res[NEWSWIRE_KEYS_KEY] || {}) !== canonicalizeNewswire(merged.localKeys || {})) {
        patch[NEWSWIRE_KEYS_KEY] = merged.localKeys || {};
    }
    if (Object.keys(patch).length) await setStorage('local', patch);
}

const KEEPALIVE_INTERVAL_MS = 20000; // Chrome 官方 WebSocket-in-SW 建議節奏
const WATCHDOG_PERIOD_MIN = 0.5;     // alarms 最短週期

/** 預設設定(首次啟動 flag-guarded 一次性 seed;來源全關=零網路行為)。 */
export function defaultNewswireConfig(now = Date.now()) {
    return {
        schemaVersion: 1,
        sources: {
            tree: { enabled: false, updatedAt: now },
            fj: { enabled: false, updatedAt: now },
            alpaca: { enabled: false, updatedAt: now },
            jin10: { enabled: false, mode: 'wss', categories: ['1'], updatedAt: now },
        },
        rules: {
            p0: [...DEFAULT_RULES.p0],
            p1: [...DEFAULT_RULES.p1],
            mute: [...DEFAULT_RULES.mute],
            updatedAt: now,
        },
        prefs: { notificationsEnabled: true, syncKeys: false, updatedAt: now },
    };
}

const ADAPTER_FACTORIES = {
    tree: (sourceCfg, keys, hooks) => createTreeAdapter({ apiKey: keys?.tree?.apiKey }, hooks),
    fj: (sourceCfg, keys, hooks) => createFjAdapter({ apiKey: keys?.fj?.apiKey }, hooks),
    alpaca: (sourceCfg, keys, hooks) => createAlpacaAdapter(
        { keyId: keys?.alpaca?.keyId, secret: keys?.alpaca?.secret }, hooks),
    jin10: (sourceCfg, keys, hooks) => createJin10Adapter({
        secretKey: keys?.jin10?.secretKey,
        categories: sourceCfg?.categories,
        // 官方 language=traditional:UI 語言為繁體時快訊轉繁體(M0/SA §5.4)。
        language: uiLangCache === 'zh_TW' ? 'traditional' : undefined,
    }, hooks),
};

let started = false;
let config = null;
let keysCache = {};
let uiLangCache = '';
const adapters = new Map();
const statuses = { tree: 'disabled', fj: 'disabled', alpaca: 'disabled', jin10: 'disabled' };
let dedupe = createDedupeSet();
const buffer = createEventBuffer();
let keepaliveTimer = null;

function broadcast(msg) {
    // 無任何開啟頁面時 sendMessage 會 reject(Receiving end does not exist)——吞掉。
    try { chrome.runtime.sendMessage(msg).catch(() => {}); } catch { /* no receiver */ }
}

function setStatus(source, status) {
    if (statuses[source] === status) return;
    statuses[source] = status;
    broadcast({ type: 'newswire:status', statuses: { ...statuses } });
}

function stopKeepalive() {
    if (keepaliveTimer) { clearInterval(keepaliveTimer); keepaliveTimer = null; }
}

function ensureKeepalive() {
    if (keepaliveTimer || !adapters.size) return;
    keepaliveTimer = setInterval(() => {
        if (!adapters.size) { stopKeepalive(); return; }
        // 廉價 extension API 呼叫重置 SW idle timer;WS 訊息本身也會重置,
        // 此 interval 涵蓋深夜靜流時段。SW 被回收時 interval 一併消失,
        // 由 watchdog alarm 負責喚醒重建(SA §5.3)。
        try { chrome.runtime.getPlatformInfo(() => {}); } catch { /* noop */ }
    }, KEEPALIVE_INTERVAL_MS);
}

function handleRaw(source, raw) {
    let parsed;
    switch (source) {
        case 'tree': parsed = parseTree(raw); break;
        case 'fj': parsed = parseFj(raw); break;
        case 'alpaca': parsed = parseAlpaca(raw); break;
        case 'jin10': parsed = parseJin10(raw); break;
        default: parsed = [];
    }
    if (!parsed.length) return;
    const rules = config?.rules || DEFAULT_RULES;
    const fresh = [];
    for (const ev of parsed) {
        if (dedupe.has(ev.id)) continue; // history replay/重連補收在此吸收
        dedupe.add(ev.id);
        const { importance, muted } = classify(ev, rules);
        if (muted) continue; // 靜音:不落地、不通知
        fresh.push({ ...ev, importance });
    }
    if (!fresh.length) return;
    buffer.append(fresh);
    broadcast({ type: 'newswire:events', events: fresh });
    // P0 → chrome.notifications(BASE-016 N4)。點擊開原文由
    // handleNewswireNotificationClick 從 ring buffer 反查 url(耐 SW 回收)。
    if (config?.prefs?.notificationsEnabled !== false) {
        for (const ev of fresh) { if (ev.importance === 0) notifyP0(ev); }
    }
}

/** 發送一則 P0 系統通知;notificationId 內嵌 event.id 供點擊反查原文。 */
function notifyP0(event) {
    if (typeof chrome === 'undefined' || !chrome.notifications) return;
    const { title, message } = buildP0Notification(event, Date.now());
    try {
        chrome.notifications.create(`newswire:${event.id}`, {
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/extension-icon-128.png'),
            title,
            message,
            priority: 2,
        });
    } catch { /* 權限未授予或平台不支援:靜默略過 */ }
}

async function loadState() {
    const res = await getStorage('local', { [NEWSWIRE_CONFIG_KEY]: null, [NEWSWIRE_KEYS_KEY]: {} });
    if (res[NEWSWIRE_CONFIG_KEY]) {
        config = res[NEWSWIRE_CONFIG_KEY];
    } else {
        config = defaultNewswireConfig();
        await setStorage('local', { [NEWSWIRE_CONFIG_KEY]: config });
    }
    keysCache = res[NEWSWIRE_KEYS_KEY] || {};
    const { uiLanguage } = await getStorage('sync', { uiLanguage: 'auto' });
    uiLangCache = (uiLanguage && uiLanguage !== 'auto')
        ? uiLanguage
        : (chrome.i18n?.getUILanguage?.() || '').replace('-', '_');
}

function applyAdapters() {
    for (const [source, factory] of Object.entries(ADAPTER_FACTORIES)) {
        const wantEnabled = !!config?.sources?.[source]?.enabled;
        const existing = adapters.get(source);
        if (wantEnabled && missingCreds(source, keysCache)) {
            // 啟用但憑證缺漏:不建連線,顯示 needs-key(填入 key 後 onChanged 重建)。
            if (existing) { existing.disconnect(); adapters.delete(source); }
            setStatus(source, 'needs-key');
            continue;
        }
        if (wantEnabled && !existing) {
            const adapter = factory(config.sources[source], keysCache, {
                onRaw: (raw) => handleRaw(source, raw),
                onStatus: (s) => setStatus(source, s),
            });
            adapters.set(source, adapter);
            adapter.connect();
        } else if (!wantEnabled && existing) {
            existing.disconnect();
            adapters.delete(source);
        } else if (!wantEnabled && statuses[source] !== 'disabled') {
            setStatus(source, 'disabled');
        }
    }
    if (adapters.size) {
        // 同名 create 具冪等性,只是重設排程。
        chrome.alarms.create(ALARM_NEWSWIRE_WATCHDOG, { periodInMinutes: WATCHDOG_PERIOD_MIN });
        ensureKeepalive();
    } else {
        chrome.alarms.clear(ALARM_NEWSWIRE_WATCHDOG);
        stopKeepalive();
    }
}

/** SW 每次啟動的進入點(background.js 頂層呼叫);冪等。 */
export async function initNewswire() {
    if (started) return;
    started = true;
    try {
        await loadState();
        const events = await buffer.init();
        dedupe = createDedupeSet(events.map((e) => e.id));
        applyAdapters();
    } catch (err) {
        started = false;
        console.warn('[newswire] init failed:', err?.message || err);
    }
}

/**
 * chrome.notifications.onClicked 分派(BASE-016 N4)。從 ring buffer 反查事件
 * url(buffer 由 storage.local 於 SW 啟動重建 → 耐 SW 回收),開原文分頁並清除
 * 通知。非 newswire: 前綴的通知不處理(留給其他 context)。
 * @returns {boolean} true = 已認領此通知
 */
export function handleNewswireNotificationClick(notificationId) {
    if (typeof notificationId !== 'string' || !notificationId.startsWith('newswire:')) return false;
    const id = notificationId.slice('newswire:'.length);
    (async () => {
        if (!started) await initNewswire();
        try { chrome.notifications.clear(notificationId); } catch { /* noop */ }
        const ev = buffer.getEvents().find((e) => e.id === id);
        if (!ev?.url) return;
        try {
            const u = new URL(ev.url); // 開分頁前再驗一次 scheme(不可信內容)
            if (u.protocol === 'http:' || u.protocol === 'https:') chrome.tabs.create({ url: u.href });
        } catch { /* invalid url */ }
    })().catch((e) => console.warn('[newswire] notif click failed:', e?.message || e));
    return true;
}

/** newswireWatchdog alarm:確保 SW 存活時連線在線、被回收後重建。 */
export function handleNewswireWatchdog() {
    if (!started) { initNewswire(); return; }
    for (const adapter of adapters.values()) {
        if (!adapter.isAlive()) adapter.connect();
    }
    ensureKeepalive();
}

/**
 * local newswireConfig/newswireKeys 變更 → 重讀並重建連線(粗粒度,設定
 * 變更頻率低);sync uiLanguage 變更也重建(金十 traditional 參數跟著換)。
 */
export function handleNewswireConfigChange(changes, areaName) {
    const uiLangChanged = areaName === 'sync' && !!changes.uiLanguage;
    if (areaName !== 'local' && !uiLangChanged) return;
    if (!uiLangChanged && !changes[NEWSWIRE_CONFIG_KEY] && !changes[NEWSWIRE_KEYS_KEY]) return;
    (async () => {
        await loadState();
        for (const adapter of adapters.values()) adapter.disconnect();
        adapters.clear();
        applyAdapters();
    })().catch((err) => console.warn('[newswire] config reload failed:', err?.message || err));
}

/**
 * `newswire:*` 訊息分派(background onMessage 委派)。
 * @returns {boolean} true = 非同步回應(呼叫端需 return true)
 */
export function handleNewswireMessage(message, sendResponse) {
    if (message.action === 'newswire:getState') {
        (async () => {
            if (!started) await initNewswire();
            const res = await getStorage('local', { [NEWSWIRE_LAST_SEEN_KEY]: 0 });
            sendResponse({
                events: buffer.getEvents(),
                statuses: { ...statuses },
                lastSeenTs: res[NEWSWIRE_LAST_SEEN_KEY] || 0,
                enabledAny: Object.values(config?.sources || {}).some((s) => s && s.enabled),
            });
        })().catch((err) => sendResponse({
            events: [], statuses: { ...statuses }, lastSeenTs: 0, enabledAny: false,
            error: err?.message || String(err),
        }));
        return true;
    }
    if (message.action === 'newswire:markSeen') {
        setStorage('local', { [NEWSWIRE_LAST_SEEN_KEY]: Number(message.ts) || Date.now() })
            .then(() => sendResponse({ ok: true }))
            .catch((err) => sendResponse({ ok: false, error: err?.message || String(err) }));
        return true;
    }
    return false;
}
