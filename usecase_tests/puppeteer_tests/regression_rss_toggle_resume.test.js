const { setupBrowser, teardownBrowser } = require('./setup');

/**
 * Regression: RSS subscription "resume" was impossible after pausing.
 *
 * Root cause: the toggle-button click handler read `e.target.dataset.action`,
 * but the button's innerHTML is an inline SVG icon, so a real click lands on
 * the <path> child (dataset.action === undefined). `undefined === 'resume'` is
 * false, so every toggle coerced to { enabled: false } — pause worked by
 * coincidence, resume could never set enabled back to true.
 *
 * This seeds one PAUSED subscription (enabled=0) directly into storage.local
 * (pipe-delimited: id|url|title|interval|enabled|lastFetched|updatedAt),
 * opens the RSS section, clicks the resume button (the click lands on the SVG
 * path, reproducing the bug), and asserts the subscription flips to enabled=1.
 */
describe('RSS toggle resume regression', () => {
    let browser;
    let page;
    let extensionId;

    const SUB_ID = 'rss_regtoggle';
    const SEEDED = `${SUB_ID}|https://example.com/regfeed|RegToggle Feed|24h|0|0|0`;

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        page = setup.page;
        extensionId = setup.extensionId;

        const optionsUrl = `chrome-extension://${extensionId}/options.html`;
        await page.goto(optionsUrl, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.opt-nav__item', { timeout: 15000 });

        // Seed a paused subscription, then reload so renderRss()/initRssManager()
        // reads it fresh from storage on the next page build.
        await page.evaluate((rec) => new Promise(resolve => {
            chrome.storage.local.set({ rssSubscriptions: [rec] }, resolve);
        }), SEEDED);
        await page.goto(optionsUrl, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.opt-nav__item', { timeout: 15000 });
    }, 120000);

    afterAll(async () => {
        if (page) {
            await page.evaluate(() => new Promise(resolve => {
                chrome.storage.local.remove(['rssSubscriptions'], resolve);
            }));
        }
        await teardownBrowser(browser);
    });

    test('clicking resume (on the SVG icon) re-enables a paused subscription', async () => {
        await page.click('.opt-nav__item[data-section="rss"]');

        const toggleSel = '#rss-subscriptions-list .rss-toggle-btn';
        await page.waitForSelector(toggleSel, { timeout: 10000 });

        // Paused subscription renders a resume affordance.
        const action = await page.$eval(toggleSel, el => el.dataset.action);
        expect(action).toBe('resume');

        // Center-of-button click lands on the play_arrow <path>, reproducing the
        // original e.target-vs-button bug.
        await page.click(toggleSel);

        // The subscription must now be enabled (field index 4 === '1').
        await page.waitForFunction(() => new Promise(resolve => {
            chrome.storage.local.get(['rssSubscriptions'], (res) => {
                const rec = (res.rssSubscriptions || [])[0] || '';
                resolve(rec.split('|')[4] === '1');
            });
        }), { timeout: 10000 });

        // And the button flips back to a pause affordance.
        await page.waitForFunction(
            (sel) => document.querySelector(sel)?.dataset.action === 'pause',
            { timeout: 10000 },
            toggleSel
        );
    }, 60000);
});
