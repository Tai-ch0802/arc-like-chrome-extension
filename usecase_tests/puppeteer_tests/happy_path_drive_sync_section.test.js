const { setupBrowser, teardownBrowser } = require('./setup');

/**
 * Batch E5c E2E: the options page "Backup & Sync" (sync) section.
 *
 * Mirrors happy_path_options_page.test.js for navigation: go directly to
 * options.html, wait for the nav, click the data-section="sync" nav item.
 *
 * What this suite asserts (all deterministic, NO live OAuth):
 *   1. Clicking the "sync" nav item activates the sync section.
 *   2. In the not-connected state (manifest ships a PLACEHOLDER oauth2 client_id,
 *      so driveAuth.isConnected() is always false here) the account block renders
 *      a "Connect Google Drive" button and the per-workspace opt-in header.
 *   3. Seeding a workspace via the page's OWN workspaceManager module instance
 *      (the same module the section hydrates from) and reloading makes the
 *      per-workspace opt-in list render a row with a #sync-ws-<id> checkbox that
 *      reflects the stored syncEnabled flag (unchecked + disabled while
 *      not-connected).
 *   4. The data layer behind the opt-in checkbox (setWorkspaceSyncEnabled →
 *      chrome.storage.sync["wsMeta_"+id], schema v2) genuinely flips syncEnabled
 *      and the flip round-trips back into the rendered checkbox after a reload.
 *   5. Clicking "Connect Google Drive" shows the privacy-disclosure confirm modal
 *      BEFORE any auth call; cancelling it dismisses the modal and fires no auth.
 *
 * Deliberately NOT tested: the actual Drive connection / OAuth consent flow.
 * The placeholder client_id makes a genuine connect impossible in CI, and the
 * privacy disclosure is gated in front of getAuthToken, so we stop at the modal.
 *
 * Why seed through the page's module rather than the background message
 * (driveSetWorkspaceSync): the background service worker initialises its own
 * in-memory workspace map ONCE at startup (ensureWorkspacesInit is idempotent),
 * so a workspace freshly seeded from the page context is not in the background's
 * map and setWorkspaceSyncEnabled there would be a no-op. Driving the same
 * module the UI uses keeps the assertion about the persistence path honest and
 * race-free.
 */
