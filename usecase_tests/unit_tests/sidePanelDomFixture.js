/**
 * Side-panel DOM + chrome.* fixture for jsdom unit tests of the UI renderers.
 *
 * `modules/ui/elements.js` resolves its containers with document.getElementById
 * at import time and the renderer modules reach for chrome.* lazily, so this
 * file must be imported BEFORE any renderer module (ES module evaluation order
 * follows import order; the esbuild CJS transform used by `npm run test:unit`
 * preserves it too). Import it for its side effects only:
 *
 *     import './sidePanelDomFixture.js';
 *     import * as tabRenderer from '../../modules/ui/tabRenderer.js';
 *
 * Kept free of `.test.` in its name so Jest does not collect it as a suite.
 */

document.body.innerHTML = `
    <div id="tab-list"></div>
    <div id="bookmark-list"></div>
    <input id="search-box" />
    <button id="clear-search-btn"></button>
    <span id="search-result-count"></span>
    <div id="other-windows-list"></div>
    <div id="no-search-results"></div>
    <button id="clear-search-cta"></button>
    <div id="content-container"></div>
    <div id="reading-list"></div>
`;

const noopStorageArea = { get: async () => ({}), set: async () => {}, remove: async () => {} };

globalThis.chrome = {
    i18n: { getMessage: () => '' },
    runtime: { getURL: (p) => p, getManifest: () => ({ version: '0.0.0' }), lastError: null },
    tabs: { query: async () => [] },
    tabGroups: { TAB_GROUP_ID_NONE: -1, query: async () => [] },
    windows: { WINDOW_ID_CURRENT: -2, WINDOW_ID_NONE: -1 },
    storage: {
        local: noopStorageArea,
        sync: noopStorageArea,
        session: noopStorageArea,
        onChanged: { addListener: () => {} },
    },
};
