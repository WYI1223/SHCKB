/**
 * Published-page layout, shared verbatim by the SPA read route and the
 * publish-time static renderer — render drift is structurally
 * impossible (MVP-4 M4-D1). v2 [ADR-0025]: the canvas owns geometry
 * (positioned wrappers); the theme's render slots (or the defaults)
 * own every visual shell.
 */
import { publicBlobUrl, resolveSkin, useTheme, type PageBackground } from '@skb/theme';
import { DefaultCanvasSurface, DefaultPageTitle } from './frames';
import { BlockFrameCore } from './BlockFrameCore';
import { blockModule } from './registry';

export type PublishedDocShape = {
  title: string;
  /** Author-picked page background (M6-D4); absent = theme canvas. */
  background?: PageBackground | null;
  blocks: Array<{
    id: string;
    kind: string;
    col: number;
    row: number;
    colSpan: number;
    rowSpan: number;
    /** Author-picked theme shell option id (M6-D3). */
    shell?: string | null;
    /** Follow flag threaded from working state — clipping (follow) vs
     * scrolling (fix) in the published view (see blockOverflow in @skb/theme). */
    follow?: boolean;
    content: unknown;
  }>;
};

/** Host-applied page background (the canvas root): color replaces the
 * theme canvas, image lays under everything as cover. Theme surfaces
 * draw their textures above it (they paint on a transparent base). */
export function pageBackgroundStyle(
  bg: PageBackground | null | undefined,
  fallback: string,
): React.CSSProperties {
  return {
    background: bg?.color ?? fallback,
    ...(bg?.blobHash
      ? {
          backgroundImage: `url(${publicBlobUrl(bg.blobHash)})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }
      : {}),
  };
}

const COLS = 12;

export function PublishedCanvas({ doc }: { doc: PublishedDocShape }) {
  const theme = useTheme();
  const rows = Math.max(1, ...doc.blocks.map((b) => b.row + b.rowSpan));
  const SLOT = theme.slot;
  const PAD = theme.pad;
  const Surface = theme.CanvasSurface ?? DefaultCanvasSurface;
  const Title = theme.PageTitle ?? DefaultPageTitle;

  return (
    <div
      style={{
        ...pageBackgroundStyle(doc.background, theme.canvasBg),
        minHeight: '100vh',
        fontFamily: theme.fontFamily,
      }}
    >
      <div style={{ maxWidth: `${COLS * SLOT}px`, margin: '0 auto', padding: '40px 20px' }}>
        <Title title={doc.title} />
        <Surface widthPx={COLS * SLOT} heightPx={rows * SLOT} background={doc.background}>
          {doc.blocks.map((b) => {
            const mod = blockModule(b.kind);
            // b.shell is the persisted skin id (data field rename to skinId is deferred/north-star).
            const skin = resolveSkin(theme, b.kind, b.shell);
            return (
              <div
                key={b.id}
                style={{
                  position: 'absolute',
                  left: `${b.col * SLOT + PAD}px`,
                  top: `${b.row * SLOT + PAD}px`,
                  width: `${b.colSpan * SLOT - 2 * PAD}px`,
                  height: `${b.rowSpan * SLOT - 2 * PAD}px`,
                }}
              >
                <BlockFrameCore kind={b.kind} blockId={b.id} colSpan={b.colSpan} rowSpan={b.rowSpan} follow={b.follow} skin={skin}>
                  {mod ? (
                    <mod.RenderView content={(b.content ?? mod.createContent()) as never} />
                  ) : (
                    <div style={{ color: theme.mutedColor, fontStyle: 'italic', fontSize: '13px' }}>
                      Unsupported content
                    </div>
                  )}
                </BlockFrameCore>
              </div>
            );
          })}
        </Surface>
      </div>
    </div>
  );
}
