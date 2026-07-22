/**
 * Shared sidepanel toast.
 *
 * Extracted from aiGrouperUI so other features (e.g. cloud AI auth-error
 * surfacing) can reuse the same `#toast-*` DOM defined in sidepanel.html.
 * The undo BUTTON's click handling stays with its feature owner
 * (aiGrouperUI binds #toast-undo-btn); this module only controls visibility.
 */
import * as api from '../apiManager.js';
import * as driveAuth from '../sync/driveAuth.js';

let toastTimeoutId = null;

/**
 * Shows the toast with a message; auto-hides after 10s.
 * @param {string} message
 * @param {boolean} [allowUndo] - Show the Undo button (caller owns its click handler).
 */
export function showToast(message, allowUndo = false) {
    const toastContainer = document.getElementById('toast-container');
    const msgEl = document.getElementById('toast-message');
    const undoBtn = document.getElementById('toast-undo-btn');

    if (!toastContainer || !msgEl || !undoBtn) return;

    msgEl.textContent = message;

    if (allowUndo) {
        undoBtn.classList.remove('hidden');
    } else {
        undoBtn.classList.add('hidden');
    }

    toastContainer.classList.remove('hidden');

    if (toastTimeoutId) {
        clearTimeout(toastTimeoutId);
    }

    toastTimeoutId = setTimeout(() => {
        hideToast();
    }, 10000); // 10 seconds limit for Undo
}

/** Hides the toast and clears the auto-hide timer. */
export function hideToast() {
    const toastContainer = document.getElementById('toast-container');
    if (toastContainer) {
        toastContainer.classList.add('hidden');
    }
    if (toastTimeoutId) {
        clearTimeout(toastTimeoutId);
        toastTimeoutId = null;
    }
}

// === Cloud AI provider auth-error surfacing ===

/** Don't re-toast the same auth failure more often than this. */
const AUTH_ERROR_TOAST_COOLDOWN_MS = 60 * 1000;
let lastAuthErrorToastAt = 0;

/**
 * Listens for `aiProviderAuthErrorChanged` (dispatched by settingsBridge when
 * aiManager records a 401/403 from the cloud provider — possibly from the
 * background service worker) and shows a throttled hint toast. Repeated
 * failures (e.g. background auto-naming retrying with a bad key) are
 * debounced so the user isn't spammed.
 */
export function initAiProviderErrorToast() {
    document.addEventListener('aiProviderAuthErrorChanged', () => {
        const now = Date.now();
        if (now - lastAuthErrorToastAt < AUTH_ERROR_TOAST_COOLDOWN_MS) return;
        lastAuthErrorToastAt = now;
        showToast(api.getMessage('aiProviderAuthError')
            || 'Your AI provider rejected the request (authorization failed). Check Settings → AI.');
    });
}

// === RSS cross-device sync onboarding ===

/** Shown at most once, ever. */
const RSS_SYNC_ONBOARDING_KEY = 'rssSyncOnboardingShown';

/**
 * One-time nudge: if the user actually uses RSS (has subscriptions) but has not
 * connected Google Drive, suggest signing in so their RSS subscriptions and
 * read history sync across devices (and stop re-fetching duplicates). Shown once
 * per install and never again. Call AFTER initRssManager so the local
 * subscription working copy is seeded/migrated.
 */
export async function initRssSyncOnboarding() {
    try {
        const flags = await api.getStorage('local', [RSS_SYNC_ONBOARDING_KEY, 'rssSubscriptions']);
        if (flags[RSS_SYNC_ONBOARDING_KEY]) return;
        const subs = flags.rssSubscriptions;
        if (!Array.isArray(subs) || subs.length === 0) return; // only nudge real RSS users
        if (await driveAuth.isConnected()) return;              // already signed in
        // Set BEFORE showing so a race between two panels shows it at most once.
        await api.setStorage('local', { [RSS_SYNC_ONBOARDING_KEY]: true });
        showToast(api.getMessage('rssSyncSignInHint')
            || 'Sign in to Google in Settings to sync your RSS subscriptions and reading history across devices.');
    } catch (e) {
        console.warn('RSS: sync onboarding hint failed', e);
    }
}

// === Newswire cross-device sync onboarding (BASE-016 N3) ===

/** Shown at most once, ever. */
const NEWSWIRE_SYNC_ONBOARDING_KEY = 'newswireSyncOnboardingShown';

/**
 * One-time nudge (mirrors initRssSyncOnboarding): if the user has enabled any
 * newswire source but has not connected Google Drive, suggest signing in so
 * their source settings and keyword rules roam across devices. Shown once per
 * install and never again. Call AFTER initNewswireSection.
 */
export async function initNewswireSyncOnboarding() {
    try {
        const flags = await api.getStorage('local', [NEWSWIRE_SYNC_ONBOARDING_KEY, 'newswireConfig']);
        if (flags[NEWSWIRE_SYNC_ONBOARDING_KEY]) return;
        const cfg = flags.newswireConfig;
        const anyEnabled = cfg && cfg.sources
            && Object.values(cfg.sources).some((s) => s && s.enabled);
        if (!anyEnabled) return;                      // only nudge real newswire users
        if (await driveAuth.isConnected()) return;    // already signed in
        // Set BEFORE showing so a race between two panels shows it at most once.
        await api.setStorage('local', { [NEWSWIRE_SYNC_ONBOARDING_KEY]: true });
        showToast(api.getMessage('newswireSyncSignInHint')
            || 'Sign in to Google in Settings to sync your news sources and rules across devices.');
    } catch (e) {
        console.warn('newswire: sync onboarding hint failed', e);
    }
}
