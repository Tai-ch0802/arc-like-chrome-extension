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
  it('unrelated key → no actions', () => {
    expect(resolveSettingChangeActions({ someOtherKey: { newValue: 1 } }, 'sync')).toEqual([]);
  });
  it('aiCleanupVisible / aiGroupingVisible → dispatch their events', () => {
    expect(resolveSettingChangeActions({ aiCleanupVisible: { newValue: true } }, 'sync'))
      .toContainEqual({ type: 'dispatch', event: 'aiCleanupVisibilityChanged', detail: { visible: true } });
    expect(resolveSettingChangeActions({ aiGroupingVisible: { newValue: true } }, 'sync'))
      .toContainEqual({ type: 'dispatch', event: 'aiGroupingVisibilityChanged', detail: { visible: true } });
  });
});
