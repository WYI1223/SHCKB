/**
 * Editing canvas — graph-paper visuals from prototype VariantA, block
 * bodies now host real BlockKindModule views: inactive blocks render
 * the module RenderView (preview), only the active block mounts its
 * EditView (block-markdown.md performance boundary).
 */
import { totalRows, type Block } from '@skb/grid-engine';
import { blockModule, DefaultBlockFrame, DefaultCanvasSurface } from '@skb/block-kinds';
import { kindHue, useTheme } from '@skb/theme';
import { DeleteButton, DropGhost, ResizeHandles, ResizePreview } from './overlays';
import type { Interaction } from './useGridInteraction';

const MIN_ROWS_PADDING = 4;

export type GridCanvasProps = {
  interaction: Interaction;
  contents: Record<string, unknown>;
  activeId: string | null;
  onActivate: (id: string | null) => void;
  onContentChange: (id: string, content: unknown) => void;
  onBlockDeleted: (id: string) => void;
};

export function GridCanvas(props: GridCanvasProps) {
  const theme = useTheme();
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
        background: theme.canvasBg,
        padding: '20px 20px 80px',
        fontFamily: theme.fontFamily,
      }}
      onClick={() => onActivate(null)}
    >
      <div
        data-skb-canvas
        {...interaction.canvasDropProps(SLOT)}
        style={{
          position: 'relative',
          width: `${state.totalCols * SLOT}px`,
          height: `${rows * SLOT}px`,
        }}
      >
        <Surface widthPx={state.totalCols * SLOT} heightPx={rows * SLOT}>
          {state.blocks.map((b) => (
            <BlockShell key={b.id} block={b} {...props} slot={SLOT} pad={PAD} />
          ))}
          {drag.intent && <DropGhost intent={drag.intent} slotSize={SLOT} padding={PAD} />}
          <ResizePreview interaction={interaction} slotSize={SLOT} padding={PAD} />
        </Surface>
      </div>
    </div>
  );
}

function BlockShell({
  block,
  interaction,
  contents,
  activeId,
  onActivate,
  onContentChange,
  onBlockDeleted,
  slot,
  pad,
}: GridCanvasProps & { block: Block; slot: number; pad: number }) {
  const theme = useTheme();
  const mod = blockModule(block.kind);
  const isActive = activeId === block.id;
  const isResizing = interaction.resize.active && interaction.resize.blockId === block.id;
  const hue = kindHue(theme, block.kind);
  // v2 [ADR-0025]: outer div = geometry + interaction + editing chrome
  // (editor-owned); the theme's BlockFrame owns the visual shell.
  const Frame = theme.BlockFrame ?? DefaultBlockFrame;

  return (
    <div
      data-block-id={block.id}
      data-block-kind={block.kind}
      {...(isActive ? {} : interaction.blockDragProps(block))}
      onClick={(e) => {
        e.stopPropagation();
        if (!isActive) onActivate(block.id);
      }}
      style={{
        position: 'absolute',
        left: `${block.col * slot + pad}px`,
        top: `${block.row * slot + pad}px`,
        width: `${block.colSpan * slot - 2 * pad}px`,
        height: `${block.rowSpan * slot - 2 * pad}px`,
        // active ring is editor chrome on the unrotated geometry box —
        // it works for any frame shape a theme draws inside.
        ...(isActive ? { boxShadow: `0 0 0 2px ${theme.accent}`, zIndex: 30 } : {}),
        cursor: isActive ? 'default' : 'grab',
        opacity: isResizing ? 0.6 : 1,
      }}
    >
      <Frame kind={block.kind} blockId={block.id} colSpan={block.colSpan} rowSpan={block.rowSpan}>
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
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '4px',
              flexShrink: 0,
            }}
          >
            <span style={{ fontWeight: 600, color: hue, fontSize: '11px' }}>
              {mod ? `${mod.glyph} ${mod.label}` : `? ${block.kind}`}
            </span>
            <span style={{ fontSize: '10px', opacity: 0.5, marginRight: '20px' }}>
              {block.colSpan}×{block.rowSpan}
            </span>
          </div>
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
