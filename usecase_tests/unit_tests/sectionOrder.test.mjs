import { mergeSectionOrder, DEFAULT_SECTION_ORDER } from '../../modules/utils/sectionOrder.js';

describe('mergeSectionOrder (BASE-015)', () => {
  it('empty stored → actual order as-is', () => {
    expect(mergeSectionOrder([], DEFAULT_SECTION_ORDER)).toEqual(DEFAULT_SECTION_ORDER);
  });

  it('non-array stored (undefined/null/corrupt) → actual order as-is', () => {
    expect(mergeSectionOrder(undefined, DEFAULT_SECTION_ORDER)).toEqual(DEFAULT_SECTION_ORDER);
    expect(mergeSectionOrder(null, DEFAULT_SECTION_ORDER)).toEqual(DEFAULT_SECTION_ORDER);
    expect(mergeSectionOrder('bookmarks', DEFAULT_SECTION_ORDER)).toEqual(DEFAULT_SECTION_ORDER);
  });

  it('orders by stored preference', () => {
    expect(mergeSectionOrder(
      ['bookmarks', 'readingList', 'tabs', 'otherWindows'],
      DEFAULT_SECTION_ORDER
    )).toEqual(['bookmarks', 'readingList', 'tabs', 'otherWindows']);
  });

  it('partial stored → missing actual ids appended in actual order', () => {
    expect(mergeSectionOrder(['bookmarks', 'tabs'], DEFAULT_SECTION_ORDER))
      .toEqual(['bookmarks', 'tabs', 'otherWindows', 'readingList']);
  });

  it('drops stored ids not present in actual (section from another device / future version)', () => {
    expect(mergeSectionOrder(
      ['newswire', 'bookmarks', 'tabs', 'otherWindows', 'readingList'],
      DEFAULT_SECTION_ORDER
    )).toEqual(['bookmarks', 'tabs', 'otherWindows', 'readingList']);
  });

  it('ignores duplicate ids in stored', () => {
    expect(mergeSectionOrder(['bookmarks', 'bookmarks', 'tabs'], DEFAULT_SECTION_ORDER))
      .toEqual(['bookmarks', 'tabs', 'otherWindows', 'readingList']);
  });

  it('does not mutate its inputs', () => {
    const stored = ['bookmarks', 'ghost'];
    const actual = [...DEFAULT_SECTION_ORDER];
    mergeSectionOrder(stored, actual);
    expect(stored).toEqual(['bookmarks', 'ghost']);
    expect(actual).toEqual(DEFAULT_SECTION_ORDER);
  });

  it('result is always a permutation of actual', () => {
    const result = mergeSectionOrder(['ghost', 'readingList'], DEFAULT_SECTION_ORDER);
    expect([...result].sort()).toEqual([...DEFAULT_SECTION_ORDER].sort());
  });
});
