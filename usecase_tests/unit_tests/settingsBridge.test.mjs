import { resolveSettingChangeActions } from '../../modules/ui/settingsBridge.js';

describe('resolveSettingChangeActions', () => {
  it('local pref_theme → applyTheme action', () => {
    expect(resolveSettingChangeActions({ pref_theme: { newValue: { v: 'google', t: 1 } } }, 'local'))
      .toContainEqual({ type: 'applyTheme', value: 'google' });
  });
  it('local pref_readingListVisible → dispatch event action', () => {
    expect(resolveSettingChangeActions({ pref_readingListVisible: { newValue: { v: false, t: 1 } } }, 'local'))
      .toContainEqual({ type: 'dispatch', event: 'readingListVisibilityChanged', detail: { visible: false } });
  });
  it('local pref_uiLanguage → reload action', () => {
    expect(resolveSettingChangeActions({ pref_uiLanguage: { newValue: { v: 'ja', t: 1 } } }, 'local'))
      .toContainEqual({ type: 'reload' });
  });
  it('local custom_bg_image_data → applyBackground action', () => {
    expect(resolveSettingChangeActions({ custom_bg_image_data: { newValue: 'x' } }, 'local'))
      .toContainEqual({ type: 'applyBackground' });
  });
  it('local driveSyncStatus → dispatch driveSyncStatusChanged action', () => {
    expect(resolveSettingChangeActions({ driveSyncStatus: { newValue: { state: 'syncing' } } }, 'local'))
      .toContainEqual({ type: 'dispatch', event: 'driveSyncStatusChanged', detail: { state: 'syncing' } });
  });
  it('local unrelated key → no driveSync action', () => {
    const actions = resolveSettingChangeActions({ someOtherLocalKey: { newValue: 1 } }, 'local');
    expect(actions.some(a => a.type === 'dispatch' && a.event === 'driveSyncStatusChanged')).toBe(false);
  });
  it('unrelated key → no actions', () => {
    expect(resolveSettingChangeActions({ someOtherKey: { newValue: 1 } }, 'sync')).toEqual([]);
  });
  it('aiCleanupVisible / aiGroupingVisible → dispatch their events', () => {
    expect(resolveSettingChangeActions({ pref_aiCleanupVisible: { newValue: { v: true, t: 1 } } }, 'local'))
      .toContainEqual({ type: 'dispatch', event: 'aiCleanupVisibilityChanged', detail: { visible: true } });
    expect(resolveSettingChangeActions({ pref_aiGroupingVisible: { newValue: { v: true, t: 1 } } }, 'local'))
      .toContainEqual({ type: 'dispatch', event: 'aiGroupingVisibilityChanged', detail: { visible: true } });
  });
  it('local pref_readingListVisible → ALSO refreshState action (plus dispatch)', () => {
    const actions = resolveSettingChangeActions({ pref_readingListVisible: { newValue: { v: false, t: 1 } } }, 'local');
    expect(actions).toContainEqual({ type: 'dispatch', event: 'readingListVisibilityChanged', detail: { visible: false } });
    expect(actions).toContainEqual({ type: 'refreshState', key: 'readingListVisible' });
  });
  it('sync aiGroupingVisible / aiCleanupVisible → ALSO refreshState actions', () => {
    expect(resolveSettingChangeActions({ pref_aiGroupingVisible: { newValue: { v: true, t: 1 } } }, 'local'))
      .toContainEqual({ type: 'refreshState', key: 'aiGroupingVisible' });
    expect(resolveSettingChangeActions({ pref_aiCleanupVisible: { newValue: { v: true, t: 1 } } }, 'local'))
      .toContainEqual({ type: 'refreshState', key: 'aiCleanupVisible' });
  });
  it('sync aiAutoNamingEnabled → refreshState action (no dispatch)', () => {
    const actions = resolveSettingChangeActions({ pref_aiAutoNamingEnabled: { newValue: { v: true, t: 1 } } }, 'local');
    expect(actions).toContainEqual({ type: 'refreshState', key: 'aiAutoNamingEnabled' });
    expect(actions.some(a => a.type === 'dispatch')).toBe(false);
  });
  it('sync hoverSummarizeEnabled → refreshState action', () => {
    expect(resolveSettingChangeActions({ pref_hoverSummarizeEnabled: { newValue: { v: false, t: 1 } } }, 'local'))
      .toContainEqual({ type: 'refreshState', key: 'hoverSummarizeEnabled' });
  });
  it('sync readingListSummaryEnabled → refreshState action', () => {
    expect(resolveSettingChangeActions({ pref_readingListSummaryEnabled: { newValue: { v: false, t: 1 } } }, 'local'))
      .toContainEqual({ type: 'refreshState', key: 'readingListSummaryEnabled' });
  });
  it('local aiProviderAuthError → dispatch aiProviderAuthErrorChanged action', () => {
    const detail = { providerId: 'anthropic', status: 401, at: 123 };
    expect(resolveSettingChangeActions({ aiProviderAuthError: { newValue: detail } }, 'local'))
      .toContainEqual({ type: 'dispatch', event: 'aiProviderAuthErrorChanged', detail });
  });
  it('sync pageReaderVisible → dispatch event AND refreshState actions', () => {
    const actions = resolveSettingChangeActions({ pref_pageReaderVisible: { newValue: { v: false, t: 1 } } }, 'local');
    expect(actions).toContainEqual({ type: 'dispatch', event: 'pageReaderVisibilityChanged', detail: { visible: false } });
    expect(actions).toContainEqual({ type: 'refreshState', key: 'pageReaderVisible' });
  });
  it('sync newswireVisible → dispatch event AND refreshState actions (BASE-016 N1)', () => {
    const actions = resolveSettingChangeActions({ pref_newswireVisible: { newValue: { v: false, t: 1 } } }, 'local');
    expect(actions).toContainEqual({ type: 'dispatch', event: 'newswireVisibilityChanged', detail: { visible: false } });
    expect(actions).toContainEqual({ type: 'refreshState', key: 'newswireVisible' });
  });
  it('sync sectionOrder → dispatch sectionOrderChanged action (BASE-015)', () => {
    const order = ['bookmarks', 'tabs', 'otherWindows', 'readingList'];
    expect(resolveSettingChangeActions({ pref_sectionOrder: { newValue: { v: order, t: 1 } } }, 'local'))
      .toContainEqual({ type: 'dispatch', event: 'sectionOrderChanged', detail: { order } });
  });
});

