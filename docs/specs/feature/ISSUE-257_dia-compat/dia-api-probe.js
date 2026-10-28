#!/usr/bin/env node
/**
 * Dia / Chromium-fork `chrome.*` API probe (research artifact for ISSUE-257).
 *
 * Connects over the Chrome DevTools Protocol to a browser started with
 * `--remote-debugging-port` and `--load-extension=<this repo>`, opens this
 * extension's options page as a tab, and evaluates a list of feature checks
 * in that extension context (plus a few in the service worker). Every step has
 * a Node-side hard timeout so a hanging API call is reported, not fatal.
 *
 * Needs Node >= 22 (global WebSocket); no npm dependencies.
 *
 *   open -n -a ~/Applications/Dia.app --args --user-data-dir=/tmp/dia-probe \
 *     --remote-debugging-port=9333 --load-extension="$PWD" --no-first-run
 *   node docs/specs/feature/ISSUE-257_dia-compat/dia-api-probe.js http://127.0.0.1:9333 "$PWD"
 *
 * Results observed on Dia 1.54.2 are summarised in SPIKE.md.
 */
const http = require('http');
const crypto = require('crypto');

const [, , base = 'http://127.0.0.1:9333', extDir = process.cwd()] = process.argv;

/** Unpacked-extension id = first 32 hex chars of sha256(path), mapped 0-f -> a-p. */
const unpackedId = (dir) => crypto.createHash('sha256').update(dir, 'utf8').digest('hex').slice(0, 32)
    .split('').map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');
