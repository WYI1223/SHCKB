/**
 * @skb/grid-themes — built-in theme: Bento canvas.
 *
 * Designer / dashboard cards. Baseplate invisible by default — visible
 * only when `dragInProgress`. Block bodies are rounded cards with shadow
 * + kind-hue header band. Slot size 100px.
 *
 * Lifted from `apps/site/src/components/_grid-prototype/variants/VariantC.tsx`.
 * Block header rendering is theme-specific: header band is computed
 * outside the `children` slot. Consumer is responsible for hiding any
 * header it would otherwise inject (theme owns the chrome).
 */
import type { GridTheme } from '../types';
import {
  baseplateStyle,
  blockStyle,
  dropPreviewStyle,
  KIND_HUE_VARS,
} from './shared';

const SLOT = 100;
const PAD = 6;

export const bentoCanvasTheme: GridTheme = {
  key: 'bento-canvas',
  displayName: 'Bento canvas',
  description: 'Designer / dashboard cards. Baseplate hidden when idle; rounded shadowed blocks with kind-hue header.',
  slotSize: SLOT,
  cssVars: {
    '--skb-slot-size': `${SLOT}px`,
    '--skb-baseplate-bg': 'transparent',
    '--skb-baseplate-line': 'oklch(85% 0.01 80)',
    '--skb-block-bg': 'white',
    '--skb-block-shadow':
      '0 4px 12px oklch(0% 0 0 / 8%), 0 1px 2px oklch(0% 0 0 / 4%)',
    '--skb-block-radius': '12px',
    '--skb-drop-ghost-valid': 'oklch(60% 0.15 145)',
    '--skb-drop-ghost-invalid': 'oklch(60% 0.20 25)',
    ...KIND_HUE_VARS,
  },
  renderBaseplate({ slotSize, dragInProgress }) {
    return (
      <div
        data-skb-baseplate="bento-canvas"
        data-skb-baseplate-visible={dragInProgress ? 'true' : 'false'}
        style={{
          ...baseplateStyle(slotSize),
          background: dragInProgress
            ? `repeating-linear-gradient(0deg, transparent, transparent ${slotSize - 1}px, var(--skb-baseplate-line) ${slotSize - 1}px, var(--skb-baseplate-line) ${slotSize}px), repeating-linear-gradient(90deg, transparent, transparent ${slotSize - 1}px, var(--skb-baseplate-line) ${slotSize - 1}px, var(--skb-baseplate-line) ${slotSize}px)`
            : 'transparent',
          transition: 'background 150ms',
        }}
      />
    );
  },
  renderBlock({ block, isDragging, isResizing, children }) {
    const kindHue = `var(--skb-kind-${block.kind})`;
    return (
      <div
        data-skb-theme-block="bento-canvas"
        data-skb-block-kind={block.kind}
        style={{
          ...blockStyle(block, SLOT, PAD),
          background: 'var(--skb-block-bg)',
          borderRadius: 'var(--skb-block-radius)',
          boxShadow: 'var(--skb-block-shadow)',
          opacity: isResizing ? 0.6 : 1,
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
      >
        <div
          data-skb-bento-header
          style={{
            padding: '8px 14px',
            background: `color-mix(in oklch, ${kindHue} 14%, white)`,
            borderBottom: `1px solid color-mix(in oklch, ${kindHue} 25%, white)`,
            fontFamily: 'system-ui, sans-serif',
            fontSize: '12px',
            fontWeight: 600,
            color: 'oklch(25% 0.02 80)',
            textTransform: 'capitalize',
          }}
        >
          {block.kind.replace('-', ' ')}
        </div>
        <div data-skb-bento-body style={{ padding: '12px 14px' }}>
          {children}
        </div>
      </div>
    );
  },
  renderDropPreview({ col, row, colSpan, rowSpan, isValid, slotSize }) {
    return (
      <div
        data-skb-drop-ghost="bento-canvas"
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
