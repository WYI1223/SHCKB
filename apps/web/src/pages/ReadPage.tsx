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
import { THEMES, ThemeProvider, graphPaper } from '@skb/theme';
import { api, ApiError, type PublishedDoc } from '../api/client';
import { useTheme } from '@skb/theme';

export function ReadPage() {
  const theme = useTheme();
  const { slug } = useParams<{ slug: string }>();
  const [resp, setResp] = useState<{ doc: PublishedDoc; theme: string } | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    api
      .getPublicNote(slug)
      .then((r) => setResp({ doc: r.doc, theme: r.theme }))
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
  if (!resp) {
    return <p style={{ textAlign: 'center', marginTop: '80px', color: theme.mutedColor }}>Loading…</p>;
  }

  return (
    <ThemeProvider theme={THEMES[resp.theme] ?? graphPaper}>
      <PublishedCanvas doc={resp.doc} />
    </ThemeProvider>
  );
}
