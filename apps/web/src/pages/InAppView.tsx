/**
 * In-app View (/view/:id, MVP-10 spec §4): a read-only preview of the AUTHOR's
 * working draft — the "see my draft as a reader" surface that the
 * published-only ReadPage never offered. By id (app surface), inside the Shell.
 * Renders working content through the shared PublishedCanvas (same renderer as
 * the public page), so edit/preview parity is by construction.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { PublishedCanvas, type PublishedDocShape } from '@skb/block-kinds';
import { THEMES, ThemeProvider, applyCustomization, graphPaper } from '@skb/theme';
import { api, ApiError, type NotepageDetail } from '../api/client';
import { BENCH } from '../chrome/bench';
import { useShell } from '../shell/Shell';
import { makeLinkClickHandler, useNavigateToPage } from '../nav/useNavigateToPage';
import { useScrollRestore } from '../nav/useScrollRestore';
import { scrollToBlock } from '../nav/scrollToBlock';

export function InAppView() {
  const { id } = useParams<{ id: string }>();
  const { hash } = useLocation();
  const shell = useShell();
  const [detail, setDetail] = useState<NotepageDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const navigateToPage = useNavigateToPage();
  const onLinkClick = useMemo(() => makeLinkClickHandler(navigateToPage), [navigateToPage]);
  const scrollRef = useScrollRestore(id ?? '', 'view');

  useEffect(() => {
    if (!id) return;
    setDetail(null); setNotFound(false);
    api.getNotepage(id).then(setDetail).catch((e: unknown) => {
      if (e instanceof ApiError && e.status === 404) setNotFound(true);
    });
  }, [id]);

  // Hash-jump on entry takes precedence over scroll restore: if the URL carries
  // #blockId, scroll to that block once the doc has rendered.
  useEffect(() => {
    if (detail && hash) scrollToBlock(decodeURIComponent(hash.slice(1)));
  }, [detail, hash]);

  if (notFound) return <Msg text="This page does not exist." />;
  if (!detail) return <Msg text="Loading…" />;

  // working blocks → the PublishedCanvas render shape (follow boolean from
  // autofit). Annotated as the canvas doc type so the prop is fully checked —
  // gravityEnabled (not read by the canvas) is intentionally dropped.
  const isFollow = (af: unknown) => af === 'follow' || af === 'grow' || af === 'grow+shrink';
  const renderDoc: PublishedDocShape = {
    title: detail.page.title,
    background: detail.page.background,
    blocks: detail.blocks.map((b) => ({ ...b, follow: isFollow(b.autofit) })),
  };
  const themeId = detail.page.themeId ?? shell.instanceTheme;
  const theme = applyCustomization(THEMES[themeId] ?? graphPaper, shell.customizations[themeId]);

  return (
    <div ref={scrollRef} className="pu-scroll" style={{ height: '100%', overflow: 'auto', background: BENCH.paperSunken }} onClick={onLinkClick}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 12px' }}>
        <Link to={`/edit/${detail.page.id}`} style={{ color: BENCH.blue, fontFamily: BENCH.fontUi, fontSize: '12px', textDecoration: 'none' }}>
          edit ✎
        </Link>
      </div>
      <ThemeProvider theme={theme}><PublishedCanvas doc={renderDoc} /></ThemeProvider>
    </div>
  );
}

function Msg({ text }: { text: string }) {
  return <p style={{ textAlign: 'center', marginTop: '80px', color: BENCH.inkSoft, fontFamily: BENCH.fontUi, fontSize: '13px' }}>{text}</p>;
}
