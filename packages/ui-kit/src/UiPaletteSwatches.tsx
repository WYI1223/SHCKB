/**
 * Palette variant picker (MVP-5 M5-D3): one chip per theme-curated
 * variant, each showing its color identity as dots. Selection is
 * exclusive; "base" (no variant) is always offered first.
 */
import { useTheme } from '@skb/theme';

export type UiPaletteSwatchesProps = {
  /** Variant chips; swatch = representative colors (3-4 work best). */
  variants: Array<{ id: string; name: string; swatch: string[] }>;
  /** Currently selected variant id; null = theme base. */
  selected: string | null;
  onSelect: (id: string | null) => void;
  /** Swatch colors for the base (no-variant) chip. */
  baseSwatch: string[];
};

export function UiPaletteSwatches({ variants, selected, onSelect, baseSwatch }: UiPaletteSwatchesProps) {
  const theme = useTheme();

  function chip(id: string | null, name: string, swatch: string[]) {
    const active = selected === id;
    return (
      <button
        key={id ?? '__base'}
        className="skb-ui-swatch"
        onClick={() => onSelect(id)}
        title={name}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          padding: '3px 7px',
          fontSize: '11px',
          fontFamily: 'inherit',
          color: theme.textColor,
          background: theme.surfaceInsetBg,
          border: `1px solid ${active ? theme.accent : theme.hairline}`,
          boxShadow: active ? `0 0 0 1px ${theme.accent}` : 'none',
          borderRadius: '999px',
          cursor: 'pointer',
        }}
      >
        <span style={{ display: 'inline-flex', gap: '2px' }}>
          {swatch.map((color, i) => (
            <span
              key={i}
              style={{
                width: '9px',
                height: '9px',
                borderRadius: '50%',
                background: color,
                border: `1px solid ${theme.hairline}`,
              }}
            />
          ))}
        </span>
        {name}
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
      {chip(null, 'Base', baseSwatch)}
      {variants.map((v) => chip(v.id, v.name, v.swatch))}
    </div>
  );
}