const getJson = (url) => new Promise((resolve, reject) => {
    http.get(url, (res) => {
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
    }).on('error', reject);
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const withTimeout = (p, ms, label) => Promise.race([
    p, new Promise((_, rej) => setTimeout(() => rej(new Error(`node-timeout(${label}) ${ms}ms`)), ms)),
]);
const log = (k, v) => console.log(`### ${k}\n${JSON.stringify(v, null, 2)}`);

class CDP {
    constructor(wsUrl) { this.ws = new WebSocket(wsUrl); this.id = 0; this.pending = new Map(); }
    open() {
        return new Promise((resolve, reject) => {
            this.ws.onopen = () => resolve();
            this.ws.onerror = () => reject(new Error('ws error'));
            this.ws.onmessage = (m) => {
                const msg = JSON.parse(m.data);
                if (msg.id && this.pending.has(msg.id)) { this.pending.get(msg.id)(msg); this.pending.delete(msg.id); }
            };
        });
    }
    send(method, params = {}, sessionId, ms = 20000) {
        const id = ++this.id;
        return withTimeout(new Promise((resolve) => {
            this.pending.set(id, resolve);
            this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
        }), ms, method);
    }
    close() { this.ws.close(); }
}

/** Wrap an expression so rejections surface as 'ERR: ...' strings instead of hanging. */
const E = (src) => `(async () => { try { return await (${src}); } catch (e) { return 'ERR: ' + (e && e.message); } })()`;

const PAGE_STEPS = {
    env: E(`({ ua: navigator.userAgent, brands: navigator.userAgentData && navigator.userAgentData.brands, extensionId: chrome.runtime.id, name: chrome.runtime.getManifest().name })`),
    apiTypes: E(`(() => { const t = (fn) => { try { return typeof fn(); } catch (e) { return 'ERR:' + e.message; } }; return {
        sidePanel: t(() => chrome.sidePanel), 'sidePanel.open': t(() => chrome.sidePanel.open),
        readingList: t(() => chrome.readingList), tabGroups: t(() => chrome.tabGroups), 'tabs.group': t(() => chrome.tabs.group),
        'identity.getAuthToken': t(() => chrome.identity.getAuthToken), 'identity.launchWebAuthFlow': t(() => chrome.identity.launchWebAuthFlow),
        'storage.sync': t(() => chrome.storage.sync), 'storage.session': t(() => chrome.storage.session),
        alarms: t(() => chrome.alarms), offscreen: t(() => chrome.offscreen), notifications: t(() => chrome.notifications),
        commands: t(() => chrome.commands), scripting: t(() => chrome.scripting), bookmarks: t(() => chrome.bookmarks),
        LanguageModel: typeof globalThis.LanguageModel, Summarizer: typeof globalThis.Summarizer }; })()`),
    redirectURL: E(`chrome.identity.getRedirectURL()`),
    sidePanelOptions: E(`chrome.sidePanel.getOptions({})`),
    sidePanelBehavior: E(`chrome.sidePanel.getPanelBehavior()`),
    commands: E(`chrome.commands.getAll()`),
    readingListRoundTrip: E(`(async () => {
        await chrome.readingList.addEntry({ url: 'https://example.com/api-probe', title: 'probe', hasBeenRead: false });
        const q = await chrome.readingList.query({ url: 'https://example.com/api-probe' });
        await chrome.readingList.removeEntry({ url: 'https://example.com/api-probe' });
        return { added: q.length, entry: q[0] }; })()`),
    tabGroupsQuery: E(`chrome.tabGroups.query({})`),
    tabGroupSameWindow: E(`(async () => {
        const w = await chrome.windows.getCurrent();
        const t1 = await chrome.tabs.create({ url: 'about:blank', active: false, windowId: w.id });
        const t2 = await chrome.tabs.create({ url: 'about:blank', active: false, windowId: w.id });
        const out = {};
        try { const gid = await chrome.tabs.group({ tabIds: [t1.id, t2.id], createProperties: { windowId: w.id } });
              await chrome.tabGroups.update(gid, { title: 'probe', color: 'green' }); out.group = await chrome.tabGroups.get(gid); }
        catch (e) { out.err = e.message; }
        await chrome.tabs.remove([t1.id, t2.id]).catch(() => {});
        return out; })()`),
    tabGroupNewWindow: E(`(async () => {
        const nw = await chrome.windows.create({ url: ['about:blank', 'about:blank'], focused: false });
        await new Promise((r) => setTimeout(r, 1500));
        const tabs = await chrome.tabs.query({ windowId: nw.id });
        const out = { tabCount: tabs.length };
        try { out.gid = await chrome.tabs.group({ tabIds: tabs.map((t) => t.id) }); } catch (e) { out.err = e.message; }
        try { out.pinned = (await chrome.tabs.update(tabs[0].id, { pinned: true })).pinned; } catch (e) { out.pinErr = e.message; }
        try { await chrome.tabs.move(tabs[1].id, { index: 0 }); out.moved = true; } catch (e) { out.moveErr = e.message; }
        await chrome.windows.remove(nw.id).catch(() => {});
        return out; })()`),
    scriptingOnPage: E(`(async () => {
        const t = await chrome.tabs.create({ url: 'https://example.com/', active: false });
        await new Promise((r) => setTimeout(r, 4000));
        const out = {};
        try { const res = await chrome.scripting.executeScript({ target: { tabId: t.id }, func: () => document.title }); out.title = res && res[0] && res[0].result; }
        catch (e) { out.err = e.message; }
        await chrome.tabs.remove(t.id).catch(() => {});
        return out; })()`),
    storageSync: E(`(async () => {
        await chrome.storage.sync.set({ __api_probe: Date.now() });
        const got = await chrome.storage.sync.get('__api_probe');
        await chrome.storage.sync.remove('__api_probe');
        return { roundTrip: Boolean(got.__api_probe), quota: chrome.storage.sync.QUOTA_BYTES }; })()`),
    getProfileUserInfo: E(`chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' })`),
    getAuthTokenNonInteractive: E(`chrome.identity.getAuthToken({ interactive: false })`),
    aiAvailability: E(`(async () => ({
        languageModel: typeof LanguageModel !== 'undefined' ? await LanguageModel.availability() : 'undefined',
        summarizer: typeof Summarizer !== 'undefined' ? await Summarizer.availability() : 'undefined' }))()`),
};
const SW_STEPS = {
    offscreenRoundTrip: E(`(async () => {
        await chrome.offscreen.createDocument({ url: 'offscreen.html', reasons: ['DOM_PARSER'], justification: 'probe' });
        const has = await chrome.offscreen.hasDocument();
        await chrome.offscreen.closeDocument();
        return { created: has }; })()`),
    alarms: E(`chrome.alarms.getAll().then((as) => as.map((a) => a.name))`),
};

async function runSteps(cdp, sessionId, steps) {
    for (const [name, expression] of Object.entries(steps)) {
        try {
            const ev = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, timeout: 18000 }, sessionId, 22000);
            const exc = ev.result && ev.result.exceptionDetails;
            log(name, exc ? `EXC: ${(exc.exception || {}).description || exc.text}` : (ev.result && ev.result.result ? ev.result.result.value : ev));
        } catch (e) {
            log(name, `HANG: ${e.message}`);
        }
    }
}

