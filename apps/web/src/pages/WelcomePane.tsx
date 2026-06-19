/**
 * The main pane at rest. For the author: a quiet bench note. For the
 * anonymous reader: the book's table of contents — ported from the
 * Marginalia fork at the owner's pick (M7-D7): serif entries with
 * leader dots running to publication dates, folders as small-caps
 * section headings, a double rule under the title. Reader-side gets
 * the publication, not the room: zero instrumentation (no blue).
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type PublicTreePage, type TreeFolder } from '../api/client';
import { BENCH } from '../chrome/bench';
import { useShell } from '../shell/Shell';

/** Contents-page voice (Marginalia tokens, local to this reader pane —
 * chrome stays bench-voiced; the TOC is a printed page, not chrome). */
const TOC = {
  paper: '#FAF8F4',
  ink: '#1A1714',
  ink2: '#5C554B',
  ink3: '#9B9286',
  hairline: '#E5E0D6',
  serif: 'Georgia, "Times New Roman", "Noto Serif SC", serif',
  sans: BENCH.fontUi,
} as const;

const tocSmallCaps = (size: number, color: string): React.CSSProperties => ({
  fontFamily: TOC.sans,
  fontSize: `${size}px`,
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
  color,
});

export function WelcomePane() {
  const { me, publicTree } = useShell();

  if (me) return <AuthorWelcome />;
  if (me === null) return <PublicContents tree={publicTree} />;
  return null; // auth state loading
}

function AuthorWelcome() {
  return (
    <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: BENCH.inkFaint, fontFamily: BENCH.fontUi }}>
        <div style={{ fontFamily: BENCH.fontMono, fontSize: '34px', marginBottom: '10px', color: BENCH.hairlineDark }}>
          ¶
        </div>
        <p style={{ fontSize: '13px', margin: 0 }}>The bench is clear.</p>
        <p style={{ fontSize: '12px', margin: '6px 0 0' }}>
          Pick a notepage from the rack, or start a new one.
        </p>
      </div>
    </div>
  );
}

function PublicContents({
  tree,
}: {
  tree: { folders: TreeFolder[]; notepages: PublicTreePage[] } | null;
}) {
  // publish dates play the role of page numbers in the colophon
  const [dates, setDates] = useState<Record<string, number>>({});
  useEffect(() => {
    api
      .listPublicNotes()
      .then(({ notes }) => setDates(Object.fromEntries(notes.map((n) => [n.id, n.publishedAt]))))
      .catch(() => undefined);
  }, []);

  if (!tree) return null;
  const { folders, notepages } = tree;
  const childFolders = (parentId: string | null) => folders.filter((f) => f.parentId === parentId);
  const childPages = (folderId: string | null) => notepages.filter((p) => p.folderId === folderId);

  function renderPage(p: PublicTreePage, depth: number) {
    const at = dates[p.id];
    return (
      <Link
        key={p.id}
        to={`/read/${p.id}`}
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '10px',
          padding: '7px 0',
          marginLeft: `${depth * 22}px`,
          textDecoration: 'none',
        }}
      >
        <span style={{ fontFamily: TOC.serif, fontSize: '17px', lineHeight: 1.45, color: TOC.ink }}>
          {p.title}
        </span>
        {/* leader dots — the classic contents-page syntax */}
        <span
          aria-hidden
          style={{
            flex: 1,
            borderBottom: `1px dotted ${TOC.ink3}`,
            transform: 'translateY(-4px)',
            minWidth: '24px',
            opacity: 0.6,
          }}
        />
        <span style={{ fontFamily: TOC.sans, fontSize: '11px', color: TOC.ink3, whiteSpace: 'nowrap' }}>
          {at ? formatDate(at) : ''}
        </span>
      </Link>
    );
  }

  function renderFolder(f: TreeFolder, depth: number): React.JSX.Element | null {
    const subFolders = childFolders(f.id);
    const subPages = childPages(f.id);
    if (subFolders.length === 0 && subPages.length === 0) return null;
    return (
      <section key={f.id} style={{ marginTop: depth === 0 ? '26px' : '14px' }}>
        <h2
          style={{
            ...tocSmallCaps(11, TOC.ink2),
            margin: `0 0 4px ${depth * 22}px`,
            paddingBottom: '4px',
            borderBottom: depth === 0 ? `1px solid ${TOC.hairline}` : 'none',
            fontWeight: 600,
          }}
        >
          {f.name}
        </h2>
        {subPages.map((p) => renderPage(p, depth))}
        {subFolders.map((sub) => renderFolder(sub, depth + 1))}
      </section>
    );
  }

  const topPages = childPages(null);
  return (
    <div
      style={{
        minHeight: '100%',
        background: TOC.paper,
        display: 'flex',
        justifyContent: 'center',
        fontFamily: TOC.sans,
      }}
    >
      <div style={{ width: '100%', maxWidth: '640px', padding: '9vh 28px 80px' }}>
        <header>
          <p style={{ ...tocSmallCaps(10, TOC.ink3), margin: '0 0 12px' }}>Table of contents</p>
          <h1
            style={{
              fontFamily: TOC.serif,
              fontSize: '40px',
              fontWeight: 600,
              letterSpacing: '0.04em',
              color: TOC.ink,
              margin: '0 0 16px',
              lineHeight: 1.15,
            }}
          >
            SHCKB
          </h1>
          {/* the double rule of a contents page */}
          <div aria-hidden style={{ borderTop: `2px solid ${TOC.ink}` }} />
          <div aria-hidden style={{ borderTop: `1px solid ${TOC.hairline}`, marginTop: '2px' }} />
        </header>

        {notepages.length === 0 ? (
          <p style={{ fontFamily: TOC.serif, fontStyle: 'italic', color: TOC.ink3, fontSize: '15px', marginTop: '40px' }}>
            Nothing has been published yet.
          </p>
        ) : (
          <nav aria-label="Published notepages">
            {topPages.length > 0 && <div style={{ marginTop: '22px' }}>{topPages.map((p) => renderPage(p, 0))}</div>}
            {childFolders(null).map((f) => renderFolder(f, 0))}
          </nav>
        )}

        <footer
          style={{
            marginTop: '80px',
            paddingTop: '10px',
            borderTop: `1px solid ${TOC.hairline}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
          }}
        >
          <span style={{ fontFamily: TOC.serif, fontStyle: 'italic', fontSize: '12px', color: TOC.ink3 }}>
            A self-hosted knowledge base.
          </span>
          <Link to="/login" style={{ fontSize: '11px', color: TOC.ink3, textDecoration: 'none' }}>
            Sign in
          </Link>
        </footer>
      </div>
    </div>
  );
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
