/**
 * Content-addressed local-fs blob store (mvp2 M2-D3; storage-provider
 * seam — S3 etc. would implement this same surface later).
 *
 * Invariants: blob id = sha256(content); files are write-once (new
 * content = new id), which is what lets published snapshots reference
 * blobs safely forever. No GC in MVP-2.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const HASH_RE = /^[a-f0-9]{64}$/;

export class BlobStore {
  constructor(private dir: string) {
    mkdirSync(dir, { recursive: true });
  }

  /** Persist bytes; returns the content hash. Idempotent per content. */
  save(bytes: Uint8Array): { hash: string; size: number } {
    const hash = createHash('sha256').update(bytes).digest('hex');
    const finalPath = join(this.dir, hash);
    if (!existsSync(finalPath)) {
      // temp + rename: never expose a half-written blob under its hash
      const tmp = join(this.dir, `.tmp-${hash}-${process.pid}`);
      writeFileSync(tmp, bytes);
      renameSync(tmp, finalPath);
    }
    return { hash, size: bytes.byteLength };
  }

  /** Absolute path for a stored blob, or null for invalid/missing ids. */
  path(hash: string): string | null {
    if (!HASH_RE.test(hash)) return null;
    const p = join(this.dir, hash);
    return existsSync(p) ? p : null;
  }
}
