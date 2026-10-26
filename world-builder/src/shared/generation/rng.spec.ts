import { mulberry32 } from './rng';

describe('mulberry32', () => {
  it('returns the same sequence for the same seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      expect(a()).toBe(b());
    }
  });

  it('returns different sequences for different seeds', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    const same = Array.from({ length: 20 }, () => a() === b()).every(Boolean);
    expect(same).toBeFalse();
  });

  it('stays within [0, 1)', () => {
    const random = mulberry32(7);
    for (let i = 0; i < 10000; i++) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
