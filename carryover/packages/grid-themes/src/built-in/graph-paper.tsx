/**
 * @skb/grid-themes — built-in theme: Graph paper.
 *
 * Technical, clean. Faint dotted baseplate; 1px block borders + 2px
 * top stripe in kind hue. Slot size 60px.
 *
 * Lifted from `apps/site/src/components/_grid-prototype/variants/VariantA.tsx`.
 */
import type { GridTheme } from '../types';
import {
  baseplateStyle,
  blockStyle,
  dropPreviewStyle,
  KIND_HUE_VARS,
} from './shared';

const SLOT = 60;
const PAD = 4;
const DOT = 2;

export const graphPaperTheme: GridTheme = {
  key: 'graph-paper',
  displayName: 'Graph paper',
  description: 'Technical / engineering grid; faint dotted baseplate, thin block borders with kind-colored top stripe.',
  slotSize: SLOT,
  cssVars: {
    '--skb-slot-size': `${SLOT}px`,
    '--skb-baseplate-bg': 'oklch(98% 0.005 80)',
    '--skb-baseplate-dot': 'oklch(70% 0.01 80)',
    '--skb-block-bg': 'white',
    '--skb-block-border': 'oklch(85% 0.01 80)',
    '--skb-block-radius': '3px',
    '--skb-drop-ghost-valid': 'oklch(60% 0.15 145)',
    '--skb-drop-ghost-invalid': 'oklch(60% 0.20 25)',
    ...KIND_HUE_VARS,
  },
  renderBaseplate({ slotSize }) {
    return (
      <div
        data-skb-baseplate="graph-paper"
        style={{
          ...baseplateStyle(slotSize),
          background: 'var(--skb-baseplate-bg)',
          backgroundImage: `radial-gradient(circle, var(--skb-baseplate-dot) ${DOT / 2}px, transparent ${DOT / 2}px)`,
          backgroundSize: `${slotSize}px ${slotSize}px`,
          backgroundPosition: `${slotSize - DOT / 2}px ${slotSize - DOT / 2}px`,
        }}
      />
    );
  },
  renderBlock({ block, isDragging, isResizing, children }) {
    const kindHue = `var(--skb-kind-${block.kind})`;
    return (
      <div
        data-skb-theme-block="graph-paper"
        data-skb-block-kind={block.kind}
        style={{
          ...blockStyle(block, SLOT, PAD),
          background: 'var(--skb-block-bg)',
          border: '1px solid var(--skb-block-border)',
          borderTop: `2px solid ${kindHue}`,
          borderRadius: 'var(--skb-block-radius)',
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
        data-skb-drop-ghost="graph-paper"
        style={{
          ...dropPreviewStyle(col, row, colSpan, rowSpan, slotSize, PAD),
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
