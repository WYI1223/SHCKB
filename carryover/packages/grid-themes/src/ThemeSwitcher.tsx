/**
 * @skb/grid-themes — floating chip theme switcher.
 *
 * Per ADR-0020 D9:
 * - Bottom-right by default
 * - Production fold hidden by default; show only if the user has
 *   PREVIOUSLY switched theme away from the default. New users see
 *   no UI clutter.
 * - Dev mode (NODE_ENV !== 'production'): always shown.
 *
 * Consumer wires this once at the editor root. Wraps `getUserTheme` /
 * `setUserTheme` from storage.ts so the consumer doesn't need to know
 * about persistence.
 */
import { useEffect, useState } from 'react';
import { listThemes } from './registry';
import { DEFAULT_THEME, getUserTheme, setUserTheme } from './storage';
import type { ThemeKey } from './types';

export type ThemeSwitcherProps = {
  /** Current theme key (controlled). Wire to your app's theme state. */
  current: ThemeKey;
  /** Called when user selects a new theme. Persist + update render. */
  onChange: (key: ThemeKey) => void;
  /** Force show even if production-fold rule would hide. Useful for
   * settings panel "manage theme" toggle. */
  forceShow?: boolean;
};

export function ThemeSwitcher({
  current,
  onChange,
  forceShow = false,
}: ThemeSwitcherProps): React.JSX.Element | null {
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (forceShow) {
      setVisible(true);
      return;
    }
    // Production fold rule: hide unless user has previously switched
    // (i.e., localStorage has a non-default value).
    const isProd =
      typeof process !== 'undefined' && process.env?.NODE_ENV === 'production';
    if (!isProd) {
      setVisible(true);
      return;
    }
    const stored = getUserTheme();
    setVisible(stored !== undefined && stored !== DEFAULT_THEME);
  }, [forceShow]);

  if (!visible) return null;

  const themes = listThemes();
  const curTheme = themes.find((t) => t.key === current);

  function pick(key: ThemeKey): void {
    setUserTheme(key);
    onChange(key);
    setOpen(false);
  }

  return (
    <div
      data-skb-theme-switcher
      style={{
        position: 'fixed',
        right: '20px',
        bottom: '20px',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        zIndex: 9999,
      }}
    >
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            bottom: '40px',
            right: 0,
            background: 'oklch(20% 0.02 80)',
            color: 'white',
            borderRadius: '8px',
            boxShadow: '0 4px 20px oklch(0% 0 0 / 25%)',
            padding: '6px',
            display: 'flex',
            flexDirection: 'column',
            minWidth: '180px',
          }}
        >
          {themes.map((t) => (
            <button
              key={t.key}
              role="menuitemradio"
              aria-checked={t.key === current}
              onClick={() => pick(t.key)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: '2px',
                padding: '8px 10px',
                background:
                  t.key === current ? 'oklch(30% 0.05 240)' : 'transparent',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: '12px',
              }}
            >
              <span style={{ fontWeight: 600 }}>{t.displayName}</span>
              {t.description && (
                <span style={{ opacity: 0.6, fontSize: '10px' }}>
                  {t.description}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        aria-label="Switch grid theme"
        aria-expanded={open}
        style={{
          background: 'oklch(20% 0.02 80)',
          color: 'white',
          border: 'none',
          borderRadius: '999px',
          padding: '8px 14px',
          boxShadow: '0 4px 20px oklch(0% 0 0 / 25%)',
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <span style={{ fontWeight: 600 }}>{curTheme?.displayName ?? current}</span>
        <span style={{ opacity: 0.5 }}>▾</span>
      </button>
    </div>
  );
}
