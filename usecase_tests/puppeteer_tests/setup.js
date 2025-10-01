const puppeteer = require('puppeteer');
const path = require('path');

const EXTENSION_PATH = path.resolve(__dirname, '../../'); // Path to your extension's root directory
// const EXTENSION_ID = 'YOUR_EXTENSION_ID'; // You'll need to get this dynamically or from manifest.json

async function setupBrowser() {
    const browser = await puppeteer.launch({
        headless: false, // Set to true for headless mode
        args: [
            `--disable-extensions-except=${EXTENSION_PATH}`,
            `--load-extension=${EXTENSION_PATH}`,
            '--no-sandbox', // Required for some environments
            '--disable-setuid-sandbox' // Required for some environments
        ]
    });

    const page = await browser.newPage();
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

module.exports = { setupBrowser, teardownBrowser };