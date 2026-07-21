import { computeBackoffMs, MAX_BACKOFF_MS } from '../../modules/newswire/adapters.js';

describe('newswire adapters — computeBackoffMs (BASE-016 N1)', () => {
  it('grows exponentially with jitter', () => {
    expect(computeBackoffMs(1, 0)).toBe(2000);
    expect(computeBackoffMs(3, 0)).toBe(8000);
    expect(computeBackoffMs(3, 0.5)).toBe(8500);
  });
  it('caps at 60s (+jitter) for large attempts', () => {
    expect(computeBackoffMs(10, 0)).toBe(MAX_BACKOFF_MS);
    expect(computeBackoffMs(50, 0)).toBe(MAX_BACKOFF_MS);
    expect(computeBackoffMs(50, 0.999)).toBeLessThan(MAX_BACKOFF_MS + 1000);
  });
  it('treats attempt < 1 as 1 (no zero/negative exponent underflow)', () => {
    expect(computeBackoffMs(0, 0)).toBe(2000);
    expect(computeBackoffMs(-5, 0)).toBe(2000);
  });
});
