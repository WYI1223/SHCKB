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

// ----- format migration pipeline (synthetic v1↔v2 pair; production registry stays empty at v1) -----

import { downgradeToVersion, upgradeToVersion, type FormatTransform, type JsonFiles } from '../src/export/migrate-format';

/** Synthetic v2: renames page field title→heading and adds subtitle. */
const SYNTHETIC: FormatTransform[] = [
  {
    to: 2,
    up(files) {
      const next: JsonFiles = new Map(files);
      for (const [path, value] of files) {
        if (!path.endsWith('.page.json')) continue;
        const { title, ...rest } = value as { title: string };
        next.set(path, { heading: title, subtitle: '', ...rest });
      }
      return next;
    },
    down(files) {
      const next: JsonFiles = new Map(files);
      const losses: string[] = [];
      for (const [path, value] of files) {
        if (!path.endsWith('.page.json')) continue;
        const { heading, subtitle, ...rest } = value as { heading: string; subtitle: string };
        if (subtitle !== '') losses.push(`${path}: subtitle "${subtitle}" dropped (v1 cannot express it)`);
        next.set(path, { title: heading, ...rest });
      }
      return { files: next, losses };
    },
  },
];

function v1Files(): JsonFiles {
  return new Map<string, unknown>([
    ['manifest.json', { formatVersion: 1 }],
    ['tree/a.page.json', { title: 'A', blocks: [] }],
  ]);
}

describe('format migration pipeline', () => {
  test('upgrade applies transforms in order and stamps version', () => {
    const out = upgradeToVersion(v1Files(), 2, SYNTHETIC);
    expect((out.get('manifest.json') as { formatVersion: number }).formatVersion).toBe(2);
    expect(out.get('tree/a.page.json')).toEqual({ heading: 'A', subtitle: '', blocks: [] });
  });

  test('upgrade to current version is a no-op', () => {
    const files = v1Files();
    expect(upgradeToVersion(files, 1, SYNTHETIC)).toBe(files);
  });

  test('downgrade reverses and reports losses explicitly', () => {
    const v2 = upgradeToVersion(v1Files(), 2, SYNTHETIC);
    (v2.get('tree/a.page.json') as { subtitle: string }).subtitle = 'extra';
    const { files, losses } = downgradeToVersion(v2, 1, SYNTHETIC);
    expect((files.get('manifest.json') as { formatVersion: number }).formatVersion).toBe(1);
    expect(files.get('tree/a.page.json')).toEqual({ title: 'A', blocks: [] });
    expect(losses).toEqual(['tree/a.page.json: subtitle "extra" dropped (v1 cannot express it)']);
  });

  test('missing transform step throws', () => {
    expect(() => upgradeToVersion(v1Files(), 3, SYNTHETIC)).toThrow('no upgrade path');
    expect(() => downgradeToVersion(new Map([['manifest.json', { formatVersion: 3 }]]), 1, SYNTHETIC)).toThrow(
      'no downgrade path',
    );
  });

  test('lossless round trip: up then down restores the original', () => {
    const original = v1Files();
    const { files, losses } = downgradeToVersion(upgradeToVersion(original, 2, SYNTHETIC), 1, SYNTHETIC);
    expect(losses).toEqual([]);
    expect(files.get('tree/a.page.json')).toEqual(original.get('tree/a.page.json'));
  });
});
