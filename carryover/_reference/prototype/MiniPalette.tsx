/**
 * THROWAWAY — shared floating palette for inserting new blocks via drag.
 *
 * Theme-agnostic chrome (subtle dark pill, similar to the variant
 * switcher). Drag a chip onto the canvas → hole-fill smart placement
 * via inferDropIntent → insertBlock.
 */
import type { BlockKind } from '@skb/grid-engine';
import { KIND_GLYPHS, KIND_HUES, KIND_LABELS } from './sample-data';
import type { Interaction } from './useGridInteraction';

const KINDS: BlockKind[] = [
  'markdown',
  'image',
  'code',
  'callout',
  'math',
  'pdf',
  'jupyter',
  'nn-viz',
  'agent-flow',
];

export function MiniPalette({
  interaction,
}: {
  interaction: Interaction;
}): React.JSX.Element {
  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        background: 'oklch(20% 0.02 80)',
        color: 'white',
        padding: '8px 12px',
        borderRadius: '12px',
        boxShadow: '0 4px 20px oklch(0% 0 0 / 25%)',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        maxWidth: '180px',
      }}
    >
      <div style={{ opacity: 0.7, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Drag to insert
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {KINDS.map((kind) => (
          <PaletteChip key={kind} kind={kind} interaction={interaction} />
        ))}
      </div>
      <label
        style={{
          marginTop: '6px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '11px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <input
          type="checkbox"
          checked={interaction.gravityEnabled}
          onChange={(e) => interaction.setGravityEnabled(e.target.checked)}
          style={{ accentColor: 'oklch(60% 0.15 240)' }}
        />
        <span>
          Gravity{' '}
          <span style={{ opacity: 0.6, fontSize: '10px' }}>
            ({interaction.gravityEnabled ? 'pull up' : 'free placement'})
          </span>
        </span>
      </label>
      <button
        onClick={() => interaction.ops.reset()}
        style={{
          background: 'transparent',
          color: 'oklch(70% 0.05 80)',
          border: '1px solid oklch(40% 0.02 80)',
          borderRadius: '6px',
          padding: '4px 8px',
          fontSize: '11px',
          cursor: 'pointer',
        }}
      >
        Reset to sample
      </button>
    </div>
  );
}

function PaletteChip({
  kind,
  interaction,
}: {
  kind: BlockKind;
  interaction: Interaction;
}): React.JSX.Element {
  const hue = KIND_HUES[kind] ?? 'oklch(60% 0.05 0)';
  return (
    <div
      {...interaction.paletteDragProps(kind)}
      title={`Drag to insert ${KIND_LABELS[kind]}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px 6px',
        background: `color-mix(in oklch, ${hue} 30%, transparent)`,
        border: `1px solid ${hue}`,
        borderRadius: '4px',
        cursor: 'grab',
        fontSize: '11px',
        userSelect: 'none',
      }}
    >
      <span style={{ fontWeight: 700 }}>{KIND_GLYPHS[kind]}</span>
      <span style={{ opacity: 0.85, fontSize: '10px' }}>{KIND_LABELS[kind]}</span>
    </div>
  );
}
