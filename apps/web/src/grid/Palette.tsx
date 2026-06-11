/**
 * Insert palette — kinds come from the block registry (D4 seam).
 * Form factor is a dev-layer default, not a product lock
 * (notepage-editing.md: product locks behavior, not form factor).
 */
import { BLOCK_KINDS } from '../blocks/registry';
import { theme } from '../theme/tokens';
import type { Interaction } from './useGridInteraction';

export function Palette({ interaction }: { interaction: Interaction }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: '76px',
        right: '20px',
        background: theme.chromeBg,
        color: 'white',
        padding: '8px 12px',
        borderRadius: '12px',
        boxShadow: '0 4px 20px oklch(0% 0 0 / 25%)',
        fontSize: '12px',
        zIndex: 50,
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
        {Object.values(BLOCK_KINDS).map((mod) => (
          <div
            key={mod.kind}
            {...interaction.paletteDragProps(mod.kind)}
            title={`Drag to insert ${mod.label}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 6px',
              background: `color-mix(in oklch, ${theme.kindHue(mod.kind)} 30%, transparent)`,
              border: `1px solid ${theme.kindHue(mod.kind)}`,
              borderRadius: '4px',
              cursor: 'grab',
              fontSize: '11px',
              userSelect: 'none',
            }}
          >
            <span style={{ fontWeight: 700 }}>{mod.glyph}</span>
            <span style={{ opacity: 0.85, fontSize: '10px' }}>{mod.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
