# Google Drive Sync — One-Time Setup

This document covers the manual provisioning steps required before Drive sync can authenticate.
Until these steps are done and the placeholder `client_id` in `manifest.json` is replaced, sync
stays inert — `chrome.identity.getAuthToken` will fail gracefully and no data is uploaded or read.

---

## 1. Enable the Google Drive API

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (or reuse an existing one).
3. Navigate to **APIs & Services → Library**.
4. Search for **Google Drive API** and click **Enable**.

---

## 2. Configure the OAuth Consent Screen

1. Go to **APIs & Services → OAuth consent screen**.
2. Select **External** user type and click **Create**.
3. Fill in the required fields:
   - **App name**: Sidebar for Tabs & Bookmarks
   - **User support email**: your maintainer address
   - **App logo**: use the 128 px extension icon
   - **Application homepage**: `https://sidebar-for-tabs-bookmarks.taislife.work/`
   - **Privacy policy URL**: `https://sidebar-for-tabs-bookmarks.taislife.work/privacy.html`
   - **Terms of service URL**: (optional)
4. Click **Save and Continue** to reach **Scopes**.
5. Click **Add or Remove Scopes** and add:
   - `https://www.googleapis.com/auth/drive.appdata`
   
   This scope is classified **non-sensitive** (app-private folder only, invisible to users).
   Basic brand verification is sufficient — no CASA (Cloud App Security Assessment) required.
6. Complete the remaining wizard steps. Add yourself as a **test user** while in sandbox.

> **Unverified app warning**: Until Google completes brand verification the consent screen shows
> "This app isn't verified" and is capped at **100 lifetime new users**. Submit for verification
> once the extension is ready for broad release.

---

## 3. Create the OAuth Client ID

1. Go to **APIs & Services → Credentials**.
2. Click **Create Credentials → OAuth client ID**.
3. Set **Application type** to **Chrome Extension** (formerly listed as "Chrome App").
4. Enter the extension's **Extension ID** (see §5 below for how to find / fix this).
5. Click **Create**. Copy the generated `client_id` (format: `XXXXXXXXXX.apps.googleusercontent.com`).

---

## 4. Replace the Placeholder client_id

Open `manifest.json` and replace the placeholder value:

```json
"oauth2": {
  "client_id": "REPLACE_WITH_YOUR_OAUTH_CLIENT_ID.apps.googleusercontent.com",
  "scopes": ["https://www.googleapis.com/auth/drive.appdata"]
}
```

Replace `REPLACE_WITH_YOUR_OAUTH_CLIENT_ID.apps.googleusercontent.com` with the real value.

**Do NOT commit the real `client_id` to a public repository** without understanding the
security implications (client IDs for Chrome Extensions are not secret, but be aware of the
policy).

---

## 5. Extension-ID Parity (dev vs. prod)

The OAuth `client_id` is **bound to the extension ID**. A mismatch produces a
`"bad client id"` error in the environment where the IDs differ.

- **Chrome Web Store (production)**: the store assigns a fixed extension ID based on the upload.
  The `client_id` you created in §3 must use that store-assigned ID.
- **Unpacked dev load**: Chrome assigns a different, hash-based extension ID by default, causing
  auth to fail in the dev environment.

### How to get dev↔prod parity

1. Install the extension from the Web Store once and navigate to `chrome://extensions`.
2. Click **Details** on the store-installed extension → copy the **Extension ID**.
3. Navigate to the installed extension's directory and open its `manifest.json`.
   Copy the `"key"` field (a long base64 string).
4. Add that `"key"` field to your dev `manifest.json`. Chrome will derive the same extension ID
   from the key, making dev and prod share the same ID.

> **Note on the `key` field**: This project intentionally does NOT commit a `key` field.
> A `key` field ships in every build produced by `make` and `make release` — if it were
> committed it would appear in the Web Store package, where the store overrides it anyway.
> Add the `key` locally after cloning; do not commit it.

---

## 6. Privacy and Compliance Notes

- `PRIVACY_POLICY.md` must disclose that the extension uploads workspace data to Google Drive
  (appdata folder). This is handled in batch **E5**.
- The extension homepage (`/`) must display the verbatim Google API Services User Data Policy
  **Limited Use** affirmative statement as required for OAuth verification. This is also
  handled in batch E5.
- The `drive.appdata` scope stores data in a folder that is app-private and not visible to the
  user in the Drive UI, but the user retains ownership and can revoke access at any time.
