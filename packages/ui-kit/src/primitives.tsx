/**
 * Themed form primitives (MVP-5 M5-D5) — the shared control vocabulary
 * for host chrome, block-kind tools, and theme customization UI.
 * Plugins compose these instead of inventing their own controls, so
 * every theme styles all of them at once through tokens.
 *
 * Pure token consumers: no context of their own, no globalCss — just
 * useTheme() reads (TDZ-safe by construction: ui-kit never appears
 * inside a theme definition).
 */
import type { CSSProperties, ReactNode } from 'react';
import { useTheme } from '@skb/theme';

function controlBase(theme: ReturnType<typeof useTheme>): CSSProperties {
  // Controls follow the theme's corner language but cap at 8px — a
  // pill-radius block theme shouldn't produce pill-shaped inputs.
  const parsed = parseInt(theme.blockRadius, 10);
  return {
    background: theme.surfaceInsetBg,
    color: theme.textColor,
    border: `1px solid ${theme.hairline}`,
    borderRadius: Number.isFinite(parsed) ? `${Math.min(parsed, 8)}px` : theme.blockRadius,
    fontSize: '11px',
    padding: '3px 6px',
    fontFamily: 'inherit',
  };
}

export type UiSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  title?: string;
  disabled?: boolean;
};

export function UiSelect({ value, onChange, options, title, disabled }: UiSelectProps) {
  const theme = useTheme();
  return (
    <select
      className="skb-ui-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      title={title}
      disabled={disabled}
      style={{ ...controlBase(theme), cursor: disabled ? 'default' : 'pointer' }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export type UiButtonProps = {
  onClick: () => void;
  children: ReactNode;
  variant?: 'default' | 'accent' | 'danger';
  title?: string;
  disabled?: boolean;
};

export function UiButton({ onClick, children, variant = 'default', title, disabled }: UiButtonProps) {
  const theme = useTheme();
  const tint = variant === 'accent' ? theme.accent : variant === 'danger' ? theme.danger : null;
  return (
    <button
      className="skb-ui-button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{
        ...controlBase(theme),
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        ...(tint
          ? {
              border: `1px solid ${tint}`,
              color: tint,
              background: `color-mix(in oklch, ${tint} 12%, transparent)`,
            }
          : {}),
      }}
    >
      {children}
    </button>
  );
}

export type UiTextInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** monospace content (hashes, code-ish values) */
  mono?: boolean;
  title?: string;
};

export function UiTextInput({ value, onChange, placeholder, mono, title }: UiTextInputProps) {
  const theme = useTheme();
  return (
    <input
      className="skb-ui-text-input"
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      title={title}
      style={{
        ...controlBase(theme),
        width: '100%',
        boxSizing: 'border-box',
        ...(mono ? { fontFamily: 'ui-monospace, monospace' } : {}),
      }}
    />
  );
}

export type UiToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
};

export function UiToggle({ checked, onChange, label }: UiToggleProps) {
  const theme = useTheme();
  return (
    <label
      className="skb-ui-toggle"
      style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: theme.textColor, cursor: 'pointer' }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: theme.accent, margin: 0 }}
      />
      {label}
    </label>
  );
}
