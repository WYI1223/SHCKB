import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, type Me, type NotepageSummary } from '../api/client';
import { theme } from '../theme/tokens';

type PublicNote = { slug: string; title: string; publishedAt: number };

/**
 * The directory is visible to everyone (owner decision 2026-06-11):
 * anonymous readers get the public+published index; the signed-in
 * author additionally sees private/unpublished pages with controls.
 */
export function ListPage() {
  const [me, setMe] = useState<Me | null | undefined>(undefined); // undefined = loading
  const [pages, setPages] = useState<NotepageSummary[] | null>(null);
  const [publicNotes, setPublicNotes] = useState<PublicNote[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .me()
      .then(({ user }) => {
        setMe(user);
        return user
          ? api.listNotepages().then((r) => setPages(r.notepages))
          : api.listPublicNotes().then((r) => setPublicNotes(r.notes));
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  async function create() {
    const title = window.prompt('Notepage title', 'Untitled');
    if (title === null) return;
    const { id } = await api.createNotepage(title);
    navigate(`/edit/${id}`);
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this notepage?')) return;
    await api.deleteNotepage(id);
    setPages((p) => p?.filter((x) => x.id !== id) ?? null);
  }

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '32px 20px', color: theme.textColor }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '22px' }}>SHCKB — Notepages</h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {me ? (
            <>
              <button
                onClick={create}
                style={{
                  background: theme.accent,
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                + New notepage
              </button>
              <button
                onClick={() => void api.signOut().then(() => (window.location.href = '/'))}
                style={{
                  background: 'transparent',
                  color: theme.mutedColor,
                  border: theme.blockBorder,
                  borderRadius: '8px',
                  padding: '8px 12px',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Sign out
              </button>
            </>
          ) : me === null ? (
            <Link
              to="/login"
              style={{
                color: theme.accent,
                border: `1px solid ${theme.accent}`,
                borderRadius: '8px',
                padding: '8px 14px',
                fontSize: '13px',
                textDecoration: 'none',
              }}
            >
              Sign in
            </Link>
          ) : null}
        </div>
      </div>

      {error && <p style={{ color: theme.danger }}>{error}</p>}
      {me === undefined && !error && <p style={{ color: theme.mutedColor }}>Loading…</p>}

      {/* anonymous: public directory */}
      {me === null && publicNotes && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {publicNotes.length === 0 && (
            <p style={{ color: theme.mutedColor }}>Nothing published yet.</p>
          )}
          {publicNotes.map((n) => (
            <a
              key={n.slug}
              href={`/notes/${n.slug}`}
              style={{
                display: 'block',
                background: 'white',
                border: theme.blockBorder,
                borderRadius: '8px',
                padding: '12px 16px',
                fontWeight: 600,
                color: theme.textColor,
                textDecoration: 'none',
              }}
            >
              {n.title}
            </a>
          ))}
        </div>
      )}

      {/* author: full directory with controls */}
      {me && pages?.length === 0 && (
        <p style={{ color: theme.mutedColor }}>No notepages yet. Create the first one.</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {me && pages?.map((p) => (
          <div
            key={p.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: 'white',
              border: theme.blockBorder,
              borderRadius: '8px',
              padding: '12px 16px',
            }}
          >
            <Link to={`/edit/${p.id}`} style={{ fontWeight: 600, color: theme.textColor, textDecoration: 'none', flex: 1 }}>
              {p.title}
            </Link>
            <Badge label={p.visibility} tone={p.visibility === 'public' ? 'green' : 'gray'} />
            {p.hasPublished && <Badge label="published" tone="blue" />}
            {p.visibility === 'public' && p.hasPublished && (
              <Link to={`/notes/${p.slug}`} style={{ fontSize: '12px', color: theme.accent }}>
                view
              </Link>
            )}
            <button
              onClick={() => remove(p.id)}
              aria-label={`Delete ${p.title}`}
              style={{ background: 'none', border: 'none', color: theme.danger, cursor: 'pointer', fontSize: '13px' }}
            >
              delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Badge({ label, tone }: { label: string; tone: 'green' | 'gray' | 'blue' }) {
  const colors = {
    green: 'oklch(60% 0.12 145)',
    gray: 'oklch(60% 0.02 80)',
    blue: theme.accent,
  } as const;
  return (
    <span
      style={{
        fontSize: '10px',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        color: colors[tone],
        border: `1px solid ${colors[tone]}`,
        borderRadius: '999px',
        padding: '2px 8px',
      }}
    >
      {label}
    </span>
  );
}
