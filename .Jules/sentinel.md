## 2025-02-18 - Security Scan & Hardening

**Vulnerability:** Missing Content Security Policy (CSP) in `manifest.json`.
**Severity:** Medium
**Fix:** Added strict CSP: `"content_security_policy": { "extension_pages": "script-src 'self'; object-src 'none';" }`.
**Status:** Fixed

**Vulnerability:** Potential XSS in `showCustomDialog` (modules/modalManager.js) if used with untrusted strings.
**Severity:** Low (Internal usage seems safe, but API was risky)
**Fix:** Updated `showCustomDialog` to accept DOM Nodes, enabling safer usage patterns.
**Status:** Fixed

**Vulnerability:** Use of `innerHTML` in various UI renderers.
**Severity:** Low
**Fix:** Verified usage. `searchManager.js` uses `escapeHtml`. `customThemeManager.js` uses `blob:` URLs. Other usages are for icons or clearing content.
**Status:** Monitoring
