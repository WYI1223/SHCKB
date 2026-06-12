/**
 * Theme customization studio (MVP-5 M5-D3) — admin picks within what
 * the instance theme curates: palette variants + whitelisted token
 * overrides. Anything accepted re-renders all published pages (same
 * invariant as a theme switch), so every write confirms first.
 */
import { THEMES, type Theme, type ThemeCustomization } from '@skb/theme';
import { UiPaletteSwatches, UiSelect } from '@skb/ui-kit';
import { api } from '../api/client';
import { BENCH, labelStyle } from '../chrome/bench';
import { useOverlays } from '../chrome/overlays';

const FONT_PRESETS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Font: theme default' },
  { value: 'system-ui, sans-serif', label: 'Font: System' },
  { value: 'Georgia, "Times New Roman", serif', label: 'Font: Serif' },
  { value: "'Segoe Print', 'KaiTi', '楷体', 'STKaiti', 'Comic Sans MS', cursive", label: 'Font: Handwriting' },
  { value: 'ui-monospace, Consolas, monospace', label: 'Font: Monospace' },
];

function variantSwatch(theme: Theme, tokens: Record<string, unknown>): string[] {
  const pick = (key: 'canvasBg' | 'accent' | 'chromeBg') =>
    typeof tokens[key] === 'string' ? (tokens[key] as string) : theme[key];
  return [pick('canvasBg'), pick('accent'), pick('chromeBg')];
}

export function ThemeStudio({
  themeId,
  customizations,
  refresh,
}: {
  themeId: string;
  customizations: Record<string, ThemeCustomization>;
  refresh: () => void;
}) {
  const overlays = useOverlays();
  const theme = THEMES[themeId];
  if (!theme) return null;
  const hasPalettes = (theme.palettes ?? []).length > 0;
  const fontOpen = theme.customizableTokens?.includes('fontFamily') ?? false;

  const current = customizations[themeId];

  async function put(next: ThemeCustomization | null) {
    const ok = await overlays.confirm({
      title: 'theme customization',
      message: 'Apply theme customization? All published pages re-render.',
      confirmLabel: 'apply',
    });
    if (!ok) return;
    await api.setThemeCustomization(themeId, next);
    refresh();
  }

  /** Merge a patch; collapse to null (clear) when nothing remains. */
  function compose(patch: Partial<ThemeCustomization>): ThemeCustomization | null {
    const next: ThemeCustomization = { ...current, ...patch };
    if (next.paletteId === undefined) delete next.paletteId;
    if (next.overrides && Object.keys(next.overrides).length === 0) delete next.overrides;
    return next.paletteId !== undefined || next.overrides !== undefined ? next : null;
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        padding: '7px 8px 8px',
        border: `1px solid ${BENCH.hairlineDark}`,
        borderRadius: '2px',
        background: BENCH.paper,
      }}
    >
      <span style={labelStyle()}>Theme studio · {theme.name}</span>
      {!hasPalettes && !fontOpen && (
        // Always visible (discoverability — owner couldn't find the
        // studio under a theme that curates nothing): say WHY it's empty.
        <span style={{ fontSize: '11px', color: BENCH.inkFaint, fontStyle: 'italic' }}>
          This theme curates no palettes or open tokens yet.
        </span>
      )}
      {hasPalettes && (
        <UiPaletteSwatches
          variants={(theme.palettes ?? []).map((p) => ({
            id: p.id,
            name: p.name,
            swatch: variantSwatch(theme, p.tokens as Record<string, unknown>),
          }))}
          selected={current?.paletteId ?? null}
          onSelect={(id) => void put(compose({ paletteId: id ?? undefined }))}
          baseSwatch={[theme.canvasBg, theme.accent, theme.chromeBg]}
        />
      )}
      {fontOpen && (
        <UiSelect
          value={current?.overrides?.fontFamily ?? ''}
          onChange={(value) => {
            const overrides = { ...current?.overrides };
            if (value === '') delete overrides.fontFamily;
            else overrides.fontFamily = value;
            void put(compose({ overrides }));
          }}
          options={FONT_PRESETS}
          title="Body font (theme whitelists this token)"
        />
      )}
    </div>
  );
}
