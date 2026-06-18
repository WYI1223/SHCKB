/**
 * Public read route (notepage-view.md M2 slice): renders the published
 * snapshot only — never working state — with no author affordances.
 * The layout is the SAME PublishedCanvas the static renderer uses
 * [ADR-0024]; the effective theme arrives in the public payload.
 * 404 is identical for missing/private/unpublished.
 */
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
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
import { makeLinkClickHandler, surfaceOf, useNavigateToPage } from '../nav/useNavigateToPage';
import { useScrollRestore } from '../nav/useScrollRestore';
import { scrollToHashTarget } from '../nav/scrollToBlock';

export function ReadPage() {
  const { id } = useParams<{ id: string }>();
  const { pathname, hash } = useLocation();
  const [resp, setResp] = useState<{
    doc: PublishedDoc;
    theme: string;
    customization: ThemeCustomization | null;
  } | null>(null);
  const [notFound, setNotFound] = useState(false);

  const navigateToPage = useNavigateToPage();
  const onLinkClick = useMemo(() => makeLinkClickHandler(navigateToPage), [navigateToPage]);
  const scrollRef = useScrollRestore(id ?? '', surfaceOf(pathname) === 'note' ? 'note' : 'read');

  useEffect(() => {
    if (!id) return;
    let active = true;
    setResp(null);
    setNotFound(false);
    api
      .getPublicNote(id)
      .then((r) => {
        if (active) setResp({ doc: r.doc, theme: r.theme, customization: r.customization });
      })
      .catch((e: unknown) => {
        if (active && e instanceof ApiError && e.status === 404) setNotFound(true);
      });
    return () => {
      active = false;
    };
  }, [id]);

  // Hash-jump on entry: once the published doc has rendered, scroll to #blockId.
  useEffect(() => {
    if (resp && hash) scrollToHashTarget(hash);
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
  // min-height:100vh (not height:100%) so the standalone /notes/:id route —
  // which has no parent height chain outside the Shell — still fills the
  // viewport and scrolls; inside the Shell (/read/:id) the <main> provides
  // height and is the real scroller, so scroll-restore there is best-effort.
  return (
    <div ref={scrollRef} style={{ minHeight: '100vh', overflow: 'auto' }} onClick={onLinkClick}>
      <ThemeProvider theme={applyCustomization(THEMES[resp.theme] ?? graphPaper, resp.customization)}>
        <PublishedCanvas doc={renderDoc} />
      </ThemeProvider>
    </div>
  );
}
