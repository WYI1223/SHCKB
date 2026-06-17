/**
 * Export-format migration pipeline [ADR-0023]. Mirrors ADR-0020's
 * shape (ordered versioned steps, applied sequentially) but is pure
 * JSON→JSON and stateless — the version lives in manifest.formatVersion.
 *
 * Discipline (owner-ratified 2026-06-12): every format change MUST
 * register exactly one up/down pair; down() MUST list every piece of
 * data it drops (no silent loss). Downgrade runs on the EXPORT side —
 * an old build cannot know a newer format.
 */
export type JsonFiles = Map<string, unknown>; // path → parsed JSON (manifest included; blobs untouched)

export type FormatTransform = {
  /** up() takes files at version `to - 1`, returns files at `to`. */
  to: number;
  up(files: JsonFiles): JsonFiles;
  /** Reverses up(); losses lists every dropped piece of data. */
  down(files: JsonFiles): { files: JsonFiles; losses: string[] };
};

import { DEFAULT_THEME_ID } from '@skb/theme';

/** Production registry. Every format change ships exactly one up/down
 * pair [ADR-0023]; the v2 pair below is the first real one (MVP-4
 * theme data [ADR-0024]). */
export const FORMAT_TRANSFORMS: FormatTransform[] = [
  {
    // v2: instance theme setting + per-page theme pin
    to: 2,
    up(files) {
      const next: JsonFiles = new Map();
      for (const [path, value] of files) {
        if (path === 'manifest.json') {
          const m = value as Record<string, unknown>;
          next.set(path, { ...m, settings: { theme: DEFAULT_THEME_ID } });
        } else if (path.endsWith('.page.json')) {
          // reconstruct key order explicitly so v1→v2→export stays canonical
          const { id, slug, title, visibility, gravityEnabled, ...rest } = value as Record<string, unknown>;
          next.set(path, { id, slug, title, visibility, gravityEnabled, themeId: null, ...rest });
        } else {
          next.set(path, value);
        }
      }
      return next;
    },
    down(files) {
      const next: JsonFiles = new Map();
      const losses: string[] = [];
      for (const [path, value] of files) {
        if (path === 'manifest.json') {
          const { settings, ...m } = value as Record<string, unknown> & { settings?: { theme?: string } };
          if (settings?.theme !== undefined && settings.theme !== DEFAULT_THEME_ID) {
            losses.push(`manifest.json: instance theme "${settings.theme}" dropped (v1 has no settings)`);
          }
          next.set(path, m);
        } else if (path.endsWith('.page.json')) {
          const { themeId, ...rest } = value as Record<string, unknown> & { themeId?: string | null };
          if (themeId != null) losses.push(`${path}: themeId "${themeId}" dropped (v1 has no per-page theme)`);
          next.set(path, rest);
        } else {
          next.set(path, value);
        }
      }
      return { files: next, losses };
    },
  },
  {
    // v3: operator theme customization in manifest.settings (MVP-5 M5-D3)
    to: 3,
    up(files) {
      // v2 bundles simply have no customization — absence IS the v3
      // encoding for "none"; nothing to add, nothing to reorder.
      return new Map(files);
    },
    down(files) {
      const next: JsonFiles = new Map();
      const losses: string[] = [];
      for (const [path, value] of files) {
        if (path === 'manifest.json') {
          const m = value as Record<string, unknown> & {
            settings?: { theme?: string; themeCustomization?: Record<string, unknown> };
          };
          if (m.settings?.themeCustomization !== undefined) {
            for (const themeId of Object.keys(m.settings.themeCustomization)) {
              losses.push(
                `manifest.json: theme customization for "${themeId}" dropped (v2 has no themeCustomization)`,
              );
            }
            const { themeCustomization: _dropped, ...settings } = m.settings;
            next.set(path, { ...m, settings });
          } else {
            next.set(path, m);
          }
        } else {
          next.set(path, value);
        }
      }
      return { files: next, losses };
    },
  },
  {
    // v4: author appearance — page background + per-block shell (MVP-6)
    to: 4,
    up(files) {
      const next: JsonFiles = new Map();
      for (const [path, value] of files) {
        if (path.endsWith('.page.json')) {
          // explicit key order so v3→v4→export stays canonical
          const { id, slug, title, visibility, gravityEnabled, themeId, sortKey, createdAt, updatedAt, published, blocks, ...rest } =
            value as Record<string, unknown> & { blocks: Array<Record<string, unknown>> };
          next.set(path, {
            id, slug, title, visibility, gravityEnabled, themeId,
            background: null,
            sortKey, createdAt, updatedAt, published,
            blocks: blocks.map(({ id: bid, kind, col, row, colSpan, rowSpan, content, ...brest }) => ({
              id: bid, kind, col, row, colSpan, rowSpan, shell: null, content, ...brest,
            })),
            ...rest,
          });
        } else {
          next.set(path, value);
        }
      }
      return next;
    },
    down(files) {
      const next: JsonFiles = new Map();
      const losses: string[] = [];
      const stripDocAppearance = (doc: Record<string, unknown> | null, path: string): unknown => {
        if (doc === null || typeof doc !== 'object') return doc;
        const { background, blocks, ...rest } = doc as { background?: unknown; blocks?: Array<Record<string, unknown>> };
        if (background != null) losses.push(`${path}: published background dropped (v3 has no page background)`);
        const cleanBlocks = (blocks ?? []).map(({ shell, ...b }) => {
          if (shell != null) losses.push(`${path}: published block "${String(b.id)}" shell "${String(shell)}" dropped`);
          return b;
        });
        return { ...rest, blocks: cleanBlocks };
      };
      for (const [path, value] of files) {
        if (path.endsWith('.page.json')) {
          const { background, published, blocks, ...rest } = value as Record<string, unknown> & {
            background?: unknown;
            published: Record<string, unknown> | null;
            blocks: Array<Record<string, unknown>>;
          };
          if (background != null) losses.push(`${path}: page background dropped (v3 has no page background)`);
          const cleanBlocks = blocks.map(({ shell, ...b }) => {
            if (shell != null) losses.push(`${path}: block "${String(b.id)}" shell "${String(shell)}" dropped`);
            return b;
          });
          next.set(path, { ...rest, published: stripDocAppearance(published, path), blocks: cleanBlocks });
        } else {
          next.set(path, value);
        }
      }
      return { files: next, losses };
    },
  },
  {
    // v5: block-level autofit metadata — autofit mode + author floor
    // (block-autofit-height). Block-level (web/server owned), not kind
    // content. up() defaults BOTH to null (= off/legacy); the floor
    // default is the ENGINE MINIMUM (null→treated as 1), never the
    // current rowSpan, so a v6→v5→v6 (or v5→v4→v5) round trip can never
    // raise the floor to a content-grown height.
    to: 5,
    up(files) {
      const addAutofit = (b: Record<string, unknown>): Record<string, unknown> => {
        // explicit key order: …, shell, autofit, minRowSpan, content, …
        const { shell, content, ...brest } = b as { shell?: unknown; content?: unknown };
        return { ...brest, shell, autofit: null, minRowSpan: null, content };
      };
      const next: JsonFiles = new Map();
      for (const [path, value] of files) {
        if (path.endsWith('.page.json')) {
          const { blocks, published, ...rest } = value as Record<string, unknown> & {
            blocks: Array<Record<string, unknown>>;
            published?: Record<string, unknown> | null;
          };
          const upPublished =
            published == null || typeof published !== 'object'
              ? published
              : {
                  ...published,
                  blocks: ((published.blocks as Array<Record<string, unknown>>) ?? []).map(addAutofit),
                };
          next.set(path, { ...rest, published: upPublished, blocks: blocks.map(addAutofit) });
        } else {
          next.set(path, value);
        }
      }
      return next;
    },
    down(files) {
      const next: JsonFiles = new Map();
      const losses: string[] = [];
      const dropAutofit = (
        b: Record<string, unknown>,
        path: string,
        where: string,
      ): Record<string, unknown> => {
        const { autofit, minRowSpan, ...brest } = b as Record<string, unknown> & { autofit?: unknown; minRowSpan?: unknown };
        if (autofit != null && autofit !== 'off') {
          losses.push(`${path}: ${where}block "${String(brest.id)}" autofit "${String(autofit)}" dropped (v4 has no autofit)`);
        }
        if (minRowSpan != null) {
          // BEHAVIORAL loss, not cosmetic: dropping the floor changes how
          // the block behaves on re-import — its minimum height resets and
          // it can no longer shrink below the current rendered content.
          losses.push(
            `${path}: ${where}block "${String(brest.id)}" min height resets, can no longer shrink below current (v4 has no minRowSpan)`,
          );
        }
        return brest;
      };
      for (const [path, value] of files) {
        if (path.endsWith('.page.json')) {
          const { blocks, published, ...rest } = value as Record<string, unknown> & {
            blocks: Array<Record<string, unknown>>;
            published?: Record<string, unknown> | null;
          };
          const downPublished =
            published == null || typeof published !== 'object'
              ? published
              : {
                  ...published,
                  blocks: ((published.blocks as Array<Record<string, unknown>>) ?? []).map((b) =>
                    dropAutofit(b, path, 'published '),
                  ),
                };
          next.set(path, { ...rest, published: downPublished, blocks: blocks.map((b) => dropAutofit(b, path, '')) });
        } else {
          next.set(path, value);
        }
      }
      return { files: next, losses };
    },
  },
  {
    // v6: autofit enum → follow/fix two-mode (follow/fix redesign); the floor
    // (minRowSpan) is deleted entirely. up() maps the old enum to a mode and
    // drops the floor; down() is LOSSY — it collapses follow/fix back to the
    // enum and re-introduces a null floor. Touches working AND published blocks.
    to: 6,
    up(files) {
      // 'grow'/'grow+shrink' carried "height tracks content" → follow;
      // everything else (null, 'off', garbage) → the fixed-height fallback.
      const toMode = (af: unknown): 'follow' | 'fix' =>
        af === 'grow' || af === 'grow+shrink' ? 'follow' : 'fix';
      const up6Block = (b: Record<string, unknown>): Record<string, unknown> => {
        const { minRowSpan: _minRowSpan, ...rest } = b as Record<string, unknown> & { minRowSpan?: unknown };
        return { ...rest, autofit: toMode(b.autofit) };
      };
      const next: JsonFiles = new Map();
      for (const [path, value] of files) {
        if (path.endsWith('.page.json')) {
          const { blocks, published, ...rest } = value as Record<string, unknown> & {
            blocks: Array<Record<string, unknown>>;
            published?: Record<string, unknown> | null;
          };
          const upPublished =
            published == null || typeof published !== 'object'
              ? published
              : {
                  ...published,
                  blocks: ((published.blocks as Array<Record<string, unknown>>) ?? []).map(up6Block),
                };
          next.set(path, { ...rest, published: upPublished, blocks: blocks.map(up6Block) });
        } else {
          next.set(path, value);
        }
      }
      return next;
    },
    down(files) {
      const next: JsonFiles = new Map();
      const losses: string[] = [];
      const down6Block = (
        b: Record<string, unknown>,
        path: string,
        where: string,
      ): Record<string, unknown> => {
        const mode = b.autofit;
        // follow→grow keeps the "grows with content" behavior; fix→off is a
        // BEHAVIORAL collapse (v5 has no fixed-height mode), and the floor
        // comes back as null (the follow/fix model deleted it). A v5
        // 'grow+shrink' folded into 'follow' on the way up and returns as
        // 'grow' here with no loss line — 'grow+shrink' was vestigial (never
        // wired to behavior; spec/ADR-0030), so no behavior is lost.
        if (mode === 'fix') {
          losses.push(
            `${path}: ${where}block "${String(b.id)}" autofit 'fix'→'off' and floor reset (follow/fix collapsed for v5)`,
          );
        }
        return { ...b, autofit: mode === 'follow' ? 'grow' : 'off', minRowSpan: null };
      };
      for (const [path, value] of files) {
        if (path.endsWith('.page.json')) {
          const { blocks, published, ...rest } = value as Record<string, unknown> & {
            blocks: Array<Record<string, unknown>>;
            published?: Record<string, unknown> | null;
          };
          const downPublished =
            published == null || typeof published !== 'object'
              ? published
              : {
                  ...published,
                  blocks: ((published.blocks as Array<Record<string, unknown>>) ?? []).map((b) =>
                    down6Block(b, path, 'published '),
                  ),
                };
          next.set(path, { ...rest, published: downPublished, blocks: blocks.map((b) => down6Block(b, path, '')) });
        } else {
          next.set(path, value);
        }
      }
      return { files: next, losses };
    },
  },
];

