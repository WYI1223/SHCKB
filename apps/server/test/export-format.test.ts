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

// ----- canonical format helpers -----

import { canonicalJson, sanitizeDirName, FORMAT_VERSION } from '../src/export/format';

describe('canonical format helpers', () => {
  test('FORMAT_VERSION is 1', () => {
    expect(FORMAT_VERSION).toBe(1);
  });

  test('canonicalJson: 2-space pretty print, trailing LF, no CR', () => {
    const text = canonicalJson({ a: 1, b: [1, 2] });
    expect(text.endsWith('\n')).toBe(true);
    expect(text.includes('\r')).toBe(false);
    expect(text).toBe('{\n  "a": 1,\n  "b": [\n    1,\n    2\n  ]\n}\n');
  });

  test('sanitizeDirName strips path-hostile characters', () => {
    expect(sanitizeDirName('a/b\\c:d')).toBe('a_b_c_d');
    expect(sanitizeDirName('  trailing.dots... ')).toBe('trailing.dots');
    expect(sanitizeDirName('con?*<>|"')).toBe('con______');
    expect(sanitizeDirName('///')).toBe('___');
    expect(sanitizeDirName('   ')).toBe('_');
    expect(sanitizeDirName('方法论')).toBe('方法论');
  });
});
