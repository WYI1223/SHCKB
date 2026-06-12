/**
 * The light table — the themed sheet sits bounded on the bench with a
 * visible edge: what's inside the edge is what the reader's camera
 * shoots; everything blue is non-photo instrumentation the reader
 * never sees. Block bodies host real BlockKindModule views: inactive
 * blocks render the module RenderView (preview), only the active block
 * mounts its EditView (block-markdown.md performance boundary).
 */
import { totalRows, type Block } from '@skb/grid-engine';
import { BLOCK_KINDS, blockModule, DefaultBlockFrame, DefaultCanvasSurface, pageBackgroundStyle } from '@skb/block-kinds';
import { resolveBlockFrame, useTheme, type PageBackground } from '@skb/theme';
import { BENCH } from '../chrome/bench';
import { useOverlays } from '../chrome/overlays';
import { DeleteButton, DropGhost, ResizeHandles, ResizePreview } from './overlays';
import type { Interaction } from './useGridInteraction';

const MIN_ROWS_PADDING = 4;
/** Sheet margin around the grid — the board's edge belongs to the sheet. */
const SHEET_PAD = 24;

export type GridCanvasProps = {
  interaction: Interaction;
  contents: Record<string, unknown>;
  /** Author-picked shell option id per block (M6-D3). */
  shells: Record<string, string | null>;
  /** Author-picked page background (M6-D4) — live working-state preview. */
  background: PageBackground | null;
  activeId: string | null;
  onActivate: (id: string | null) => void;
  onContentChange: (id: string, content: unknown) => void;
  onBlockDeleted: (id: string) => void;
};

export function GridCanvas(props: GridCanvasProps) {
  const theme = useTheme();
  const overlays = useOverlays();
  const { interaction, activeId, onActivate } = props;
  const { state, drag } = interaction;
  const rows = totalRows(state) + MIN_ROWS_PADDING;
  const SLOT = theme.slot;
  const PAD = theme.pad;
  const Surface = theme.CanvasSurface ?? DefaultCanvasSurface;

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        minHeight: '100%',
        padding: '24px 24px 96px',
      }}
      onClick={() => onActivate(null)}
    >
      {/* the sheet: themed surface with an honest edge on the bench */}
      <div
        className="pu-sheet"
        style={{
          ...pageBackgroundStyle(props.background, theme.canvasBg),
          border: `1px solid ${BENCH.hairlineDark}`,
          padding: `${SHEET_PAD}px`,
          fontFamily: theme.fontFamily,
        }}
      >
        <div
          data-skb-canvas
          {...interaction.canvasDropProps(SLOT)}
          onContextMenu={(e) => {
            // empty-sheet right-click = insert at the cursor cell (M8-D3);
            // block right-clicks stop before reaching here.
            e.preventDefault();
            const rect = e.currentTarget.getBoundingClientRect();
            const col = Math.floor((e.clientX - rect.left) / SLOT);
            const row = Math.floor((e.clientY - rect.top) / SLOT);
            overlays.menu(
              { x: e.clientX, y: e.clientY },
              Object.values(BLOCK_KINDS).map((mod) => ({
                label: `${mod.glyph} ${mod.label}`,
                onSelect: () => interaction.ops.insertAt(col, row, mod.kind),
              })),
              { header: 'insert block' },
            );
          }}
          style={{
            position: 'relative',
            width: `${state.totalCols * SLOT}px`,
            height: `${rows * SLOT}px`,
          }}
        >
          <Surface widthPx={state.totalCols * SLOT} heightPx={rows * SLOT} background={props.background}>
            {state.blocks.map((b) => (
              <BlockShell key={b.id} block={b} {...props} slot={SLOT} pad={PAD} />
            ))}
            {drag.intent && <DropGhost intent={drag.intent} slotSize={SLOT} padding={PAD} />}
            <ResizePreview interaction={interaction} slotSize={SLOT} padding={PAD} />
          </Surface>
        </div>
      </div>
    </div>
  );
}

