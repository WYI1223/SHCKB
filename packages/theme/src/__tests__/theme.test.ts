import { describe, expect, test } from 'vitest';
import {
  applyCustomization,
  blockCardStyle,
  canvasBaseplateStyle,
  graphPaper,
  ink,
  kindHue,
  sanitizeCustomization,
} from '../themes';
import { DEFAULT_THEME_ID, THEMES } from '../registry';
import { workbench } from '../workbench';
import { blueprint } from '../blueprint';
import { stationery } from '../stationery';

describe('theme registry', () => {
  test('default theme is graph-paper and registered', () => {
    expect(DEFAULT_THEME_ID).toBe('graph-paper');
    expect(THEMES['graph-paper']).toBe(graphPaper);
    expect(THEMES['ink']).toBe(ink);
  });

  test('every theme carries the full token surface', () => {
    for (const t of Object.values(THEMES)) {
      expect(typeof t.id).toBe('string');
      expect(typeof t.name).toBe('string');
      expect(t.slot).toBeGreaterThan(0);
      expect(t.pad).toBeGreaterThanOrEqual(0);
      for (const key of [
        'canvasBg',
        'dotColor',
        'blockBg',
        'blockBorder',
        'blockRadius',
        'textColor',
        'mutedColor',
        'chromeBg',
        'accent',
        'danger',
        'kindHueFallback',
        'codeCss',
        'surfaceInsetBg',
        'hairline',
        'quoteColor',
        'fontFamily',
      ] as const) {
        expect(t[key], `${t.id}.${key}`).toBeTruthy();
      }
      expect(t.kindHues.markdown).toBeTruthy();
      expect(t.kindHues.image).toBeTruthy();
      expect(t.kindHues.code).toBeTruthy();
    }
  });

  test('themes actually diverge', () => {
    expect(graphPaper.canvasBg).not.toBe(ink.canvasBg);
  });

  test('helpers are theme-parametrized', () => {
    expect(kindHue(graphPaper, 'markdown')).toBe(graphPaper.kindHues.markdown);
    expect(kindHue(graphPaper, 'unknown-kind')).toBe(graphPaper.kindHueFallback);
    expect(blockCardStyle(graphPaper, 'markdown').borderTop).toContain(graphPaper.kindHues.markdown);
    expect(canvasBaseplateStyle(ink).backgroundImage).toContain(ink.dotColor);
  });
});

describe('theme customization (M5-D3)', () => {
  test('palette variant applies its tokens, keeps identity and geometry', () => {
    const warm = applyCustomization(workbench, { paletteId: 'warm' });
    expect(warm.id).toBe('workbench');
    expect(warm.accent).toBe(workbench.palettes![0]!.tokens.accent);
    expect(warm.slot).toBe(workbench.slot);
    expect(warm.blockRadius).toBe(workbench.blockRadius);
  });

  test('curated variants never carry geometry tokens', () => {
    for (const t of Object.values(THEMES)) {
      for (const p of t.palettes ?? []) {
        for (const k of ['id', 'name', 'slot', 'pad', 'dotSize', 'blockRadius']) {
          expect(k in p.tokens, `${t.id}/${p.id} must not retune ${k}`).toBe(false);
        }
      }
    }
  });

  test('overrides apply only for whitelisted tokens', () => {
    const out = applyCustomization(graphPaper, {
      overrides: { accent: 'oklch(50% 0.2 0)', canvasBg: 'red' as never },
    });
    expect(out.accent).toBe('oklch(50% 0.2 0)');
    expect(out.canvasBg).toBe(graphPaper.canvasBg); // not whitelisted → ignored
  });

  test('unknown paletteId and empty customization are no-ops', () => {
    expect(applyCustomization(workbench, { paletteId: 'nope' })).toBe(workbench);
    expect(applyCustomization(workbench, {})).toBe(workbench);
    expect(applyCustomization(workbench, undefined)).toBe(workbench);
  });

  test('variant + override compose, override wins', () => {
    const out = applyCustomization(workbench, {
      paletteId: 'forest',
      overrides: { accent: 'oklch(40% 0.1 10)' },
    });
    expect(out.canvasBg).toBe(workbench.palettes![1]!.tokens.canvasBg);
    expect(out.accent).toBe('oklch(40% 0.1 10)');
  });

  test('sanitizeCustomization drops unknown ids/keys, null when empty', () => {
    expect(sanitizeCustomization(workbench, { paletteId: 'warm' })).toEqual({ paletteId: 'warm' });
    expect(sanitizeCustomization(workbench, { paletteId: 'nope' })).toBeNull();
    expect(
      sanitizeCustomization(graphPaper, { overrides: { accent: ' x ', canvasBg: 'red', slot: 99 } }),
    ).toEqual({ overrides: { accent: 'x' } });
    expect(sanitizeCustomization(graphPaper, 'garbage')).toBeNull();
    expect(sanitizeCustomization(blueprint, { paletteId: 'sepia' })).toEqual({ paletteId: 'sepia' });
  });

  test('values that could close the <style> block are rejected at both gates (S1)', () => {
    const payload = '</style><script>alert(1)</script>';
    // sanitize gate: hostile value never enters stored customization
    expect(sanitizeCustomization(graphPaper, { overrides: { accent: payload } })).toBeNull();
    // apply gate: a hostile value already in storage (pre-fix import) is ignored at render
    const out = applyCustomization(graphPaper, { overrides: { accent: payload } });
    expect(out.accent).toBe(graphPaper.accent);
    // plain CSS values are untouched
    expect(
      sanitizeCustomization(graphPaper, { overrides: { fontFamily: '"Iosevka", monospace' } }),
    ).toEqual({ overrides: { fontFamily: '"Iosevka", monospace' } });
  });
});
