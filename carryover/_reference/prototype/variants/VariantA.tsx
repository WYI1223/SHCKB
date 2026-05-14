/**
 * THROWAWAY — Variant A: "Graph paper"
 *
 * - Slot size: 60px (denser)
 * - Baseplate: faint dotted lines
 * - Block: 1px border + 2px hue top stripe + white bg
 * - Vibe: clean, technical
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

const SLOT = 60;
const PAD = 4;
const COLS = 12;

export function VariantA({
  interaction,
}: {
  interaction: Interaction;
}): React.JSX.Element {
  const { state, drag } = interaction;
  const rows = totalRows(state) + 3;
  const dotSize = 2;
  return (
    <div style={{ display: 'flex', justifyContent: 'center', background: 'oklch(98% 0.005 80)', minHeight: '100vh', padding: '40px 20px' }}>
      <div
        {...interaction.canvasDropProps(SLOT)}
        style={{
          position: 'relative',
          width: `${COLS * SLOT}px`,
          height: `${rows * SLOT}px`,
          backgroundImage: `radial-gradient(circle, oklch(70% 0.01 80) ${dotSize / 2}px, transparent ${dotSize / 2}px)`,
          backgroundSize: `${SLOT}px ${SLOT}px`,
          backgroundPosition: `${SLOT - dotSize / 2}px ${SLOT - dotSize / 2}px`,
        }}
      >
        {state.blocks.map((b) => (
          <BlockBox key={b.id} block={b} interaction={interaction} />
        ))}
        {drag.intent && <DropGhost intent={drag.intent} slotSize={SLOT} padding={PAD} />}
        <ResizePreview interaction={interaction} slotSize={SLOT} padding={PAD} />
        <Caption rows={rows} />
      </div>
    </div>
  );
}

function BlockBox({ block, interaction }: { block: Block; interaction: Interaction }): React.JSX.Element {
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
        border: '1px solid oklch(85% 0.01 80)',
        borderTop: `2px solid ${hue}`,
        borderRadius: '3px',
        boxSizing: 'border-box',
        padding: '8px 10px',
        fontSize: '12px',
        fontFamily: 'system-ui, sans-serif',
        color: 'oklch(35% 0.02 80)',
        overflow: 'hidden',
        cursor: 'grab',
        opacity: isResizing ? 0.6 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontWeight: 600, color: hue }}>
          {KIND_GLYPHS[block.kind]} {KIND_LABELS[block.kind]}
        </span>
        <span style={{ fontSize: '10px', opacity: 0.5 }}>
          {block.colSpan}×{block.rowSpan}
        </span>
      </div>
      <div style={{ fontSize: '11px', opacity: 0.7, lineHeight: 1.4 }}>{placeholder(block)}</div>
      <DeleteButton onClick={() => interaction.ops.remove(block.id)} />
      <ResizeHandles block={block} interaction={interaction} slot={SLOT} />
    </div>
  );
}

function Caption({ rows }: { rows: number }): React.JSX.Element {
  return (
    <div style={{ position: 'absolute', bottom: '-30px', left: 0, fontSize: '11px', color: 'oklch(50% 0.02 80)', fontFamily: 'system-ui, sans-serif' }}>
      Variant A — Graph paper · slot {SLOT}px · {COLS}×{rows}
    </div>
  );
}

function placeholder(b: Block): string {
  if (b.kind === 'markdown') return 'Markdown text content.';
  if (b.kind === 'image') return '[image]';
  if (b.kind === 'code') return 'fn example() => 42';
  if (b.kind === 'callout') return 'A callout note.';
  if (b.kind === 'math') return 'E = mc²';
  if (b.kind === 'pdf') return '[PDF]';
  return `[${b.kind}]`;
}
