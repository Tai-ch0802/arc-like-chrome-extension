/**
 * Fetches the latest release version from GitHub API and updates the version badge.
 */
document.addEventListener('DOMContentLoaded', () => {
    const CACHE_KEY = 'arc_sidebar_latest_version';
    const CACHE_TIME_KEY = 'arc_sidebar_version_timestamp';
    const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

    // 1. Try to load from localStorage cache first to avoid rate limits and improve speed
    const cachedVersion = localStorage.getItem(CACHE_KEY);
    const cacheTimestamp = localStorage.getItem(CACHE_TIME_KEY);

    if (cachedVersion && cacheTimestamp && (Date.now() - parseInt(cacheTimestamp) < CACHE_TTL_MS)) {
        updateVersionUI(cachedVersion);
        return;
    }

    // 2. Fetch from GitHub API if no cache or expired
    fetch('https://api.github.com/repos/Tai-ch0802/arc-like-chrome-extension/releases/latest')
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(data => {
            if (data && data.tag_name) {
                const version = data.tag_name;
                updateVersionUI(version);

                // Save to cache
                localStorage.setItem(CACHE_KEY, version);
                localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
            }
        })
        .catch(error => {
            console.warn('Failed to fetch latest version from GitHub:', error);
            // Fallback: If fetch fails, we just leave the hardcoded HTML version as is.
        });
});

function updateVersionUI(version) {
    const badges = document.querySelectorAll('.badge-version');
    badges.forEach(badge => {
        badge.textContent = version;
    });
}
