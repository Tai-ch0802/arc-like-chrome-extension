import { resolveBadgeView } from '../../modules/ui/driveSyncBadge.js';

/**
 * Unit tests for the PURE view-model resolver behind the sidepanel drive-sync
 * badge. resolveBadgeView() takes a driveSyncStatus object and returns a compact
 * descriptor { hidden, glyph?, text?, title?, stateClass? } with no DOM / I/O.
 *
 * driveSyncBadge.js imports apiManager.js, which references chrome.i18n at CALL
 * time (not module-load time). The node-side chrome stub in
 * usecase_tests/puppeteer_tests/jest.setup.js defines
 * `chrome.i18n.getMessage: () => ''`, so every `api.getMessage(...)` returns the
 * empty string here. That makes the `getMessage(...) || 'fallback'` expressions
 * deterministically resolve to their English fallbacks — which is exactly what
 * these assertions match against.
 */
describe('resolveBadgeView', () => {
  describe('hidden states', () => {
    it('null status → hidden', () => {
      expect(resolveBadgeView(null)).toEqual({ hidden: true });
    });

    it('undefined status → hidden', () => {
      expect(resolveBadgeView(undefined)).toEqual({ hidden: true });
    });

    it('status with no state → hidden', () => {
      expect(resolveBadgeView({})).toEqual({ hidden: true });
    });

    it('needs-auth → hidden (surfaced in options, not as a sidepanel nag)', () => {
      expect(resolveBadgeView({ state: 'needs-auth' })).toEqual({ hidden: true });
    });

    it('unknown / unhandled state → hidden', () => {
      expect(resolveBadgeView({ state: 'something-new' })).toEqual({ hidden: true });
    });
  });

  describe('syncing', () => {
    it('visible with the syncing indicator + label', () => {
      const view = resolveBadgeView({ state: 'syncing' });
      expect(view.hidden).toBe(false);
      expect(view.glyph).toBe('↻');
      expect(view.text).toBe('Syncing…');
      expect(view.stateClass).toBe('is-syncing');
    });
  });

  describe('idle', () => {
    it('visible with the synced (cloud) indicator + title, empty text', () => {
      const view = resolveBadgeView({ state: 'idle' });
      expect(view.hidden).toBe(false);
      expect(view.glyph).toBe('☁︎');
      expect(view.text).toBe('');
      expect(view.title).toBe('Synced to Google Drive');
      expect(view.stateClass).toBe('is-idle');
    });

    it('idle ignores any status.message (no message appended to title)', () => {
      const view = resolveBadgeView({ state: 'idle', message: 'ignored' });
      expect(view.title).toBe('Synced to Google Drive');
    });
  });

  describe('warning states', () => {
    const cases = [
      ['error', 'Sync error'],
      ['conflict', 'Sync conflict detected'],
      ['drive-full', 'Google Drive is full'],
      ['offline', 'Offline'],
      ['needs-update', 'Update required to sync'],
    ];

    it.each(cases)('%s → visible warning with the base title', (state, baseTitle) => {
      const view = resolveBadgeView({ state });
      expect(view.hidden).toBe(false);
      expect(view.glyph).toBe('⚠');
      expect(view.text).toBe('');
      expect(view.title).toBe(baseTitle);
      expect(view.stateClass).toBe('is-warning');
    });

    it.each(cases)('%s → status.message flows into the title field', (state, baseTitle) => {
      const view = resolveBadgeView({ state, message: 'quota exceeded' });
      expect(view.title).toBe(`${baseTitle}: quota exceeded`);
      expect(view.hidden).toBe(false);
      expect(view.stateClass).toBe('is-warning');
    });
  });
});
