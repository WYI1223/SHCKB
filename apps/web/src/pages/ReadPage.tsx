/**
 * Public read route (notepage-view.md M2 slice): renders the published
 * snapshot only — never working state — with no author affordances.
 * 404 is identical for missing/private/unpublished (no-leak).
 */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { blockModule } from '../blocks/registry';
import { api, ApiError, type PublishedDoc } from '../api/client';
import { theme } from '../theme/tokens';

const SLOT = theme.slot;
const PAD = theme.pad;

export function ReadPage() {
  const { slug } = useParams<{ slug: string }>();
  const [doc, setDoc] = useState<PublishedDoc | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    api
      .getPublicNote(slug)
      .then((r) => setDoc(r.doc))
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 404) setNotFound(true);
      });
  }, [slug]);

  if (notFound) {
    return (
      <p style={{ textAlign: 'center', marginTop: '80px', color: theme.mutedColor }}>
        This page does not exist.
      </p>
    );
  }
  if (!doc) {
    return <p style={{ textAlign: 'center', marginTop: '80px', color: theme.mutedColor }}>Loading…</p>;
  }

  const rows = Math.max(1, ...doc.blocks.map((b) => b.row + b.rowSpan));

  return (
    <div style={{ background: 'white', minHeight: '100vh' }}>
      <div style={{ maxWidth: `${12 * SLOT}px`, margin: '0 auto', padding: '40px 20px' }}>
        <h1 style={{ color: theme.textColor, fontSize: '26px', margin: '0 0 24px' }}>{doc.title}</h1>
        <div style={{ position: 'relative', width: `${12 * SLOT}px`, height: `${rows * SLOT}px` }}>
          {doc.blocks.map((b) => {
            const mod = blockModule(b.kind);
            return (
              <div
                key={b.id}
                style={{
                  position: 'absolute',
                  left: `${b.col * SLOT + PAD}px`,
                  top: `${b.row * SLOT + PAD}px`,
                  width: `${b.colSpan * SLOT - 2 * PAD}px`,
                  height: `${b.rowSpan * SLOT - 2 * PAD}px`,
                  overflow: 'auto',
                  padding: '4px 2px',
                }}
              >
                {mod ? (
                  <mod.RenderView content={(b.content ?? mod.createContent()) as never} />
                ) : (
                  <div style={{ color: theme.mutedColor, fontStyle: 'italic', fontSize: '13px' }}>
                    Unsupported content
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
