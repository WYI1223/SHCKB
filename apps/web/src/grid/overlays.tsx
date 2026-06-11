/**
 * Theme-agnostic editing chrome lifted from the prototype: delete
 * button, resize handles (4 edges + 2 corners), drop ghost, resize
 * preview.
 */
import type { Block } from '@skb/grid-engine';
import { useTheme } from '@skb/theme';
import type { Interaction, ResizeAxis } from './useGridInteraction';

const HANDLE_BG = 'oklch(60% 0.12 240 / 70%)';

export function DeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onDragStart={(e) => e.preventDefault()}
      style={{
        position: 'absolute',
        top: '4px',
        right: '4px',
        width: '18px',
        height: '18px',
        border: 'none',
        background: 'oklch(55% 0.18 25 / 80%)',
        color: 'white',
        borderRadius: '50%',
        cursor: 'pointer',
        fontSize: '12px',
        lineHeight: 1,
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 5,
      }}
      aria-label="Delete block"
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
    style = { ...common, right: 0, top: '50%', transform: 'translateY(-50%)', width: '6px', height: '24px', borderRadius: '3px 0 0 3px' };
  } else if (axis === 'left') {
    style = { ...common, left: 0, top: '50%', transform: 'translateY(-50%)', width: '6px', height: '24px', borderRadius: '0 3px 3px 0' };
  } else if (axis === 'bottom') {
    style = { ...common, bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '24px', height: '6px', borderRadius: '3px 3px 0 0' };
  } else if (axis === 'top') {
    style = { ...common, top: 0, left: '50%', transform: 'translateX(-50%)', width: '24px', height: '6px', borderRadius: '0 0 3px 3px' };
  } else if (axis === 'corner') {
    style = { ...common, bottom: 0, right: 0, width: '10px', height: '10px', borderRadius: '3px 0 0 0' };
  } else {
    style = { ...common, top: 0, left: 0, width: '10px', height: '10px', borderRadius: '0 0 3px 0' };
  }
  return (
    <div
      onPointerDown={(e) => interaction.beginResize(e, block, axis, slot)}
      onDragStart={(e) => e.preventDefault()}
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
        border: valid ? '2px dashed oklch(60% 0.15 145)' : '2px dashed oklch(60% 0.20 25)',
        background: valid ? 'oklch(80% 0.10 145 / 22%)' : 'oklch(80% 0.15 25 / 22%)',
        borderRadius: '6px',
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
  const theme = useTheme();
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
        border: `2px dashed ${theme.accent}`,
        borderRadius: '6px',
        pointerEvents: 'none',
        background: 'oklch(70% 0.10 240 / 15%)',
        zIndex: 3,
      }}
      data-skb-resize-preview
    />
  );
}
