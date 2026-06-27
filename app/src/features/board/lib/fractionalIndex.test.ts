import { describe, expect, it } from 'vitest';
import { generateKeys, keyBetween } from './fractionalIndex';

describe('fractionalIndex', () => {
  it('produces a key strictly between its bounds', () => {
    const mid = keyBetween(null, null);
    expect(keyBetween(null, mid) < mid).toBe(true);
    expect(mid < keyBetween(mid, null)).toBe(true);
  });

  it('generates ascending keys', () => {
    const keys = generateKeys(10);
    expect([...keys].sort()).toEqual(keys);
    expect(new Set(keys).size).toBe(10);
  });

  it('keeps global order across 500 random insertions', () => {
    const list: string[] = generateKeys(5);
    for (let i = 0; i < 500; i += 1) {
      const pos = Math.floor(Math.random() * (list.length + 1));
      const prev = pos > 0 ? list[pos - 1] : null;
      const next = pos < list.length ? list[pos] : null;
      const key = keyBetween(prev, next);
      expect(prev === null || prev < key).toBe(true);
      expect(next === null || key < next).toBe(true);
      list.splice(pos, 0, key);
      expect([...list].sort()).toEqual(list);
    }
    expect(list).toHaveLength(505);
  });
});
