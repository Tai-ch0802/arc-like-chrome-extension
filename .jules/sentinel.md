## 2026-02-16 - Initial Security Baseline Scan
**Vulnerability:** N/A
**Severity:** Low
**Fix:** N/A
**Status:** Monitoring
**Notes:**
- `npm audit` passed with 0 vulnerabilities (dependencies are clean).
- Code scan for XSS (`innerHTML`, `eval`, `new Function`) showed proper sanitization via `escapeHtml` and safe usage of trusted content (e.g., SVG constants).
- `host_permissions` includes `*://*/*` which is required for RSS functionality but monitored as a high-risk permission.
- CSP is strictly configured in `manifest.json`.
- `modules/apiManager.js` and other core modules reviewed and found to be safe.

## 2026-02-23 - Dependency Vulnerability Fix & Security Scan
**Vulnerability:** `brace-expansion` (Moderate severity) via `npm audit`.
**Severity:** Medium
**Fix:** Ran `npm audit fix` to automatically patch the dependency vulnerability. `brace-expansion` was updated to a secure version.
**Status:** Fixed
**Notes:**
- `npm audit` showed 1 moderate vulnerability related to `brace-expansion`, which was fixed by `npm audit fix`.
- Code scan for XSS (`innerHTML`, `eval`, `new Function`) showed proper sanitization via `escapeHtml` and safe usage of trusted content (e.g., SVG constants, rendering safe HTML).
- Checked URL assignments (`.href`) and found it used safely. `window.addEventListener('message'` and `postMessage` were not found in the extension source code.
- Reviewed `manifest.json` permissions and CSP, they remain strictly configured and aligned with the least privilege principle except for `*://*/*` required for RSS.

## 2026-04-06 - [URL Injection Fix]
**Vulnerability:** Unsafe `.href` assignment allowing potential unsafe URIs in custom theme export.
**Severity:** High
**Fix:** Added URL protocol validation (`sanitizeUrl`) before assignment in `customThemeManager.js`.
**Status:** Fixed

## 2026-04-06 - [XSS Fix in settings]
**Vulnerability:** innerHTML usage with potentially unsafe content in RSS settings.
**Severity:** High
**Fix:** Replaced innerHTML with textContent and document.createElement in `renderRssList` in `settingManager.js`.
**Status:** Fixed

## 2026-05-18 - Dependency Vulnerability Fix
**Vulnerability:** Incomplete CRLF Injection Protection Allows Arbitrary FTP Command Execution via Credentials and MKD Commands (High severity) via `npm audit` for `basic-ftp <=5.2.1`.
**Severity:** High
**Fix:** Ran `npm audit fix` to update `basic-ftp` to `5.2.2`.
**Status:** Fixed
**Notes:**
- `npm audit` showed 1 high vulnerability related to `basic-ftp`, which was successfully patched.
- Code scan for XSS (`innerHTML`, `eval`, `new Function`) was performed. All user inputs are safely escaped using `textContent` or `escapeHtml` (e.g. `highlightText` function).
- URL assignment (`.href`) remains safely guarded by `sanitizeUrl`.
