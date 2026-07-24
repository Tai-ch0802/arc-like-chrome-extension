// Known limitation: hostname-based validation cannot prevent DNS rebinding attacks.
// Attacker DNS may resolve to a public IP during validation, then to a private IP
// during fetch(). Client-side JS has no pre-connect IP inspection API.
export function validateFeedUrl(feedUrl) {
    let parsedUrl;
    try { parsedUrl = new URL(feedUrl); } catch { return 'Invalid feed URL'; }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        return 'Invalid feed URL protocol';
    }

    const hostname = parsedUrl.hostname.toLowerCase().replace(/^\[|\]$/g, '');

    if (
        hostname === 'localhost' ||
        hostname === '0.0.0.0' ||
        /^127\./.test(hostname) ||
        /^10\./.test(hostname) ||
        /^192\.168\./.test(hostname) ||
        /^172\.(1[6-9]|2[0-9]|3[01])\./.test(hostname) ||
        /^169\.254\./.test(hostname)
    ) {
        return 'Feed URL points to private network';
    }

    // IPv6 private ranges — only check when hostname is an IPv6 literal (contains ':').
    // Regular DNS hostnames never contain colons, so this avoids false-positives
    // on domains like fc.example.com, fdroid-mirror.org, fe80something.dev.
    if (hostname.includes(':')) {
        if (
            hostname === '::1' ||
            /^fc/i.test(hostname) ||
            /^fd/i.test(hostname) ||
            /^fe80/i.test(hostname) ||
            /^::ffff:/i.test(hostname)
        ) {
            return 'Feed URL points to private network';
        }
    }

    return null;
}
