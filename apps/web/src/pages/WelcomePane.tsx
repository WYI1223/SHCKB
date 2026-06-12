/**
 * The main pane at rest. For the author: a quiet bench note. For the
 * anonymous reader: the table of contents, set like a colophon page —
 * title, rule, indented tree, publish dates where page numbers would
 * go. Zero instrumentation on the reader side (no blue).
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type PublicTreePage, type TreeFolder } from '../api/client';
import { BENCH, labelStyle } from '../chrome/bench';
import { useShell } from '../shell/Shell';

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
      .then(({ notes }) => setDates(Object.fromEntries(notes.map((n) => [n.slug, n.publishedAt]))))
      .catch(() => undefined);
  }, []);

  if (!tree) return null;
  const { folders, notepages } = tree;
  const childFolders = (parentId: string | null) => folders.filter((f) => f.parentId === parentId);
  const childPages = (folderId: string | null) => notepages.filter((p) => p.folderId === folderId);

  function renderPage(p: PublicTreePage, depth: number) {
    const at = dates[p.slug];
    return (
      <div key={p.slug} style={{ display: 'flex', alignItems: 'baseline', gap: '8px', paddingLeft: `${depth * 18}px`, margin: '7px 0' }}>
        <Link
          to={`/read/${p.slug}`}
          style={{ color: BENCH.ink, textDecoration: 'none', fontSize: '14px' }}
        >
          {p.title}
        </Link>
        <span aria-hidden style={{ flex: 1, borderBottom: `1px dotted ${BENCH.hairlineDark}`, transform: 'translateY(-3px)' }} />
        <span style={{ fontFamily: BENCH.fontMono, fontSize: '10px', color: BENCH.inkFaint }}>
          {at ? formatDate(at) : ''}
        </span>
      </div>
    );
  }

  function renderFolder(f: TreeFolder, depth: number) {
    return (
      <div key={f.id} style={{ margin: '12px 0 4px' }}>
        <div style={{ ...labelStyle({ fontSize: '10px', color: BENCH.inkSoft }), paddingLeft: `${depth * 18}px` }}>
          {f.name}
        </div>
        {childFolders(f.id).map((sub) => renderFolder(sub, depth + 1))}
        {childPages(f.id).map((p) => renderPage(p, depth + 1))}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '560px', margin: '0 auto', padding: '64px 24px 96px', fontFamily: BENCH.fontUi, color: BENCH.ink }}>
      <div style={{ textAlign: 'center', marginBottom: '8px' }}>
        <span
          style={{
            fontFamily: BENCH.fontMono,
            fontSize: '15px',
            fontWeight: 700,
            letterSpacing: '0.3em',
            marginRight: '-0.3em',
          }}
        >
          SHCKB
        </span>
      </div>
      <div style={{ ...labelStyle({ fontSize: '9px' }), textAlign: 'center', marginBottom: '18px' }}>
        table of contents
      </div>
      <div style={{ borderTop: `2px solid ${BENCH.ink}`, paddingTop: '14px' }}>
        {childFolders(null).map((f) => renderFolder(f, 0))}
        {childPages(null).map((p) => renderPage(p, 0))}
        {notepages.length === 0 && (
          <p style={{ color: BENCH.inkFaint, fontSize: '13px', fontStyle: 'italic', textAlign: 'center' }}>
            Nothing published yet.
          </p>
        )}
      </div>
    </div>
  );
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
