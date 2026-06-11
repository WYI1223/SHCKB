/**
 * Editing canvas — graph-paper visuals from prototype VariantA, block
 * bodies now host real BlockKindModule views: inactive blocks render
 * the module RenderView (preview), only the active block mounts its
 * EditView (block-markdown.md performance boundary).
 */
import { totalRows, type Block } from '@skb/grid-engine';
import { blockModule } from '../blocks/registry';
import { blockCardStyle, canvasBaseplateStyle, theme } from '../theme/tokens';
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
  const { interaction, activeId, onActivate } = props;
  const { state, drag } = interaction;
  const rows = totalRows(state) + MIN_ROWS_PADDING;
  const SLOT = theme.slot;
  const PAD = theme.pad;

  return (
    <div
      style={{ display: 'flex', justifyContent: 'center', background: theme.canvasBg, padding: '20px 20px 80px' }}
      onClick={() => onActivate(null)}
    >
      <div
        data-skb-canvas
        {...interaction.canvasDropProps(SLOT)}
        style={{
          position: 'relative',
          width: `${state.totalCols * SLOT}px`,
          height: `${rows * SLOT}px`,
          ...canvasBaseplateStyle(),
        }}
      >
        {state.blocks.map((b) => (
          <BlockShell key={b.id} block={b} {...props} slot={SLOT} pad={PAD} />
        ))}
        {drag.intent && <DropGhost intent={drag.intent} slotSize={SLOT} padding={PAD} />}
        <ResizePreview interaction={interaction} slotSize={SLOT} padding={PAD} />
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
  const mod = blockModule(block.kind);
  const isActive = activeId === block.id;
  const isResizing = interaction.resize.active && interaction.resize.blockId === block.id;
  const hue = theme.kindHue(block.kind);

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
        ...blockCardStyle(block.kind),
        position: 'absolute',
        left: `${block.col * slot + pad}px`,
        top: `${block.row * slot + pad}px`,
        width: `${block.colSpan * slot - 2 * pad}px`,
        height: `${block.rowSpan * slot - 2 * pad}px`,
        // editing-state chrome on top of the shared card look:
        ...(isActive
          ? { border: `1px solid ${theme.accent}`, borderTop: `2px solid ${theme.accent}`, boxShadow: '0 2px 12px oklch(60% 0.12 240 / 25%)' }
          : {}),
        fontSize: '12px',
        color: theme.textColor,
        cursor: isActive ? 'default' : 'grab',
        opacity: isResizing ? 0.6 : 1,
        display: 'flex',
        flexDirection: 'column',
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
      <div style={{ flex: 1, minHeight: 0, overflow: isActive ? 'visible' : 'auto' }}>
        <BlockBody
          block={block}
          mod={mod}
          isActive={isActive}
          content={contents[block.id]}
          onContentChange={onContentChange}
        />
      </div>
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