function versionOf(files: JsonFiles): number {
  const manifest = files.get('manifest.json') as { formatVersion?: unknown } | undefined;
  if (manifest === undefined || typeof manifest.formatVersion !== 'number') {
    throw new Error('manifest.json missing or has no numeric formatVersion');
  }
  return manifest.formatVersion;
}

function withVersion(files: JsonFiles, v: number): JsonFiles {
  const next = new Map(files);
  next.set('manifest.json', { ...(files.get('manifest.json') as object), formatVersion: v });
  return next;
}

export function upgradeToVersion(files: JsonFiles, target: number, transforms = FORMAT_TRANSFORMS): JsonFiles {
  let v = versionOf(files);
  if (v === target) return files;
  let cur = files;
  while (v < target) {
    const t = transforms.find((x) => x.to === v + 1);
    if (!t) throw new Error(`no upgrade path from format v${v} to v${v + 1}`);
    cur = withVersion(t.up(cur), v + 1);
    v++;
  }
  return cur;
}

export function downgradeToVersion(
  files: JsonFiles,
  target: number,
  transforms = FORMAT_TRANSFORMS,
): { files: JsonFiles; losses: string[] } {
  let v = versionOf(files);
  let cur = files;
  const losses: string[] = [];
  while (v > target) {
    const t = transforms.find((x) => x.to === v);
    if (!t) throw new Error(`no downgrade path from format v${v} to v${v - 1}`);
    const r = t.down(cur);
    losses.push(...r.losses);
    cur = withVersion(r.files, v - 1);
    v--;
  }
  return { files: cur, losses };
}
