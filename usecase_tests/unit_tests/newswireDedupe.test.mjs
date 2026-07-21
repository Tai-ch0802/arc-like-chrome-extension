import { createDedupeSet } from '../../modules/newswire/dedupe.js';

describe('newswire dedupe (BASE-016 N1)', () => {
  it('detects duplicates after add', () => {
    const d = createDedupeSet();
    expect(d.has('tree:1')).toBe(false);
    d.add('tree:1');
    expect(d.has('tree:1')).toBe(true);
    expect(d.size).toBe(1);
  });
  it('seeds from existing ids (buffer restore / history replay)', () => {
    const d = createDedupeSet(['tree:a', 'tree:b']);
    expect(d.has('tree:a')).toBe(true);
    expect(d.has('tree:b')).toBe(true);
  });
  it('evicts oldest beyond cap (FIFO)', () => {
    const d = createDedupeSet([], 3);
    ['1', '2', '3', '4'].forEach((id) => d.add(id));
    expect(d.has('1')).toBe(false);
    expect(d.has('4')).toBe(true);
    expect(d.size).toBe(3);
  });
  it('re-adding an existing id does not evict or grow', () => {
    const d = createDedupeSet(['1', '2'], 2);
    d.add('1');
    expect(d.has('2')).toBe(true);
    expect(d.size).toBe(2);
  });
});
