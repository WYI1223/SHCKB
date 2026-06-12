/**
 * Editing chrome on the sheet — every mark here is author-only
 * instrumentation, so it follows the two-channel rule: non-photo blue
 * for placement/resize marks, registration red only for "this will
 * not work" (invalid drop) and the destructive delete. Marks reveal on
 * hover (.pu-mark) — the sheet stays quiet until the hand approaches.
 */
import type { Block } from '@skb/grid-engine';
import { BENCH } from '../chrome/bench';
import type { Interaction, ResizeAxis } from './useGridInteraction';

const HANDLE_BG = 'rgba(91, 168, 196, 0.85)'; // non-photo blue, near-solid

export function DeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onDragStart={(e) => e.preventDefault()}
      className="pu-mark"
      style={{
        position: 'absolute',
        top: '-15px',
        right: '2px',
        width: '14px',
        height: '14px',
        border: 'none',
        background: 'transparent',
        color: BENCH.red,
        cursor: 'pointer',
        fontSize: '12px',
        fontFamily: BENCH.fontMono,
        lineHeight: 1,
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 5,
      }}
      aria-label="Delete block"
      title="Delete block"
    >
      ×
    </button>
  );
}

function ResizeHandle({
  axis,
  block,
  interaction,
  slot,
}: {
  axis: ResizeAxis;
  block: Block;
  interaction: Interaction;
  slot: number;
}) {
  const cursor =
    axis === 'right' || axis === 'left'
      ? 'ew-resize'
      : axis === 'bottom' || axis === 'top'
        ? 'ns-resize'
        : 'nwse-resize';
  const common: React.CSSProperties = {
    position: 'absolute',
    background: HANDLE_BG,
    cursor,
    zIndex: 4,
  };
  let style: React.CSSProperties;
  if (axis === 'right') {
    style = { ...common, right: '-2px', top: '50%', transform: 'translateY(-50%)', width: '4px', height: '22px' };
  } else if (axis === 'left') {
    style = { ...common, left: '-2px', top: '50%', transform: 'translateY(-50%)', width: '4px', height: '22px' };
  } else if (axis === 'bottom') {
    style = { ...common, bottom: '-2px', left: '50%', transform: 'translateX(-50%)', width: '22px', height: '4px' };
  } else if (axis === 'top') {
    style = { ...common, top: '-2px', left: '50%', transform: 'translateX(-50%)', width: '22px', height: '4px' };
  } else if (axis === 'corner') {
    style = { ...common, bottom: '-2px', right: '-2px', width: '9px', height: '9px' };
  } else {
    style = { ...common, top: '-2px', left: '-2px', width: '9px', height: '9px' };
  }
  return (
    <div
      onPointerDown={(e) => interaction.beginResize(e, block, axis, slot)}
      onDragStart={(e) => e.preventDefault()}
      className="pu-mark"
      style={style}
      aria-label={`Resize ${axis}`}
    />
  );
}

export function ResizeHandles({
  block,
  interaction,
  slot,
}: {
  block: Block;
  interaction: Interaction;
  slot: number;
}) {
  return (
    <>
      <ResizeHandle axis="top" block={block} interaction={interaction} slot={slot} />
      <ResizeHandle axis="right" block={block} interaction={interaction} slot={slot} />
      <ResizeHandle axis="bottom" block={block} interaction={interaction} slot={slot} />
      <ResizeHandle axis="left" block={block} interaction={interaction} slot={slot} />
      <ResizeHandle axis="corner" block={block} interaction={interaction} slot={slot} />
      <ResizeHandle axis="top-left" block={block} interaction={interaction} slot={slot} />
    </>
  );
}

export function DropGhost({
  intent,
  slotSize,
  padding,
}: {
  intent: NonNullable<Interaction['drag']['intent']>;
  slotSize: number;
  padding: number;
}) {
  const valid = intent.intent === 'place';
  return (
    <div
      style={{
        position: 'absolute',
        left: `${intent.col * slotSize + padding}px`,
        top: `${intent.row * slotSize + padding}px`,
        width: `${Math.max(intent.colSpan, 1) * slotSize - 2 * padding}px`,
        height: `${Math.max(intent.rowSpan, 1) * slotSize - 2 * padding}px`,
        border: valid ? `1px dashed ${BENCH.blue}` : `1px dashed ${BENCH.red}`,
        background: valid ? BENCH.blueWash : BENCH.redWash,
        pointerEvents: 'none',
        zIndex: 3,
      }}
      data-skb-drop-ghost
    />
  );
}

export function ResizePreview({
  interaction,
  slotSize,
  padding,
}: {
  interaction: Interaction;
  slotSize: number;
  padding: number;
}) {
  const { resize } = interaction;
  if (!resize.active || resize.blockId === null) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: `${resize.previewCol * slotSize + padding}px`,
        top: `${resize.previewRow * slotSize + padding}px`,
        width: `${resize.previewW * slotSize - 2 * padding}px`,
        height: `${resize.previewH * slotSize - 2 * padding}px`,
        border: `1px dashed ${BENCH.blue}`,
        background: BENCH.blueWash,
        pointerEvents: 'none',
        zIndex: 3,
      }}
      data-skb-resize-preview
    />
  );
}
