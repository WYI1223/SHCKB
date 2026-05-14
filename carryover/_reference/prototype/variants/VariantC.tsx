/**
 * THROWAWAY — Variant C: "Bento canvas"
 *
 * - Slot size: 100px (large, generous)
 * - Baseplate: invisible by default, visible during drag
 * - Block: card with shadow + hue header band
 * - Vibe: designer / dashboard cards
 */
import type { Block } from '@skb/grid-engine';
import { totalRows } from '@skb/grid-engine';
import { KIND_GLYPHS, KIND_HUES, KIND_LABELS } from '../sample-data';
import {
  DeleteButton,
  DropGhost,
  ResizeHandles,
  ResizePreview,
} from '../shared-overlays';
import type { Interaction } from '../useGridInteraction';

const SLOT = 100;
const PAD = 6;
const COLS = 12;

export function VariantC({
  interaction,
}: {
  interaction: Interaction;
}): React.JSX.Element {
  const { state, drag, resize } = interaction;
  const rows = totalRows(state) + 3;
  // Show baseplate when actively dragging or resizing
  const showGrid = drag.active || resize.active;
  return (
    <div style={{ display: 'flex', justifyContent: 'center', background: 'oklch(98% 0.005 80)', minHeight: '100vh', padding: '40px 20px' }}>
      <div
        {...interaction.canvasDropProps(SLOT)}
        style={{
          position: 'relative',
          width: `${COLS * SLOT}px`,
          height: `${rows * SLOT}px`,
          background: showGrid
            ? `repeating-linear-gradient(0deg, transparent, transparent ${SLOT - 1}px, oklch(85% 0.01 80) ${SLOT - 1}px, oklch(85% 0.01 80) ${SLOT}px), repeating-linear-gradient(90deg, transparent, transparent ${SLOT - 1}px, oklch(85% 0.01 80) ${SLOT - 1}px, oklch(85% 0.01 80) ${SLOT}px)`
            : 'transparent',
          transition: 'background 150ms',
        }}
      >
        {state.blocks.map((b) => (
          <BentoBlock key={b.id} block={b} interaction={interaction} />
        ))}
        {drag.intent && <DropGhost intent={drag.intent} slotSize={SLOT} padding={PAD} />}
        <ResizePreview interaction={interaction} slotSize={SLOT} padding={PAD} />
        <Caption rows={rows} showGrid={showGrid} />
      </div>
    </div>
  );
}

function BentoBlock({ block, interaction }: { block: Block; interaction: Interaction }): React.JSX.Element {
  const hue = KIND_HUES[block.kind] ?? 'oklch(60% 0.05 0)';
  const isResizing = interaction.resize.active && interaction.resize.blockId === block.id;
  return (
    <div
      data-block-id={block.id}
      data-block-kind={block.kind}
      {...interaction.blockDragProps(block)}
      style={{
        position: 'absolute',
        left: `${block.col * SLOT + PAD}px`,
        top: `${block.row * SLOT + PAD}px`,
        width: `${block.colSpan * SLOT - 2 * PAD}px`,
        height: `${block.rowSpan * SLOT - 2 * PAD}px`,
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 4px 12px oklch(0% 0 0 / 8%), 0 1px 2px oklch(0% 0 0 / 4%)',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'system-ui, sans-serif',
        cursor: 'grab',
        opacity: isResizing ? 0.6 : 1,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 16px',
          background: `color-mix(in oklch, ${hue} 14%, white)`,
          borderBottom: `1px solid color-mix(in oklch, ${hue} 25%, white)`,
        }}
      >
        <div style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: hue, color: 'white', borderRadius: '5px', fontWeight: 700, fontSize: '13px' }}>
          {KIND_GLYPHS[block.kind]}
        </div>
        <span style={{ fontWeight: 600, fontSize: '13px', color: 'oklch(25% 0.02 80)' }}>{KIND_LABELS[block.kind]}</span>
        <span style={{ fontSize: '10px', opacity: 0.4, marginLeft: 'auto', marginRight: '24px' }}>
          {block.colSpan}×{block.rowSpan}
        </span>
      </div>
      <div style={{ flex: 1, padding: '14px 16px', fontSize: '11px', color: 'oklch(35% 0.02 80)', lineHeight: 1.55, overflow: 'hidden' }}>
        {placeholder(block)}
      </div>
      <DeleteButton onClick={() => interaction.ops.remove(block.id)} />
      <ResizeHandles block={block} interaction={interaction} slot={SLOT} />
    </div>
  );
}

function Caption({ rows, showGrid }: { rows: number; showGrid: boolean }): React.JSX.Element {
  return (
    <div style={{ position: 'absolute', bottom: '-30px', left: 0, fontSize: '11px', color: 'oklch(50% 0.02 80)', fontFamily: 'system-ui, sans-serif' }}>
      Variant C — Bento canvas · slot {SLOT}px · {COLS}×{rows} · baseplate {showGrid ? 'visible (drag/resize)' : 'hidden'}
    </div>
  );
}

function placeholder(b: Block): string {
  if (b.kind === 'markdown') return 'Markdown content. Prose explaining a concept.';
  if (b.kind === 'image') return '[image]';
  if (b.kind === 'code') return 'fn example() => 42';
  if (b.kind === 'callout') return 'A callout draws attention.';
  if (b.kind === 'math') return 'E = mc²';
  if (b.kind === 'pdf') return '[PDF]';
  return `[${b.kind}]`;
}
