/**
 * The galley tray — block kinds as labeled tiles docked to the light
 * table's left edge (inserting is a canvas act, not a navigation act).
 * Kinds come from the block registry (D4 seam); the host purely
 * iterates it, zero hardcoding. Bench voice: tiles are chrome, the
 * drag affordance is non-photo blue.
 */
import { BLOCK_KINDS } from '@skb/block-kinds';
import { BENCH, labelStyle } from '../chrome/bench';
import type { Interaction } from './useGridInteraction';

export function Palette({ interaction }: { interaction: Interaction }) {
  return (
    <div
      aria-label="Insert blocks"
      style={{
        width: '66px',
        flexShrink: 0,
        background: BENCH.paper,
        borderRight: `1px solid ${BENCH.hairlineDark}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        padding: '12px 0',
        overflow: 'auto',
      }}
    >
      <span style={labelStyle({ fontSize: '8px' })}>insert</span>
      {Object.values(BLOCK_KINDS).map((mod) => (
        <div
          key={mod.kind}
          {...interaction.paletteDragProps(mod.kind)}
          title={`Drag onto the sheet to insert ${mod.label}`}
          className="pu-hoverable"
          style={{
            width: '50px',
            height: '50px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3px',
            background: BENCH.paperRaised,
            border: `1px solid ${BENCH.hairlineDark}`,
            borderRadius: '2px',
            cursor: 'grab',
            userSelect: 'none',
            color: BENCH.inkSoft,
          }}
        >
          <span style={{ fontSize: '16px', lineHeight: 1, fontWeight: 600 }}>{mod.glyph}</span>
          <span
            style={{
              fontFamily: BENCH.fontMono,
              fontSize: '8px',
              letterSpacing: '0.06em',
              textTransform: 'lowercase',
            }}
          >
            {mod.label}
          </span>
        </div>
      ))}
    </div>
  );
}
