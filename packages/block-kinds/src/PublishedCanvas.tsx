/**
 * Published-page layout, shared verbatim by the SPA read route and the
 * publish-time static renderer — render drift is structurally
 * impossible (MVP-4 M4-D1; repays the mvp2 dual-renderer debt).
 */
import { blockCardStyle, canvasBaseplateStyle, useTheme } from '@skb/theme';
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

  return (
    <div style={{ background: theme.canvasBg, minHeight: '100vh' }}>
      <div style={{ maxWidth: `${COLS * SLOT}px`, margin: '0 auto', padding: '40px 20px' }}>
        <h1 style={{ color: theme.textColor, fontSize: '26px', margin: '0 0 24px' }}>{doc.title}</h1>
        <div
          style={{
            position: 'relative',
            width: `${COLS * SLOT}px`,
            height: `${rows * SLOT}px`,
            ...canvasBaseplateStyle(theme),
          }}
        >
          {doc.blocks.map((b) => {
            const mod = blockModule(b.kind);
            return (
              <div
                key={b.id}
                style={{
                  ...blockCardStyle(theme, b.kind),
                  position: 'absolute',
                  left: `${b.col * SLOT + PAD}px`,
                  top: `${b.row * SLOT + PAD}px`,
                  width: `${b.colSpan * SLOT - 2 * PAD}px`,
                  height: `${b.rowSpan * SLOT - 2 * PAD}px`,
                  overflow: 'auto',
                  fontSize: '14px',
                  lineHeight: 1.55,
                }}
              >
                {mod ? (
                  <mod.RenderView content={(b.content ?? mod.createContent()) as never} />
                ) : (
                  <div style={{ color: theme.mutedColor, fontStyle: 'italic', fontSize: '13px' }}>
                    Unsupported content
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
