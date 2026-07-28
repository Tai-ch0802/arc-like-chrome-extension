// BASE-025 — sidebar search extended to the Archive and Newswire sections.
// Covers: filtering + <mark> highlighting, URL/domain matching, tag: bulk
// hide (the BASE-024 omission), search-reveal over collapsed lists, and the
// integration hazard — rows rendered DURING an active search must be filtered.
const { setupBrowser, teardownBrowser } = require('./setup');

describe('Search across archive + newswire', () => {
    let browser;
    let page;
    let extensionId;

    const seedArchive = () => ({
        archivedTabs: {
            schemaVersion: 1,
            items: [
                { id: 'sa1', url: 'https://alpha-site.com/doc', title: 'Alpha guide', favIconUrl: '', archivedAt: Date.now() - 3600_000, source: 'auto' },
                { id: 'sa2', url: 'https://beta-site.com/page', title: 'Beta notes', favIconUrl: '', archivedAt: Date.now() - 3600_000, source: 'auto' },
            ],
        },
    });

    async function typeSearch(text) {
        await page.evaluate(() => { document.getElementById('search-box').value = ''; });
        await page.type('#search-box', text);
        // Search debounce is 300ms; wait for the filter to take effect.
        await new Promise(r => setTimeout(r, 600));
    }

    async function clearSearch() {
        await page.evaluate(() => {
            const box = document.getElementById('search-box');
            box.value = '';
            box.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await new Promise(r => setTimeout(r, 600));
    }

    async function broadcastNewswire(events) {
        const sender = await browser.newPage();
        await sender.goto(`chrome-extension://${extensionId}/options.html`, { waitUntil: 'domcontentloaded' });
        await sender.evaluate((evs) => chrome.runtime.sendMessage({ type: 'newswire:events', events: evs }).catch(() => {}), events);
        await sender.close();
        await page.bringToFront();
    }

    const nwEvent = (id, title, over = {}) => ({
        id, title, source: 'fj', importance: 2,
        tsIngest: Date.now(), ts: Date.now(),
        url: `https://newswire-src.com/${id}`, ...over,
    });

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        page = setup.page;
        extensionId = setup.extensionId;
        await page.waitForSelector('#tab-list', { timeout: 15000 });
        await page.evaluate((seed) => chrome.storage.local.set(seed), seedArchive());
        await page.waitForFunction(() => document.querySelectorAll('.archive-item').length === 2, { timeout: 5000 });
        await broadcastNewswire([nwEvent('n1', 'Alpha market news'), nwEvent('n2', 'Gamma report')]);
        await page.waitForFunction(() => document.querySelectorAll('.newswire-item').length >= 2, { timeout: 5000 });
    }, 120000);

    afterAll(async () => {
        await teardownBrowser(browser);
    });

    test('keyword filters both sections and highlights matches (title path)', async () => {
        await typeSearch('Alpha');

        const state = await page.evaluate(() => ({
            archiveVisible: [...document.querySelectorAll('.archive-item:not(.hidden)')].map(el => el.dataset.itemId),
            archiveHidden: [...document.querySelectorAll('.archive-item.hidden')].map(el => el.dataset.itemId),
            archiveMark: document.querySelector('.archive-item:not(.hidden) .archive-item-title mark.title-match')?.textContent,
            nwVisible: [...document.querySelectorAll('.newswire-item:not(.hidden)')].map(el => el.dataset.eventId),
            nwHidden: [...document.querySelectorAll('.newswire-item.hidden')].map(el => el.dataset.eventId),
            nwMark: document.querySelector('.newswire-item:not(.hidden) .newswire-item__title mark.title-match')?.textContent,
        }));
        expect(state.archiveVisible).toEqual(['sa1']);
        expect(state.archiveHidden).toEqual(['sa2']);
        expect(state.archiveMark).toBe('Alpha');
        expect(state.nwVisible).toEqual(['n1']);
        expect(state.nwHidden).toContain('n2');
        expect(state.nwMark).toBe('Alpha');
    }, 60000);

    test('domain matching works for both sections; archive shows the matched-domain line', async () => {
        await typeSearch('beta-site');
        const archive = await page.evaluate(() => ({
            visible: [...document.querySelectorAll('.archive-item:not(.hidden)')].map(el => el.dataset.itemId),
            domainLine: document.querySelector('.archive-item:not(.hidden) .matched-domain mark.url-match')?.textContent,
        }));
        expect(archive.visible).toEqual(['sa2']);
        expect(archive.domainLine).toBe('beta-site');

        await typeSearch('newswire-src');
        const nwVisible = await page.evaluate(() =>
            [...document.querySelectorAll('.newswire-item:not(.hidden)')].map(el => el.dataset.eventId));
        expect(nwVisible.sort()).toEqual(['n1', 'n2']); // both share the domain
    }, 60000);

    test('rows rendered DURING an active search get filtered (integration hazard)', async () => {
        await typeSearch('Alpha');
        // A live newswire batch arrives mid-search: one match, one miss.
        await broadcastNewswire([nwEvent('n3', 'Alpha follow-up'), nwEvent('n4', 'Delta digest')]);

        // The re-filter listener is debounced (250ms) after the prepend.
        await page.waitForFunction(() => {
            const n3 = document.querySelector('.newswire-item[data-event-id="n3"]');
            const n4 = document.querySelector('.newswire-item[data-event-id="n4"]');
            return n3 && n4
                && !n3.classList.contains('hidden')
                && n4.classList.contains('hidden');
        }, { timeout: 8000 });

        // The fresh matching row is highlighted too.
        const mark = await page.$eval('.newswire-item[data-event-id="n3"] .newswire-item__title mark.title-match',
            el => el.textContent);
        expect(mark).toBe('Alpha');
    }, 60000);

    test('search-reveal shows a collapsed section with hits; clearing restores collapse + highlights', async () => {
        // Collapse the archive section via its real toggle.
        await clearSearch();
        await page.click('#archive-toggle');
        await page.waitForFunction(() =>
            document.getElementById('archive-list').classList.contains('collapsed'), { timeout: 5000 });

        await typeSearch('Alpha');
        const revealed = await page.evaluate(() => {
            const list = document.getElementById('archive-list');
            return {
                hasReveal: list.classList.contains('search-reveal'),
                displayed: window.getComputedStyle(list).display !== 'none',
            };
        });
        expect(revealed.hasReveal).toBe(true);
        expect(revealed.displayed).toBe(true);

        await clearSearch();
        const after = await page.evaluate(() => {
            const list = document.getElementById('archive-list');
            return {
                hasReveal: list.classList.contains('search-reveal'),
                collapsed: list.classList.contains('collapsed'),
                displayed: window.getComputedStyle(list).display !== 'none',
                anyMark: !!document.querySelector('.archive-item mark, .newswire-item mark'),
                anyHidden: !!document.querySelector('.archive-item.hidden, .newswire-item.hidden'),
            };
        });
        expect(after.hasReveal).toBe(false);
        expect(after.collapsed).toBe(true);   // user's collapse preference intact
        expect(after.displayed).toBe(false);
        expect(after.anyMark).toBe(false);    // highlights cleared
        expect(after.anyHidden).toBe(false);  // all items visible again

        // Restore expanded state for other tests.
        await page.click('#archive-toggle');
    }, 60000);

    test('tag: query hides archive and newswire wholesale and clears a lingering search-reveal', async () => {
        // Collapse the archive section, then hit it with a keyword so
        // search-reveal props it open…
        await page.click('#archive-toggle');
        await page.waitForFunction(() =>
            document.getElementById('archive-list').classList.contains('collapsed'), { timeout: 5000 });
        await typeSearch('Alpha');
        await page.waitForFunction(() =>
            document.getElementById('archive-list').classList.contains('search-reveal'), { timeout: 5000 });

        // …then append a tag: filter in the SAME query: the hide branch must
        // clear the reveal too, or the section lingers "open but empty"
        // (review PR #223 edge case).
        await typeSearch('Alpha tag:worktag');
        const bulk = await page.evaluate(() => ({
            archiveAllHidden: [...document.querySelectorAll('.archive-item')].every(el => el.classList.contains('hidden')),
            nwAllHidden: [...document.querySelectorAll('.newswire-item')].every(el => el.classList.contains('hidden')),
            archiveReveal: document.getElementById('archive-list').classList.contains('search-reveal'),
            nwReveal: document.getElementById('newswire-list').classList.contains('search-reveal'),
        }));
        expect(bulk.archiveAllHidden).toBe(true);
        expect(bulk.nwAllHidden).toBe(true);
        expect(bulk.archiveReveal).toBe(false);
        expect(bulk.nwReveal).toBe(false);

        await clearSearch();
        await page.click('#archive-toggle'); // restore expanded
    }, 60000);
});
