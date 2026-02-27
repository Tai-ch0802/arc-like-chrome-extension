/**
 * Hover Tooltip UI Component
 * Manages the floating tooltip DOM element for Hover Summarize.
 * Provides show/hide/update APIs with glassmorphism styling.
 */

/** @type {HTMLElement|null} */
let tooltipEl = null;
/** @type {number|null} */
let hideTimerId = null;
/** @type {boolean} */
let isMouseInTooltip = false;

/**
 * Lazily creates the tooltip DOM element.
 * @returns {HTMLElement}
 */
function getOrCreateTooltip() {
    if (tooltipEl) return tooltipEl;

    tooltipEl = document.createElement('div');
    tooltipEl.className = 'hover-tooltip';
    tooltipEl.setAttribute('role', 'tooltip');
    tooltipEl.innerHTML = `
        <div class="hover-tooltip__shimmer"></div>
        <div class="hover-tooltip__content hidden">
            <span class="hover-tooltip__text"></span>
        </div>
        <div class="hover-tooltip__meta hidden">
            <span class="hover-tooltip__domain"></span>
        </div>
    `;

    // Keep tooltip visible when mouse enters it (FR-5.05)
    tooltipEl.addEventListener('mouseenter', () => {
        isMouseInTooltip = true;
        if (hideTimerId) {
            clearTimeout(hideTimerId);
            hideTimerId = null;
        }
    });

    tooltipEl.addEventListener('mouseleave', () => {
        isMouseInTooltip = false;
        hide();
    });

    document.body.appendChild(tooltipEl);
    return tooltipEl;
}

/**
 * Positions the tooltip relative to an anchor element.
 * Appears to the right or below the anchor, whichever fits.
 * @param {HTMLElement} anchorEl 
 */
function positionTooltip(anchorEl) {
    const tt = getOrCreateTooltip();
    const rect = anchorEl.getBoundingClientRect();
    const ttWidth = 280; // max-width from CSS
    const margin = 8;

    // Try positioning to the right of the sidebar (which is typically the full width)
    let left = rect.right + margin;
    let top = rect.top;

    // If tooltip would overflow viewport width, position below
    if (left + ttWidth > window.innerWidth) {
        left = rect.left;
        top = rect.bottom + margin;
    }

    // Ensure tooltip doesn't overflow viewport bottom
    if (top + 80 > window.innerHeight) {
        top = Math.max(8, window.innerHeight - 100);
    }

    tt.style.left = `${left}px`;
    tt.style.top = `${top}px`;
}

/**
 * Shows the tooltip in loading (shimmer) state.
 * @param {HTMLElement} anchorEl 
 */
export function showLoading(anchorEl) {
    const tt = getOrCreateTooltip();

    // Reset to loading state
    const shimmer = tt.querySelector('.hover-tooltip__shimmer');
    const content = tt.querySelector('.hover-tooltip__content');
    const meta = tt.querySelector('.hover-tooltip__meta');

    if (shimmer) shimmer.classList.remove('hidden');
    if (content) content.classList.add('hidden');
    if (meta) meta.classList.add('hidden');

    positionTooltip(anchorEl);

    // Clear any pending hide
    if (hideTimerId) {
        clearTimeout(hideTimerId);
        hideTimerId = null;
    }

    // Trigger show animation
    requestAnimationFrame(() => {
        tt.classList.add('visible');
    });
}

/**
 * Shows the tooltip with a completed summary.
 * @param {string} summary - The summary text (may include emoji prefix)
 * @param {string} domain - The page domain for the meta line
 * @param {HTMLElement} anchorEl 
 */
export function showSummary(summary, domain, anchorEl) {
    const tt = getOrCreateTooltip();

    const shimmer = tt.querySelector('.hover-tooltip__shimmer');
    const content = tt.querySelector('.hover-tooltip__content');
    const textEl = tt.querySelector('.hover-tooltip__text');
    const meta = tt.querySelector('.hover-tooltip__meta');
    const domainEl = tt.querySelector('.hover-tooltip__domain');

    if (shimmer) shimmer.classList.add('hidden');
    if (content) content.classList.remove('hidden');
    if (textEl) textEl.textContent = summary;
    if (domain && meta && domainEl) {
        meta.classList.remove('hidden');
        domainEl.textContent = domain;
    }

    positionTooltip(anchorEl);

    // Ensure visible
    requestAnimationFrame(() => {
        tt.classList.add('visible');
    });
}

/**
 * Updates the tooltip text during streaming.
 * @param {string} chunk - The current accumulated text
 */
export function updateStreamChunk(chunk) {
    if (!tooltipEl) return;
    const shimmer = tooltipEl.querySelector('.hover-tooltip__shimmer');
    const content = tooltipEl.querySelector('.hover-tooltip__content');
    const textEl = tooltipEl.querySelector('.hover-tooltip__text');

    if (shimmer) shimmer.classList.add('hidden');
    if (content) content.classList.remove('hidden');
    if (textEl) textEl.textContent = chunk;
}

/**
 * Hides the tooltip with a 300ms delay.
 * If the mouse is inside the tooltip, it won't hide.
 */
export function hide() {
    if (isMouseInTooltip) return;

    if (hideTimerId) {
        clearTimeout(hideTimerId);
    }

    hideTimerId = setTimeout(() => {
        if (tooltipEl && !isMouseInTooltip) {
            tooltipEl.classList.remove('visible');
        }
        hideTimerId = null;
    }, 300);
}

/**
 * Immediately hides the tooltip without delay.
 */
export function hideImmediately() {
    if (hideTimerId) {
        clearTimeout(hideTimerId);
        hideTimerId = null;
    }
    if (tooltipEl) {
        tooltipEl.classList.remove('visible');
    }
    isMouseInTooltip = false;
}
