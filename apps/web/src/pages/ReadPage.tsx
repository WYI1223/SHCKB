/**
 * Public read route (notepage-view.md M2 slice): renders the published
 * snapshot only — never working state — with no author affordances.
 * The layout is the SAME PublishedCanvas the static renderer uses
 * [ADR-0024]; the effective theme arrives in the public payload.
 * 404 is identical for missing/private/unpublished.
 */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
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

export function ReadPage() {
  const { slug } = useParams<{ slug: string }>();
  const [resp, setResp] = useState<{
    doc: PublishedDoc;
    theme: string;
    customization: ThemeCustomization | null;
  } | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    api
      .getPublicNote(slug)
      .then((r) => setResp({ doc: r.doc, theme: r.theme, customization: r.customization }))
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 404) setNotFound(true);
      });
  }, [slug]);

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

  // Coerce the autofit mode ('follow' | 'fix') to the boolean `follow`
  // render shape expected by PublishedDocShape / BlockFrameCore (follow →
  // clip, fix → scroll).
  const renderDoc = {
    ...resp.doc,
    blocks: resp.doc.blocks.map((b) => ({ ...b, follow: b.autofit === 'follow' })),
  };

  return (
    <ThemeProvider theme={applyCustomization(THEMES[resp.theme] ?? graphPaper, resp.customization)}>
      <PublishedCanvas doc={renderDoc} />
    </ThemeProvider>
  );
}
