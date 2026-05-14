/**
 * @skb/grid-themes — built-in theme: LEGO studs.
 *
 * Default theme per ADR-0020 D8. Tactile, brick-like; baseplate shows
 * a visible "stud" dot at every (col, row) intersection + light cell
 * border lines. Block bodies are hue-tinted (very soft) with light
 * border. Slot size 80px.
 *
 * Lifted from `apps/site/src/components/_grid-prototype/variants/VariantB.tsx`
 * (PR #120/121 prototype). Polished for production: no inline styles
 * for chrome, no kind label inline (block content is the actual content
 * not a kind preview), CSS via cssVars.
 */
import type { GridTheme } from '../types';
import {
  baseplateStyle,
  blockStyle,
  dropPreviewStyle,
  KIND_HUE_VARS,
} from './shared';

const SLOT = 80;
const STUD = 6;

export const legoStudsTheme: GridTheme = {
  key: 'lego-studs',
  displayName: 'LEGO studs',
  description: 'Tactile brick-on-baseplate; default theme. Visible studs + cell borders.',
  slotSize: SLOT,
  cssVars: {
    '--skb-slot-size': `${SLOT}px`,
    '--skb-baseplate-bg': 'oklch(96% 0.005 80)',
    '--skb-baseplate-stud': 'oklch(70% 0.02 80)',
    '--skb-baseplate-line': 'oklch(85% 0.005 80)',
    '--skb-block-bg-blend': '12%', // hue tint mix-fraction
    '--skb-block-border': 'oklch(80% 0.01 80)',
    '--skb-block-radius': '4px',
    '--skb-block-shadow': '0 1px 3px oklch(0% 0 0 / 6%)',
    '--skb-drop-ghost-valid': 'oklch(60% 0.15 145)',
    '--skb-drop-ghost-invalid': 'oklch(60% 0.20 25)',
    ...KIND_HUE_VARS,
  },
  renderBaseplate({ slotSize }) {
    return (
      <div
        data-skb-baseplate="lego-studs"
        style={{
          ...baseplateStyle(slotSize),
          background: 'var(--skb-baseplate-bg)',
          backgroundImage: `
            radial-gradient(circle at center, var(--skb-baseplate-stud) ${STUD / 2}px, transparent ${STUD / 2}px),
            linear-gradient(to right, var(--skb-baseplate-line) 1px, transparent 1px),
            linear-gradient(to bottom, var(--skb-baseplate-line) 1px, transparent 1px)
          `,
          backgroundSize: `${slotSize}px ${slotSize}px`,
          boxShadow: 'inset 0 0 0 1px var(--skb-baseplate-line)',
        }}
      />
    );
  },
  renderBlock({ block, isDragging, isResizing, children }) {
    const kindHue = `var(--skb-kind-${block.kind})`;
    return (
      <div
        data-skb-theme-block="lego-studs"
        data-skb-block-kind={block.kind}
        style={{
          ...blockStyle(block, SLOT, 0),
          background: `color-mix(in oklch, ${kindHue} var(--skb-block-bg-blend), white)`,
          border: '1px solid var(--skb-block-border)',
          borderRadius: 'var(--skb-block-radius)',
          boxShadow: 'var(--skb-block-shadow)',
          opacity: isResizing ? 0.6 : 1,
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
      >
        {children}
      </div>
    );
  },
  renderDropPreview({ col, row, colSpan, rowSpan, isValid, slotSize }) {
    return (
      <div
        data-skb-drop-ghost="lego-studs"
        style={{
          ...dropPreviewStyle(col, row, colSpan, rowSpan, slotSize, 0),
          border: `2px dashed ${isValid ? 'var(--skb-drop-ghost-valid)' : 'var(--skb-drop-ghost-invalid)'}`,
          background: isValid
            ? 'oklch(80% 0.10 145 / 22%)'
            : 'oklch(80% 0.15 25 / 22%)',
          borderRadius: 'var(--skb-block-radius)',
        }}
      />
    );
  },
};
