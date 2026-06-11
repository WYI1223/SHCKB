import { describe, expect, test } from 'bun:test';
import { collectHashLikeStrings } from '../src/export/blob-refs';

const H1 = 'a'.repeat(64);
const H2 = 'b1c2'.repeat(16);

describe('collectHashLikeStrings', () => {
  test('finds 64-hex strings at any JSON depth', () => {
    const value = { blobHash: H1, nested: [{ x: H2 }, 'not-a-hash', 42], t: null };
    expect([...collectHashLikeStrings(value)].sort()).toEqual([H1, H2].sort());
  });

  test('ignores wrong length, uppercase, non-hex', () => {
    const value = ['A'.repeat(64), 'f'.repeat(63), 'g'.repeat(64), H1.slice(0, 32)];
    expect(collectHashLikeStrings(value).size).toBe(0);
  });
});
