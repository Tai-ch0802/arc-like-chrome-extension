/**
 * @file oauthConfig.js
 * OAuth client configuration for the non-Chrome (launchWebAuthFlow) path.
 *
 * `manifest.json`'s `oauth2.client_id` is a "Chrome Extension" client that
 * only works with `chrome.identity.getAuthToken` (Google Chrome's own account
 * layer). Other Chromium brands (Dia) authenticate through the implicit grant
 * in a popup, which Google only accepts for a **Web application** client whose
 * authorised redirect URI is this extension's
 * `https://<extension-id>.chromiumapp.org/` — registered for the Chrome Web
 * Store id `beoonblekmppafnjppedgpgfngghebji`. Unpacked dev builds get a
 * different id and therefore `redirect_uri_mismatch` (same constraint the
 * getAuthToken path has always had).
 *
 * A web client id is public by design; there is no secret anywhere in the
 * extension (implicit grant, no refresh token).
 */

/** Web application OAuth client (same Google Cloud project as manifest oauth2.client_id). */
export const WEB_CLIENT_ID = '849720332841-242ebrlflepmcg8ejn6fed8i3dg4n5s1.apps.googleusercontent.com';

/**
 * Requested ONLY on the web path, in the authorisation URL — never added to
 * manifest `oauth2.scopes`: changing that set invalidates every existing
 * Chrome user's cached grant (PRD FR-2.07). Provides the account email used
 * for `login_hint` on silent refresh and for the options "connected as" row.
 */
export const USERINFO_EMAIL_SCOPE = 'https://www.googleapis.com/auth/userinfo.email';
