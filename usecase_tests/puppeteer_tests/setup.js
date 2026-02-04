const puppeteer = require('puppeteer');
const path = require('path');

const EXTENSION_PATH = path.resolve(__dirname, '../../'); // Path to your extension's root directory
// const EXTENSION_ID = 'YOUR_EXTENSION_ID'; // You'll need to get this dynamically or from manifest.json

async function setupBrowser() {
    const browser = await puppeteer.launch({
        headless: "new", // Set to "new" for headless mode
        args: [
            `--disable-extensions-except=${EXTENSION_PATH}`,
            `--load-extension=${EXTENSION_PATH}`,
            '--no-sandbox', // Required for some environments
            '--disable-setuid-sandbox' // Required for some environments
        ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    // Get the extension ID dynamically if possible, or from manifest.json
    // For now, we'll assume the side panel URL structure
    const extensionTarget = await browser.waitForTarget(
        target => target.type() === 'service_worker' || target.url().startsWith('chrome-extension://')
    );
    const extensionId = extensionTarget.url().split('/')[2];
    const sidePanelUrl = `chrome-extension://${extensionId}/sidepanel.html`;

    await page.goto(sidePanelUrl);

    return { browser, page, extensionId, sidePanelUrl };
}

async function teardownBrowser(browser) {
    await browser.close();
}

/**
 * Expands the Bookmarks Bar folder (id="1") if it's collapsed.
 * Required because dynamic rendering only shows children when folder is expanded.
 */
async function expandBookmarksBar(page) {
    const bookmarksBarSelector = '.bookmark-folder[data-bookmark-id="1"]';
    await page.waitForSelector(bookmarksBarSelector);
    const isCollapsed = await page.$eval(bookmarksBarSelector, el =>
        el.querySelector('.bookmark-icon').textContent.includes('▶')
    );
    if (isCollapsed) {
        await page.click(bookmarksBarSelector);
        await page.waitForFunction(
            s => document.querySelector(s).querySelector('.bookmark-icon').textContent.includes('▼'),
            {},
            bookmarksBarSelector
        );
    }
}

/**
 * Wait for a specific number of tab items to appear in the sidebar
 * @param {Page} page - Puppeteer page
 * @param {number} expectedCount - Minimum expected tab count
 * @param {number} timeout - Timeout in ms (default 5000)
 */
async function waitForTabCount(page, expectedCount, timeout = 5000) {
    await page.waitForFunction(
        count => document.querySelectorAll('.tab-item').length >= count,
        { timeout },
        expectedCount
    );
}

/**
 * Wait for an element to have a specific attribute value
 * @param {Page} page - Puppeteer page
 * @param {string} selector - CSS selector
 * @param {string} attribute - Attribute name
 * @param {string} expectedValue - Expected attribute value
 * @param {number} timeout - Timeout in ms (default 5000)
 */
async function waitForAttribute(page, selector, attribute, expectedValue, timeout = 5000) {
    await page.waitForFunction(
        (sel, attr, val) => document.querySelector(sel)?.getAttribute(attr) === val,
        { timeout },
        selector, attribute, expectedValue
    );
}

/**
 * Wait for element text content to contain a specific string
 * @param {Page} page - Puppeteer page
 * @param {string} selector - CSS selector
 * @param {string} expectedText - Text to look for
 * @param {number} timeout - Timeout in ms (default 5000)
 */
async function waitForTextContent(page, selector, expectedText, timeout = 5000) {
    await page.waitForFunction(
        (sel, text) => document.querySelector(sel)?.textContent?.includes(text),
        { timeout },
        selector, expectedText
    );
}

/**
 * Wait for element to be removed from DOM
 * @param {Page} page - Puppeteer page
 * @param {string} selector - CSS selector
 * @param {number} timeout - Timeout in ms (default 5000)
 */
async function waitForElementRemoved(page, selector, timeout = 5000) {
    await page.waitForFunction(
        sel => !document.querySelector(sel),
        { timeout },
        selector
    );
}

/**
 * Wait for element to have a specific class
 * @param {Page} page - Puppeteer page
 * @param {string} selector - CSS selector
 * @param {string} className - Class name to check
 * @param {number} timeout - Timeout in ms (default 5000)
 */
async function waitForClass(page, selector, className, timeout = 5000) {
    await page.waitForFunction(
        (sel, cls) => document.querySelector(sel)?.classList.contains(cls),
        { timeout },
        selector, className
    );
}

/**
 * Wait for data-theme attribute on body to change to expected value
 * @param {Page} page - Puppeteer page
 * @param {string} expectedTheme - Expected theme value
 * @param {number} timeout - Timeout in ms (default 5000)
 */
async function waitForTheme(page, expectedTheme, timeout = 5000) {
    await page.waitForFunction(
        theme => document.body.dataset.theme === theme,
        { timeout },
        expectedTheme
    );
}

module.exports = {
    setupBrowser,
    teardownBrowser,
    expandBookmarksBar,
    waitForTabCount,
    waitForAttribute,
    waitForTextContent,
    waitForElementRemoved,
    waitForClass,
    waitForTheme
};