// ISSUE-257: per-device capability flags live in storage.local; the sidepanel
// re-evaluates grouping UI when they change (written by apiManager in any context).
describe('capability flags (ISSUE-257)', () => {
  it('local tabGroupsUnsupported → capabilitiesChanged dispatch', () => {
    const flag = { unsupported: true, brand: 'Chromium', majorVersion: 156, at: 1 };
    expect(resolveSettingChangeActions({ tabGroupsUnsupported: { newValue: flag } }, 'local'))
      .toContainEqual({ type: 'dispatch', event: 'capabilitiesChanged', detail: { name: 'tabGroupsUnsupported', unsupported: true } });
  });
  it('local sidePanelUnavailable removed → capabilitiesChanged with unsupported false', () => {
    expect(resolveSettingChangeActions({ sidePanelUnavailable: { oldValue: { unsupported: true } } }, 'local'))
      .toContainEqual({ type: 'dispatch', event: 'capabilitiesChanged', detail: { name: 'sidePanelUnavailable', unsupported: false } });
  });
  it('sync tabGroupsUnsupported is ignored (flags are per-device)', () => {
    expect(resolveSettingChangeActions({ tabGroupsUnsupported: { newValue: { unsupported: true } } }, 'sync')).toEqual([]);
  });
});

describe('legacy storage.sync prefs are ignored (ISSUE-257 WP3)', () => {
  it('a sync theme write from an old device produces no action', () => {
    expect(resolveSettingChangeActions({ theme: { newValue: 'google' } }, 'sync')).toEqual([]);
  });
  it('a removed pref record maps to newValue undefined (no crash)', () => {
    expect(resolveSettingChangeActions({ pref_theme: { oldValue: { v: 'x', t: 1 } } }, 'local'))
      .toContainEqual({ type: 'applyTheme', value: undefined });
  });
});


describe('pref records rewritten with only a newer t (Drive pull) produce no actions', () => {
  it('pref_uiLanguage same value, different t → no reload', () => {
    expect(resolveSettingChangeActions({ pref_uiLanguage: { oldValue: { v: 'ja', t: 1 }, newValue: { v: 'ja', t: 9 } } }, 'local')).toEqual([]);
  });
  it('pref_customTheme same value with different key order → no action', () => {
    expect(resolveSettingChangeActions({ pref_customTheme: { oldValue: { v: { a: 1, b: 2 }, t: 1 }, newValue: { v: { b: 2, a: 1 }, t: 2 } } }, 'local')).toEqual([]);
  });
  it('a genuine value change still acts', () => {
    expect(resolveSettingChangeActions({ pref_uiLanguage: { oldValue: { v: 'ja', t: 1 }, newValue: { v: 'en', t: 2 } } }, 'local'))
      .toContainEqual({ type: 'reload' });
  });
});
