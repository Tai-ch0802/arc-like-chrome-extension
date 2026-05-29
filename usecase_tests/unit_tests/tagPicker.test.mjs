import { diffTagSelection } from '../../modules/bookmark/tagPicker.js';

describe('diffTagSelection', () => {
  it('算出要新增與要移除的標籤', () => {
    const { toAdd, toRemove } = diffTagSelection(['t1', 't2'], ['t2', 't3']);
    expect(toAdd).toEqual(['t3']);
    expect(toRemove).toEqual(['t1']);
  });

  it('無變更時兩者皆空', () => {
    const { toAdd, toRemove } = diffTagSelection(['t1'], ['t1']);
    expect(toAdd).toEqual([]);
    expect(toRemove).toEqual([]);
  });

  it('原本為空時全部都是新增', () => {
    expect(diffTagSelection([], ['a', 'b'])).toEqual({ toAdd: ['a', 'b'], toRemove: [] });
  });
});
