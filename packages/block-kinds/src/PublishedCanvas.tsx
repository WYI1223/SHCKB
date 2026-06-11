/**
 * Published-page layout, shared verbatim by the SPA read route and the
 * publish-time static renderer — render drift is structurally
 * impossible (MVP-4 M4-D1). v2 [ADR-0025]: the canvas owns geometry
 * (positioned wrappers); the theme's render slots (or the defaults)
 * own every visual shell.
 */
import { useTheme } from '@skb/theme';
import { DefaultBlockFrame, DefaultCanvasSurface, DefaultPageTitle } from './frames';
import { blockModule } from './registry';

export type PublishedDocShape = {
  title: string;
  blocks: Array<{
    id: string;
    kind: string;
    col: number;
    row: number;
    colSpan: number;
    rowSpan: number;
    content: unknown;
  }>;
};

const COLS = 12;

export function PublishedCanvas({ doc }: { doc: PublishedDocShape }) {
  const theme = useTheme();
  const rows = Math.max(1, ...doc.blocks.map((b) => b.row + b.rowSpan));
  const SLOT = theme.slot;
  const PAD = theme.pad;
  const Frame = theme.BlockFrame ?? DefaultBlockFrame;
  const Surface = theme.CanvasSurface ?? DefaultCanvasSurface;
  const Title = theme.PageTitle ?? DefaultPageTitle;

  return (
    <div style={{ background: theme.canvasBg, minHeight: '100vh', fontFamily: theme.fontFamily }}>
      <div style={{ maxWidth: `${COLS * SLOT}px`, margin: '0 auto', padding: '40px 20px' }}>
        <Title title={doc.title} />
        <Surface widthPx={COLS * SLOT} heightPx={rows * SLOT}>
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
                }}
              >
                <Frame kind={b.kind} blockId={b.id} colSpan={b.colSpan} rowSpan={b.rowSpan}>
                  {mod ? (
                    <mod.RenderView content={(b.content ?? mod.createContent()) as never} />
                  ) : (
                    <div style={{ color: theme.mutedColor, fontStyle: 'italic', fontSize: '13px' }}>
                      Unsupported content
                    </div>
                  )}
                </Frame>
              </div>
            );
          })}
        </Surface>
      </div>
    </div>
  );
}
