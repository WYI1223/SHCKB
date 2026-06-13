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
  test('FORMAT_VERSION is 5', () => {
    expect(FORMAT_VERSION).toBe(5);
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

// ----- production registry (T1/T5, mvp7 review): real v2/v3/v4 pairs -----

function productionV1Files(): JsonFiles {
  return new Map<string, unknown>([
    ['manifest.json', { formatVersion: 1, blobs: [] }],
    [
      'tree/a.page.json',
      {
        id: 'p1', slug: 'a', title: 'A', visibility: 'public', gravityEnabled: true,
        sortKey: 0, createdAt: 1, updatedAt: 2,
        published: { title: 'A', gravityEnabled: true, blocks: [{ id: 'b1', kind: 'markdown', col: 0, row: 0, colSpan: 12, rowSpan: 1, content: {} }], publishedAt: 3 },
        blocks: [{ id: 'b1', kind: 'markdown', col: 0, row: 0, colSpan: 12, rowSpan: 1, content: {} }],
      },
    ],
  ]);
}

// ----- v5: block autofit + minRowSpan (block-autofit-height) -----

/** A v4 bundle whose single block has rowSpan 4 — i.e. content has
 * already grown the block past any author floor. Used to prove the
 * down→up floor-reset rule. */
function productionV4Files(): JsonFiles {
  return upgradeToVersion(
    new Map<string, unknown>([
      ['manifest.json', { formatVersion: 1, blobs: [] }],
      [
        'tree/a.page.json',
        {
          id: 'p1', slug: 'a', title: 'A', visibility: 'public', gravityEnabled: true,
          sortKey: 0, createdAt: 1, updatedAt: 2,
          published: {
            title: 'A', gravityEnabled: true,
            blocks: [{ id: 'b1', kind: 'markdown', col: 0, row: 0, colSpan: 12, rowSpan: 4, content: {} }],
            publishedAt: 3,
          },
          blocks: [{ id: 'b1', kind: 'markdown', col: 0, row: 0, colSpan: 12, rowSpan: 4, content: {} }],
        },
      ],
    ]),
    4,
  );
}

describe('production format registry v5 (block autofit)', () => {
  test('v4→v5 adds autofit=null + minRowSpan=null to working AND published blocks', () => {
    const up = upgradeToVersion(productionV4Files(), 5);
    const page = up.get('tree/a.page.json') as {
      blocks: Array<{ autofit: unknown; minRowSpan: unknown; rowSpan: number }>;
      published: { blocks: Array<{ autofit: unknown; minRowSpan: unknown }> };
    };
    expect(page.blocks[0]!.autofit).toBeNull();
    expect(page.blocks[0]!.minRowSpan).toBeNull(); // floor = engine minimum, NOT rowSpan(4)
    expect(page.published.blocks[0]!.autofit).toBeNull();
    expect(page.published.blocks[0]!.minRowSpan).toBeNull();
  });

  test('v4→v5→v4 round trip is lossless when autofit is off (null)', () => {
    const v4 = productionV4Files();
    const up = upgradeToVersion(v4, 5);
    const { files, losses } = downgradeToVersion(up, 4);
    expect(losses).toEqual([]); // null autofit / null floor are not behavioral losses
    expect(files.get('tree/a.page.json')).toEqual(v4.get('tree/a.page.json'));
  });

  test('v5→v4 drops autofit + emits BEHAVIORAL minRowSpan loss when floor is set', () => {
    const up = upgradeToVersion(productionV4Files(), 5);
    const page = up.get('tree/a.page.json') as {
      blocks: Array<{ autofit: unknown; minRowSpan: unknown }>;
      published: { blocks: Array<{ autofit: unknown; minRowSpan: unknown }> };
    };
    page.blocks[0]!.autofit = 'grow';
    page.blocks[0]!.minRowSpan = 2;
    page.published.blocks[0]!.autofit = 'grow';
    page.published.blocks[0]!.minRowSpan = 2;

    const { files, losses } = downgradeToVersion(up, 4);
    expect((files.get('manifest.json') as { formatVersion: number }).formatVersion).toBe(4);
    // behavioral loss wording for the floor, on both working + published block
    expect(losses.filter((l) => l.includes('min height resets, can no longer shrink below current')).length).toBe(2);
    expect(losses.filter((l) => l.includes('autofit "grow" dropped')).length).toBe(2);
    // the v4 block carries neither axis
    const v4page = files.get('tree/a.page.json') as { blocks: Array<Record<string, unknown>> };
    expect('autofit' in v4page.blocks[0]!).toBe(false);
    expect('minRowSpan' in v4page.blocks[0]!).toBe(false);
  });

  test('v5→v4→v5 does NOT raise the floor (the load-bearing assertion)', () => {
    // start at v5 with a SET floor of 1 on a block already grown to rowSpan 4
    const up = upgradeToVersion(productionV4Files(), 5);
    const page0 = up.get('tree/a.page.json') as { blocks: Array<{ minRowSpan: unknown }> };
    page0.blocks[0]!.minRowSpan = 1; // author floor = 1, well below content-grown rowSpan 4

    // round-trip through v4 (which cannot express the floor) and back to v5
    const { files: v4 } = downgradeToVersion(up, 4);
    const reUp = upgradeToVersion(v4, 5);
    const page1 = reUp.get('tree/a.page.json') as {
      blocks: Array<{ minRowSpan: unknown; rowSpan: number }>;
    };
    // floor came back as the engine minimum (null), NOT raised to the
    // current rowSpan (4). Raising it would permanently destroy the
    // author's "floor below current content" intent.
    expect(page1.blocks[0]!.minRowSpan).toBeNull();
    expect(page1.blocks[0]!.minRowSpan).not.toBe(4);
    expect(page1.blocks[0]!.rowSpan).toBe(4); // rowSpan itself is preserved across the trip
  });
});

describe('production format registry v1→v4', () => {
  test('full upgrade chain fills every version’s additions with neutral values', () => {
    const out = upgradeToVersion(productionV1Files(), 4);
    const manifest = out.get('manifest.json') as { formatVersion: number; settings: { theme: string } };
    expect(manifest.formatVersion).toBe(4);
    expect(typeof manifest.settings.theme).toBe('string'); // v2: instance theme appears
    const page = out.get('tree/a.page.json') as {
      themeId: unknown; background: unknown; blocks: Array<{ shell: unknown }>;
    };
    expect(page.themeId).toBeNull(); // v2: pin appears as "follow instance"
    expect(page.background).toBeNull(); // v4: background appears empty
    expect(page.blocks[0]!.shell).toBeNull(); // v4: shell appears as default
  });

  test('v1→v4→v1 round trip is lossless and restores the original page', () => {
    const original = productionV1Files();
    const up = upgradeToVersion(productionV1Files(), 4);
    const { files, losses } = downgradeToVersion(up, 1);
    expect(losses).toEqual([]);
    expect(files.get('tree/a.page.json')).toEqual(original.get('tree/a.page.json'));
  });

  test('downgrade v4→1 with real appearance/customization data reports every loss', () => {
    const up = upgradeToVersion(productionV1Files(), 4);
    const manifest = up.get('manifest.json') as { settings: Record<string, unknown> };
    manifest.settings.theme = 'stationery';
    manifest.settings.themeCustomization = { stationery: { paletteId: 'kraft' } };
    const page = up.get('tree/a.page.json') as {
      themeId: string | null; background: unknown;
      published: { background?: unknown; blocks: Array<{ shell?: unknown }> };
      blocks: Array<{ shell?: unknown }>;
    };
    page.themeId = 'workbench';
    page.background = { color: 'red' };
    page.blocks[0]!.shell = 'card';
    page.published.background = { color: 'red' };
    page.published.blocks[0]!.shell = 'card';

    const { files, losses } = downgradeToVersion(up, 1);
    expect((files.get('manifest.json') as { formatVersion: number }).formatVersion).toBe(1);
    // every axis that v1 cannot express shows up as an explicit loss line
    expect(losses.some((l) => l.includes('instance theme "stationery"'))).toBe(true);
    expect(losses.some((l) => l.includes('theme customization for "stationery"'))).toBe(true);
    expect(losses.some((l) => l.includes('themeId "workbench"'))).toBe(true);
    expect(losses.some((l) => l.includes('page background dropped'))).toBe(true);
    expect(losses.some((l) => l.includes('published background dropped'))).toBe(true);
    expect(losses.filter((l) => l.includes('shell "card" dropped')).length).toBe(2); // working + published block
    // the v1 page carries none of the dropped axes
    const v1page = files.get('tree/a.page.json') as Record<string, unknown> & { blocks: Array<Record<string, unknown>> };
    expect('themeId' in v1page).toBe(false);
    expect('background' in v1page).toBe(false);
    expect('shell' in v1page.blocks[0]!).toBe(false);
  });
});
