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

/** Production registry — empty while only format v1 exists. */
export const FORMAT_TRANSFORMS: FormatTransform[] = [];

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
