/**
 * Shared sidepanel toast.
 *
 * Extracted from aiGrouperUI so other features (e.g. cloud AI auth-error
 * surfacing) can reuse the same `#toast-*` DOM defined in sidepanel.html.
 * The undo BUTTON's click handling stays with its feature owner
 * (aiGrouperUI binds #toast-undo-btn); this module only controls visibility.
 */
import * as api from '../apiManager.js';

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
            || 'Your AI provider rejected the API key. Check Settings → AI.');
    });
}
