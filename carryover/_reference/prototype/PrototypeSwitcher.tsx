/**
 * THROWAWAY — floating bottom switcher bar for cycling between UI variants.
 * Hidden in production builds.
 */
import { useEffect } from 'react';

export const VARIANTS = [
  { key: 'A', name: 'Graph paper' },
  { key: 'B', name: 'LEGO studs' },
  { key: 'C', name: 'Bento canvas' },
] as const;

export type VariantKey = (typeof VARIANTS)[number]['key'];

export function getCurrentVariant(): VariantKey {
  if (typeof window === 'undefined') return 'A';
  const param = new URLSearchParams(window.location.search).get('variant');
  if (param && VARIANTS.some((v) => v.key === param)) return param as VariantKey;
  return 'A';
}

export function setVariant(key: VariantKey): void {
  const url = new URL(window.location.href);
  url.searchParams.set('variant', key);
  window.history.replaceState({}, '', url);
  // simplest reload to re-mount the variant
  window.location.reload();
}

export function PrototypeSwitcher({ current }: { current: VariantKey }): React.JSX.Element | null {
  const idx = VARIANTS.findIndex((v) => v.key === current);
  const cur = VARIANTS[idx >= 0 ? idx : 0] ?? VARIANTS[0];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target?.matches('input, textarea, [contenteditable]')) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        cycle(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        cycle(1);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function cycle(delta: number): void {
    const next = VARIANTS[(idx + delta + VARIANTS.length) % VARIANTS.length] ?? VARIANTS[0];
    setVariant(next.key);
  }

  if (
    typeof process !== 'undefined' &&
    process.env?.NODE_ENV === 'production'
  ) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: 'oklch(20% 0.02 80)',
        color: 'white',
        padding: '8px 16px',
        borderRadius: '999px',
        boxShadow: '0 4px 20px oklch(0% 0 0 / 25%)',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        zIndex: 9999,
      }}
    >
      <button onClick={() => cycle(-1)} style={btnStyle()} aria-label="Previous variant">
        ◀
      </button>
      <span style={{ minWidth: '180px', textAlign: 'center' }}>
        <strong>{cur.key}</strong> — {cur.name}
        <span style={{ opacity: 0.5, marginLeft: '8px', fontSize: '11px' }}>
          ({idx + 1}/{VARIANTS.length})
        </span>
      </span>
      <button onClick={() => cycle(1)} style={btnStyle()} aria-label="Next variant">
        ▶
      </button>
    </div>
  );
}

function btnStyle(): React.CSSProperties {
  return {
    background: 'transparent',
    border: '1px solid oklch(50% 0.02 80)',
    color: 'white',
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    cursor: 'pointer',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
}