function BlockShell({
  block,
  interaction,
  contents,
  shells,
  activeId,
  onActivate,
  onContentChange,
  onBlockDeleted,
  slot,
  pad,
}: GridCanvasProps & { block: Block; slot: number; pad: number }) {
  const theme = useTheme();
  const overlays = useOverlays();
  const mod = blockModule(block.kind);
  const isActive = activeId === block.id;
  const isResizing = interaction.resize.active && interaction.resize.blockId === block.id;
  // v2 [ADR-0025]: outer div = geometry + interaction + editing chrome
  // (editor-owned); the theme's BlockFrame owns the visual shell. An
  // author shell choice resolves to its own Frame (M6-D3).
  const shell = shells[block.id] ?? null;
  const Frame = resolveBlockFrame(theme, block.kind, shell) ?? theme.BlockFrame ?? DefaultBlockFrame;

  return (
    <div
      data-block-id={block.id}
      data-block-kind={block.kind}
      data-pu-active={isActive || undefined}
      className="pu-block"
      {...(isActive ? {} : interaction.blockDragProps(block))}
      onClick={(e) => {
        e.stopPropagation();
        if (!isActive) onActivate(block.id);
      }}
      onContextMenu={(e) => {
        // active block keeps the native menu (copy/paste belongs to the
        // edit surface); inactive blocks get the chrome menu.
        e.stopPropagation();
        if (isActive) return;
        e.preventDefault();
        overlays.menu(
          { x: e.clientX, y: e.clientY },
          [
            { label: 'edit', onSelect: () => onActivate(block.id) },
            { kind: 'separator' },
            {
              label: 'delete',
              danger: true,
              onSelect: () => {
                interaction.ops.remove(block.id);
                onBlockDeleted(block.id);
              },
            },
          ],
          { header: `${mod ? mod.label : block.kind} · ${block.colSpan}×${block.rowSpan}` },
        );
      }}
      style={{
        position: 'absolute',
        left: `${block.col * slot + pad}px`,
        top: `${block.row * slot + pad}px`,
        width: `${block.colSpan * slot - 2 * pad}px`,
        height: `${block.rowSpan * slot - 2 * pad}px`,
        // active ring = non-photo blue editor chrome on the unrotated
        // geometry box — works for any frame shape a theme draws inside.
        ...(isActive ? { boxShadow: `0 0 0 2px ${BENCH.blueBright}`, zIndex: 30 } : {}),
        cursor: isActive ? 'default' : 'grab',
        opacity: isResizing ? 0.6 : 1,
      }}
    >
      {/* instrument readout: kind + dims, non-photo blue, hover/active only */}
      <div
        aria-hidden
        className="pu-mark"
        style={{
          position: 'absolute',
          top: '-15px',
          left: '0',
          right: '0',
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: BENCH.fontMono,
          fontSize: '9px',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: BENCH.blue,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        <span>{mod ? `${mod.glyph} ${mod.label}` : `? ${block.kind}`}</span>
        <span style={{ paddingRight: '22px' }}>
          {block.colSpan}×{block.rowSpan}
        </span>
      </div>
      <Frame kind={block.kind} blockId={block.id} colSpan={block.colSpan} rowSpan={block.rowSpan} shell={shell}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            // scrolling belongs to the theme's frame alone (owner
            // feedback: double scrollbars) — inactive blocks grow
            // naturally and the frame scrolls them.
            height: isActive ? '100%' : 'auto',
            minHeight: '100%',
            fontSize: '12px',
            color: theme.textColor,
          }}
        >
          <div style={{ flex: 1, minHeight: 0, overflow: 'visible' }}>
            <BlockBody
              block={block}
              mod={mod}
              isActive={isActive}
              content={contents[block.id]}
              onContentChange={onContentChange}
            />
          </div>
        </div>
      </Frame>
      <DeleteButton
        onClick={() => {
          interaction.ops.remove(block.id);
          onBlockDeleted(block.id);
        }}
      />
      {!isActive && <ResizeHandles block={block} interaction={interaction} slot={slot} />}
    </div>
  );
}

function BlockBody({
  block,
  mod,
  isActive,
  content,
  onContentChange,
}: {
  block: Block;
  mod: ReturnType<typeof blockModule>;
  isActive: boolean;
  content: unknown;
  onContentChange: (id: string, content: unknown) => void;
}) {
  const theme = useTheme();
  if (!mod) {
    // Unsupported kind: preserve content, never overwrite (blocks.md fallback scenario).
    return (
      <div style={{ color: theme.mutedColor, fontStyle: 'italic' }}>
        Unsupported block kind "{block.kind}" — content preserved.
      </div>
    );
  }
  const safeContent = (content ?? mod.createContent()) as never;
  if (isActive) {
    const Edit = mod.EditView;
    return <Edit content={safeContent} onChange={(next) => onContentChange(block.id, next)} />;
  }
  const Render = mod.RenderView;
  return <Render content={safeContent} />;
}
