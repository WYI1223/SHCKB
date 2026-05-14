/**
 * THROWAWAY — Variant B: "LEGO studs"
 *
 * - Slot size: 80px (chunky, tactile)
 * - Baseplate: visible studs + cell border lines
 * - Block: hue-tinted background + light border
 * - Vibe: tactile, playful, brick
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

const SLOT = 80;
const PAD = 0;
const COLS = 12;
const STUD = 6;

export function VariantB({
  interaction,
}: {
  interaction: Interaction;
}): React.JSX.Element {
  const { state, drag } = interaction;
  const rows = totalRows(state) + 3;
  return (
    <div style={{ display: 'flex', justifyContent: 'center', background: 'oklch(94% 0.005 80)', minHeight: '100vh', padding: '40px 20px' }}>
      <div
        {...interaction.canvasDropProps(SLOT)}
        style={{
          position: 'relative',
          width: `${COLS * SLOT}px`,
          height: `${rows * SLOT}px`,
          background: 'oklch(96% 0.005 80)',
          backgroundImage: `
            radial-gradient(circle at center, oklch(70% 0.02 80) ${STUD / 2}px, transparent ${STUD / 2}px),
            linear-gradient(to right, oklch(85% 0.005 80) 1px, transparent 1px),
            linear-gradient(to bottom, oklch(85% 0.005 80) 1px, transparent 1px)
          `,
          backgroundSize: `${SLOT}px ${SLOT}px`,
          borderRadius: '6px',
          boxShadow: 'inset 0 0 0 1px oklch(85% 0.005 80)',
        }}
      >
        {state.blocks.map((b) => (
          <BrickBlock key={b.id} block={b} interaction={interaction} />
        ))}
        {drag.intent && <DropGhost intent={drag.intent} slotSize={SLOT} padding={PAD} />}
        <ResizePreview interaction={interaction} slotSize={SLOT} padding={PAD} />
        <Caption rows={rows} />
      </div>
    </div>
  );
}

function BrickBlock({ block, interaction }: { block: Block; interaction: Interaction }): React.JSX.Element {
  const hue = KIND_HUES[block.kind] ?? 'oklch(60% 0.05 0)';
  const isResizing = interaction.resize.active && interaction.resize.blockId === block.id;
  return (
    <div
      data-block-id={block.id}
      data-block-kind={block.kind}
      {...interaction.blockDragProps(block)}
      style={{
        position: 'absolute',
        left: `${block.col * SLOT}px`,
        top: `${block.row * SLOT}px`,
        width: `${block.colSpan * SLOT}px`,
        height: `${block.rowSpan * SLOT}px`,
        background: `color-mix(in oklch, ${hue} 12%, white)`,
        border: '1px solid oklch(80% 0.01 80)',
        borderRadius: '4px',
        boxSizing: 'border-box',
        padding: '12px 16px',
        fontSize: '12px',
        fontFamily: 'system-ui, sans-serif',
        color: 'oklch(30% 0.02 80)',
        overflow: 'hidden',
        cursor: 'grab',
        boxShadow: '0 1px 3px oklch(0% 0 0 / 6%)',
        opacity: isResizing ? 0.6 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '6px' }}>
        <span style={{ fontSize: '20px', color: hue, fontWeight: 700, lineHeight: 1 }}>{KIND_GLYPHS[block.kind]}</span>
        <span style={{ fontWeight: 600, fontSize: '13px' }}>{KIND_LABELS[block.kind]}</span>
        <span style={{ fontSize: '10px', opacity: 0.45, marginLeft: 'auto', marginRight: '24px' }}>
          {block.colSpan}×{block.rowSpan}
        </span>
      </div>
      <div style={{ fontSize: '11px', opacity: 0.7, lineHeight: 1.5 }}>{placeholder(block)}</div>
      <DeleteButton onClick={() => interaction.ops.remove(block.id)} />
      <ResizeHandles block={block} interaction={interaction} slot={SLOT} />
    </div>
  );
}

function Caption({ rows }: { rows: number }): React.JSX.Element {
  return (
    <div style={{ position: 'absolute', bottom: '-30px', left: 0, fontSize: '11px', color: 'oklch(50% 0.02 80)', fontFamily: 'system-ui, sans-serif' }}>
      Variant B — LEGO studs · slot {SLOT}px · {COLS}×{rows}
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
