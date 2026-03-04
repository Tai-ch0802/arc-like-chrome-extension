// Initialize Google Analytics 4
const GA_MEASUREMENT_ID = 'G-X64RWB40SB';

// Inject GA4 Script tag dynamically
const script = document.createElement('script');
script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
script.async = true;
document.head.appendChild(script);

// Initialize dataLayer
window.dataLayer = window.dataLayer || [];
function gtag() {
    dataLayer.push(arguments);
}
gtag('js', new Date());
gtag('config', GA_MEASUREMENT_ID);

/**
 * Custom Event Tracking Helper
 * @param {string} eventName - Name of the event to track (e.g., 'extension_install_clicked')
 * @param {object} properties - Additional context parameters
 */
function trackEvent(eventName, properties = {}) {
    if (typeof gtag === 'function') {
        gtag('event', eventName, properties);
    } else {
        console.warn(`[Analytics] Event ${eventName} not tracked (gtag not found)`, properties);
    }
}

// Bind event listeners on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    // Track "Add to Chrome" button clicks
    const installButtons = document.querySelectorAll('a[href*="chromewebstore.google.com/detail/"]');

    installButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            // Get location context (navbar, hero, footer, etc.)
            let locationContext = 'unknown';
            if (button.closest('nav')) locationContext = 'navbar';
            else if (button.closest('.hero-actions')) locationContext = 'hero';
            else if (button.closest('.guide-cta')) locationContext = 'guide_bottom_cta';

            trackEvent('extension_install_clicked', {
                'click_location': locationContext,
                'page_path': window.location.pathname
            });
            console.log(`[Analytics] Tracked install click from: ${locationContext}`);
        });
    });

    // Track GitHub repository link clicks
    const githubLinks = document.querySelectorAll('a[href="https://github.com/Tai-ch0802/arc-like-chrome-extension"]');
    githubLinks.forEach(link => {
        link.addEventListener('click', () => {
            let locationContext = 'unknown';
            if (link.closest('nav')) locationContext = 'navbar';
            else if (link.closest('.hero-actions')) locationContext = 'hero';
            else if (link.closest('footer')) locationContext = 'footer';

            trackEvent('github_repo_clicked', {
                'click_location': locationContext,
                'page_path': window.location.pathname
            });
        });
    });
});

// Make trackEvent available globally
window.trackEvent = trackEvent;