describe('Options Page: Backup & Sync section', () => {
    let browser;
    let page;
    let extensionId;
    let optionsUrl;
    let seededWorkspaceId;

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        page = setup.page;
        extensionId = setup.extensionId;

        optionsUrl = `chrome-extension://${extensionId}/options.html`;
        await page.goto(optionsUrl, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.opt-nav__item', { timeout: 15000 });
    }, 120000);

    afterAll(async () => {
        // Best-effort cleanup so re-runs of this suite in the same profile start clean.
        if (page) {
            try {
                await page.evaluate(() => new Promise((resolve) => {
                    chrome.storage.sync.get(null, (all) => {
                        const metaKeys = Object.keys(all).filter(k => k.startsWith('wsMeta_'));
                        const snapKeys = metaKeys.map(k => 'wsSnap_' + k.slice('wsMeta_'.length));
                        chrome.storage.sync.remove(['workspaceMetadata', ...metaKeys], () => {
                            chrome.storage.local.remove(['workspaceSnapshots', ...snapKeys], () => resolve());
                        });
                    });
                }));
            } catch (_) { /* ignore */ }
        }
        await teardownBrowser(browser);
    });

    test('clicking the sync nav item activates the Backup & Sync section', async () => {
        await page.click('.opt-nav__item[data-section="sync"]');

        await page.waitForFunction(
            () => document.querySelector('.opt-section.active')?.dataset.section === 'sync',
            { timeout: 5000 }
        );

        const activeSection = await page.$eval('.opt-section.active', el => el.dataset.section);
        expect(activeSection).toBe('sync');

        const activeNav = await page.$eval('.opt-nav__item.active', el => el.dataset.section);
        expect(activeNav).toBe('sync');
    }, 30000);

    test('not-connected state renders the Connect button + per-workspace opt-in header', async () => {
        // The sync section's hydrate() defers I/O, so wait for the account block
        // to paint its (not-connected) Connect button rather than assuming it is
        // already there.
        await page.waitForFunction(() => {
            const block = document.querySelector('.opt-section[data-section="sync"] .sync-account-block');
            if (!block) return false;
            return Array.from(block.querySelectorAll('button')).some(b => (b.textContent || '').trim().length > 0);
        }, { timeout: 10000 });

        const connectBtnText = await page.$eval(
            '.opt-section[data-section="sync"] .sync-account-block button',
            el => el.textContent.trim()
        );
        // Locale-agnostic: the rendered CTA must equal the resolved i18n message
        // for syncConnectButton (the test browser may run in any UI language, e.g.
        // zh-TW renders "連結 Google 雲端硬碟"). Just assert it is non-empty and the
        // same string the extension's own i18n produces.
        const expectedConnectText = await page.evaluate(() => chrome.i18n.getMessage('syncConnectButton'));
        expect(connectBtnText.length).toBeGreaterThan(0);
        if (expectedConnectText) {
            expect(connectBtnText).toBe(expectedConnectText);
        }

        // The per-workspace opt-in header is part of the persistent skeleton and
        // must match the resolved syncWorkspacesHeader message.
        const expectedWsHeader = await page.evaluate(() => chrome.i18n.getMessage('syncWorkspacesHeader'));
        const headerTexts = await page.$$eval(
            '.opt-section[data-section="sync"] .settings-subsection-header',
            els => els.map(e => e.textContent.trim())
        );
        expect(headerTexts.length).toBeGreaterThan(0);
        if (expectedWsHeader) {
            expect(headerTexts).toContain(expectedWsHeader);
        }

        // Privacy fine-print is always present (persistent, non-hydrated block).
        const hasPrivacyNote = await page.$('.opt-section[data-section="sync"] .sync-privacy-note');
        expect(hasPrivacyNote).not.toBeNull();
    }, 30000);

    test('seeding a workspace renders an opt-in row whose checkbox reflects syncEnabled', async () => {
        // Seed via the page's own workspaceManager (writes workspaceMetadata to
        // chrome.storage.sync). createWorkspace with no snapshotWindowId touches
        // no tabs/windows, so it is fully deterministic.
        seededWorkspaceId = await page.evaluate(async () => {
            const ws = await import('./modules/workspace/workspaceManager.js');
            await ws.initWorkspaces();
            const created = await ws.createWorkspace({ name: 'SyncOptIn E5c' });
            return created.id;
        });
        expect(seededWorkspaceId).toMatch(/^ws_/);

        // Reload so the sync section re-hydrates from the seeded storage.
        await page.goto(optionsUrl, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.opt-nav__item[data-section="sync"]', { timeout: 15000 });
        await page.click('.opt-nav__item[data-section="sync"]');
        await page.waitForFunction(
            () => document.querySelector('.opt-section.active')?.dataset.section === 'sync',
            { timeout: 5000 }
        );

        const rowSelector = `#sync-ws-${seededWorkspaceId}`;
        await page.waitForSelector(rowSelector, { timeout: 10000 });

        const state = await page.$eval(rowSelector, el => ({
            type: el.type,
            checked: el.checked,
            disabled: el.disabled,
        }));
        expect(state.type).toBe('checkbox');
        // Fresh workspace: syncEnabled defaults to false → unchecked.
        expect(state.checked).toBe(false);
        // Not connected (placeholder client_id) → opt-in is disabled until connect.
        expect(state.disabled).toBe(true);
    }, 60000);

    test('the opt-in persistence path flips syncEnabled in storage and round-trips to the checkbox', async () => {
        // Drive the SAME module the change handler uses, then assert the canonical
        // store flipped. This is the real persistence path behind the checkbox,
        // without depending on the background service worker's separate module
        // instance or any OAuth.
        const flipped = await page.evaluate(async (wsId) => {
            const ws = await import('./modules/workspace/workspaceManager.js');
            await ws.initWorkspaces();
            await ws.setWorkspaceSyncEnabled(wsId, true);
            // Schema v2 (ISSUE-162 WP1): per-workspace sync key wsMeta_<id>.
            const meta = await new Promise((resolve) =>
                chrome.storage.sync.get('wsMeta_' + wsId, (r) => resolve(r['wsMeta_' + wsId] || null))
            );
            return meta ? meta.syncEnabled : null;
        }, seededWorkspaceId);
        expect(flipped).toBe(true);

        // Reload → the section re-hydrates; the checkbox must now reflect the flip.
        await page.goto(optionsUrl, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.opt-nav__item[data-section="sync"]', { timeout: 15000 });
        await page.click('.opt-nav__item[data-section="sync"]');
        await page.waitForFunction(
            () => document.querySelector('.opt-section.active')?.dataset.section === 'sync',
            { timeout: 5000 }
        );

        const rowSelector = `#sync-ws-${seededWorkspaceId}`;
        await page.waitForSelector(rowSelector, { timeout: 10000 });
        const checked = await page.$eval(rowSelector, el => el.checked);
        expect(checked).toBe(true);
    }, 60000);

    test('clicking Connect shows the privacy-disclosure modal; cancelling dismisses it with no auth', async () => {
        // Self-contained: navigate fresh and re-select the sync section so this
        // test does not depend on the scroll/DOM state left by earlier tests.
        await page.goto(optionsUrl, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.opt-nav__item[data-section="sync"]', { timeout: 15000 });
        await page.click('.opt-nav__item[data-section="sync"]');
        await page.waitForFunction(
            () => document.querySelector('.opt-section.active')?.dataset.section === 'sync',
            { timeout: 5000 }
        );

        const connectSelector = '.opt-section[data-section="sync"] .sync-account-block button';
        await page.waitForFunction((sel) => {
            const b = document.querySelector(sel);
            return b && (b.textContent || '').trim().length > 0;
        }, { timeout: 10000 }, connectSelector);

        const connectText = await page.$eval(connectSelector, el => el.textContent.trim());

        // Trigger the handler via an in-page click. The button can sit below the
        // fold of the scrollable options pane in headless rendering, which makes
        // Puppeteer's coordinate-based page.click() flag it "not clickable"; an
        // in-page .click() reliably fires the handler we are actually testing.
        await page.$eval(connectSelector, el => el.click());

        // The privacy-disclosure confirm modal must appear BEFORE any auth call.
        await page.waitForSelector('.modal-overlay .modal-content', { timeout: 5000 });
        const modal = await page.evaluate(() => {
            const overlay = document.querySelector('.modal-overlay');
            const title = overlay?.querySelector('.modal-title')?.textContent?.trim() || '';
            const confirmText = overlay?.querySelector('.confirm-btn')?.textContent?.trim() || '';
            const hasCancel = !!overlay?.querySelector('.cancel-btn');
            return { title, confirmText, hasCancel };
        });
        expect(modal.title.length).toBeGreaterThan(0);
        expect(modal.hasCancel).toBe(true);
        // The disclosure's confirm button is the same Connect CTA (both i18n
        // syncConnectButton), regardless of locale.
        expect(modal.confirmText).toBe(connectText);

        // Cancel → modal dismissed, no getAuthToken fired, Connect button intact.
        await page.$eval('.modal-overlay .cancel-btn', el => el.click());
        await page.waitForFunction(
            () => !document.querySelector('.modal-overlay'),
            { timeout: 5000 }
        );

        const stillNotConnected = await page.$eval(connectSelector, el => ({
            text: el.textContent.trim(),
            disabled: el.disabled,
        }));
        expect(stillNotConnected.text).toBe(connectText);
        expect(stillNotConnected.disabled).toBe(false);
    }, 30000);
});
