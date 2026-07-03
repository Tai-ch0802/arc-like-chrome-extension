import { resolveSettingChangeActions } from '../../modules/ui/settingsBridge.js';

describe('resolveSettingChangeActions', () => {
  it('sync theme → applyTheme action', () => {
    expect(resolveSettingChangeActions({ theme: { newValue: 'google' } }, 'sync'))
      .toContainEqual({ type: 'applyTheme', value: 'google' });
  });
  it('sync readingListVisible → dispatch event action', () => {
    expect(resolveSettingChangeActions({ readingListVisible: { newValue: false } }, 'sync'))
      .toContainEqual({ type: 'dispatch', event: 'readingListVisibilityChanged', detail: { visible: false } });
  });
  it('sync uiLanguage → reload action', () => {
    expect(resolveSettingChangeActions({ uiLanguage: { newValue: 'ja' } }, 'sync'))
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
    expect(resolveSettingChangeActions({ aiCleanupVisible: { newValue: true } }, 'sync'))
      .toContainEqual({ type: 'dispatch', event: 'aiCleanupVisibilityChanged', detail: { visible: true } });
    expect(resolveSettingChangeActions({ aiGroupingVisible: { newValue: true } }, 'sync'))
      .toContainEqual({ type: 'dispatch', event: 'aiGroupingVisibilityChanged', detail: { visible: true } });
  });
  it('sync readingListVisible → ALSO refreshState action (plus dispatch)', () => {
    const actions = resolveSettingChangeActions({ readingListVisible: { newValue: false } }, 'sync');
    expect(actions).toContainEqual({ type: 'dispatch', event: 'readingListVisibilityChanged', detail: { visible: false } });
    expect(actions).toContainEqual({ type: 'refreshState', key: 'readingListVisible' });
  });
  it('sync aiGroupingVisible / aiCleanupVisible → ALSO refreshState actions', () => {
    expect(resolveSettingChangeActions({ aiGroupingVisible: { newValue: true } }, 'sync'))
      .toContainEqual({ type: 'refreshState', key: 'aiGroupingVisible' });
    expect(resolveSettingChangeActions({ aiCleanupVisible: { newValue: true } }, 'sync'))
      .toContainEqual({ type: 'refreshState', key: 'aiCleanupVisible' });
  });
  it('sync aiAutoNamingEnabled → refreshState action (no dispatch)', () => {
    const actions = resolveSettingChangeActions({ aiAutoNamingEnabled: { newValue: true } }, 'sync');
    expect(actions).toContainEqual({ type: 'refreshState', key: 'aiAutoNamingEnabled' });
    expect(actions.some(a => a.type === 'dispatch')).toBe(false);
  });
  it('sync hoverSummarizeEnabled → refreshState action', () => {
    expect(resolveSettingChangeActions({ hoverSummarizeEnabled: { newValue: false } }, 'sync'))
      .toContainEqual({ type: 'refreshState', key: 'hoverSummarizeEnabled' });
  });
  it('sync readingListSummaryEnabled → refreshState action', () => {
    expect(resolveSettingChangeActions({ readingListSummaryEnabled: { newValue: false } }, 'sync'))
      .toContainEqual({ type: 'refreshState', key: 'readingListSummaryEnabled' });
  });
  it('local aiProviderAuthError → dispatch aiProviderAuthErrorChanged action', () => {
    const detail = { providerId: 'anthropic', status: 401, at: 123 };
    expect(resolveSettingChangeActions({ aiProviderAuthError: { newValue: detail } }, 'local'))
      .toContainEqual({ type: 'dispatch', event: 'aiProviderAuthErrorChanged', detail });
  });
  it('sync pageReaderVisible → dispatch event AND refreshState actions', () => {
    const actions = resolveSettingChangeActions({ pageReaderVisible: { newValue: false } }, 'sync');
    expect(actions).toContainEqual({ type: 'dispatch', event: 'pageReaderVisibilityChanged', detail: { visible: false } });
    expect(actions).toContainEqual({ type: 'refreshState', key: 'pageReaderVisible' });
  });
});
