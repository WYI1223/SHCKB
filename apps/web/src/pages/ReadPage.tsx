/**
 * Public read route (notepage-view.md M2 slice): renders the published
 * snapshot only — never working state — with no author affordances.
 * The layout is the SAME PublishedCanvas the static renderer uses
 * [ADR-0024]; the effective theme arrives in the public payload.
 * 404 is identical for missing/private/unpublished.
 */
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { PublishedCanvas } from '@skb/block-kinds';
import {
  THEMES,
  ThemeProvider,
  applyCustomization,
  graphPaper,
  type ThemeCustomization,
} from '@skb/theme';
import { api, ApiError, type PublishedDoc } from '../api/client';
import { BENCH } from '../chrome/bench';
import { makeLinkClickHandler, useNavigateToPage } from '../nav/useNavigateToPage';
import { useScrollRestore } from '../nav/useScrollRestore';
import { scrollToBlock } from '../nav/scrollToBlock';

export function ReadPage() {
  const { slug } = useParams<{ slug: string }>();
  const { hash } = useLocation();
  const navigate = useNavigate();
  const [resp, setResp] = useState<{
    doc: PublishedDoc;
    theme: string;
    customization: ThemeCustomization | null;
  } | null>(null);
  const [notFound, setNotFound] = useState(false);

  // Public-surface client nav (MVP-10 Task 11): materialized /notes/:slug links
  // navigate via the router; unresolved /p/:id links fall back to the server
  // 302 through navigateToPage. Plus position layer + hash-jump on entry.
  const navigateToPage = useNavigateToPage();
  const onLinkClick = useMemo(
    () => makeLinkClickHandler(navigateToPage, (p) => navigate(p)),
    [navigateToPage, navigate],
  );
  const scrollRef = useScrollRestore(slug ?? '', 'public');

  useEffect(() => {
    if (!slug) return;
    setResp(null);
    setNotFound(false);
    api
      .getPublicNote(slug)
      .then((r) => setResp({ doc: r.doc, theme: r.theme, customization: r.customization }))
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 404) setNotFound(true);
      });
  }, [slug]);

  // Hash-jump on entry: once the published doc has rendered, scroll to #blockId
  // (a materialized block link carries the fragment in its /notes/:slug href).
  useEffect(() => {
    if (resp && hash) scrollToBlock(decodeURIComponent(hash.slice(1)));
  }, [resp, hash]);

  const message = (text: string) => (
    <p
      style={{
        textAlign: 'center',
        marginTop: '80px',
        color: BENCH.inkSoft,
        fontFamily: BENCH.fontUi,
        fontSize: '13px',
      }}
    >
      {text}
    </p>
  );
  if (notFound) return message('This page does not exist.');
  if (!resp) return message('Loading…');

  // Coerce the persisted autofit mode to the boolean `follow` render shape
  // (follow → clip, fix → scroll). Legacy-aware: until the data migration
  // lands, the wire value can still be a legacy enum, so map
  // 'grow'/'grow+shrink' → follow too (mirrors EditorPage.toMode and
  // publish-html) to keep the SPA and static published surfaces in lockstep.
  const isFollow = (af: unknown) => af === 'follow' || af === 'grow' || af === 'grow+shrink';
  const renderDoc = {
    ...resp.doc,
    blocks: resp.doc.blocks.map((b) => ({ ...b, follow: isFollow(b.autofit) })),
  };

  // Scroll container owns the position layer + the delegated link handler.
  // MVP limitation: on the standalone /notes/:slug route this box is the
  // scroller; inside the Shell (/read/:slug) the Shell's <main> is the real
  // scroller, so scroll-restore is best-effort there — acceptable for MVP.
  return (
    <div ref={scrollRef} style={{ height: '100%', overflow: 'auto' }} onClick={onLinkClick}>
      <ThemeProvider theme={applyCustomization(THEMES[resp.theme] ?? graphPaper, resp.customization)}>
        <PublishedCanvas doc={renderDoc} />
      </ThemeProvider>
    </div>
  );
}