(async () => {
    const version = await getJson(`${base}/json/version`);
    const extId = unpackedId(extDir);
    log('browser', { browser: version.Browser, extId });

    const cdp = new CDP(version.webSocketDebuggerUrl);
    await cdp.open();
    const { targetId } = (await cdp.send('Target.createTarget', { url: 'about:blank' })).result;
    const { sessionId } = (await cdp.send('Target.attachToTarget', { targetId, flatten: true })).result;
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Page.navigate', { url: `chrome-extension://${extId}/options.html` }, sessionId);
    await sleep(4000);
    await runSteps(cdp, sessionId, PAGE_STEPS);

    // Open the real side panel with a synthetic user gesture; a second sidepanel.html target proves it rendered.
    try {
        const ev = await cdp.send('Runtime.evaluate', {
            expression: E(`(async () => { const w = await chrome.windows.getCurrent(); await chrome.sidePanel.open({ windowId: w.id }); return 'opened:' + w.id; })()`),
            awaitPromise: true, returnByValue: true, userGesture: true, timeout: 10000,
        }, sessionId, 14000);
        log('sidePanelOpen', ev.result && ev.result.result ? ev.result.result.value : ev);
    } catch (e) { log('sidePanelOpen', `HANG: ${e.message}`); }
    await sleep(4000);
    const targets = (await cdp.send('Target.getTargets')).result.targetInfos;
    log('sidePanelTargets', targets.filter((t) => t.url.includes('/sidepanel.html')).length);

    const sw = targets.find((t) => t.type === 'service_worker' && t.url.startsWith(`chrome-extension://${extId}/`));
    if (sw) {
        const { sessionId: swSession } = (await cdp.send('Target.attachToTarget', { targetId: sw.targetId, flatten: true })).result;
        await runSteps(cdp, swSession, SW_STEPS);
        await cdp.send('Target.detachFromTarget', { sessionId: swSession }).catch(() => {});
    } else {
        log('serviceWorker', 'not running (idle-terminated); re-run to probe SW-only APIs');
    }

    // OAuth MECHANISM checks (no credentials needed): redirect capture, fast-fail
    // of prompt=none, and whether an interactive popup opens at all. With an
    // unpacked id Google answers redirect_uri_mismatch — that still proves the
    // popup mechanism; the sign-in itself must be done by a human with the
    // store-registered id.
    const clientId = (() => { try { return require(`${extDir}/manifest.json`).oauth2.client_id; } catch { return ''; } })();
    const authUrl = (prompt) => `'https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}'
        + '&redirect_uri=' + encodeURIComponent(chrome.identity.getRedirectURL())
        + '&response_type=token&scope=' + encodeURIComponent('https://www.googleapis.com/auth/drive.appdata')${prompt ? ` + '&prompt=${prompt}'` : ''}`;
    await runSteps(cdp, sessionId, {
        oauthRedirectCapture: E(`chrome.identity.launchWebAuthFlow({ url: chrome.identity.getRedirectURL() + '#access_token=probe', interactive: false })`),
        oauthPromptNoneFastFail: E(`chrome.identity.launchWebAuthFlow({ url: ${authUrl('none')}, interactive: false })`),
    });
    const beforePopup = (await cdp.send('Target.getTargets')).result.targetInfos.map((t) => t.targetId);
    const popupPromise = cdp.send('Runtime.evaluate', { expression: E(`chrome.identity.launchWebAuthFlow({ url: ${authUrl('')}, interactive: true })`), awaitPromise: true, returnByValue: true }, sessionId, 60000)
        .then((ev) => (ev.result && ev.result.result ? ev.result.result.value : ev)).catch((e) => `HANG: ${e.message}`);
    await sleep(8000);
    const popups = (await cdp.send('Target.getTargets')).result.targetInfos.filter((t) => !beforePopup.includes(t.targetId) && t.type === 'page');
    log('oauthInteractivePopup', popups.map((t) => t.url.slice(0, 100)));
    for (const t of popups) await cdp.send('Target.closeTarget', { targetId: t.targetId }).catch(() => {});
    log('oauthInteractiveResolved', await popupPromise);

    await cdp.send('Target.closeTarget', { targetId }).catch(() => {});
    cdp.close();
    log('done', true);
    process.exit(0);
})().catch((e) => { console.error('PROBE FAILED:', e); process.exit(1); });
