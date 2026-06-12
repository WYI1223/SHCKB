/**
 * Paste-Up chrome tokens — "the bench" (ui-fork/free, 2026-06-12).
 *
 * The editor chrome is a paste-up room: ONE fixed bone-paper/graphite
 * palette that never follows the content theme (the room serves the
 * board; the camera shoots the board, never the room). Author-only
 * instrumentation — selection, handles, ghosts, grid hints — renders in
 * a single non-photo blue: if it's blue, the reader will never see it.
 * Registration red is reserved for error/destructive ("needs the
 * author's hand"). See docs/engineering/design/discussions/
 * ui-fork-free-2026-06-12.md.
 */
import type { CSSProperties, ReactNode } from 'react';
import type { Theme } from '@skb/theme';

export const BENCH = {
  /** bone paper — the room's wall/bench color */
  paper: '#F5F2EB',
  /** raised panel (inputs, popovers, tiles) */
  paperRaised: '#FCFAF5',
  /** sunken area — the light table the sheet sits on */
  paperSunken: '#ECE7DB',
  /** graphite ink */
  ink: '#23211C',
  inkSoft: '#6A665A',
  inkFaint: '#9D9789',
  hairline: '#E0DACC',
  hairlineDark: '#C9C2B0',
  /** non-photo blue — author-only instrument marks */
  blue: '#3E8CB0',
  blueBright: '#5BA8C4',
  blueWash: 'rgba(91, 168, 196, 0.16)',
  /** registration red — error / destructive only */
  red: '#B23A2C',
  redWash: 'rgba(178, 58, 44, 0.10)',
  fontUi: "'Segoe UI', system-ui, -apple-system, sans-serif",
  fontMono: "ui-monospace, 'Cascadia Mono', Consolas, 'SF Mono', monospace",
} as const;

/**
 * The bench expressed as a Theme value, so chrome zones (spec sheet,
 * back office) can host @skb/ui-kit primitives and kind tool Views in
 * the chrome voice without touching the block-kinds contract: data
 * still flows from the content theme, paint comes from the bench.
 */
export const benchTheme: Theme = {
  id: '__bench',
  name: 'Paste-Up bench',
  slot: 60,
  pad: 4,
  canvasBg: BENCH.paper,
  dotColor: 'transparent',
  dotSize: 0,
  blockBg: BENCH.paperRaised,
  blockBorder: `1px solid ${BENCH.hairlineDark}`,
  blockRadius: '2px',
  textColor: BENCH.ink,
  mutedColor: BENCH.inkSoft,
  chromeBg: BENCH.ink,
  accent: BENCH.blue,
  danger: BENCH.red,
  surfaceInsetBg: BENCH.paperRaised,
  hairline: BENCH.hairlineDark,
  quoteColor: BENCH.inkSoft,
  fontFamily: BENCH.fontUi,
  kindHues: {},
  kindHueFallback: BENCH.inkSoft,
  codeCss: '',
};

/** Small-caps instrument label (the pica-ruler voice). */
export function labelStyle(extra?: CSSProperties): CSSProperties {
  return {
    fontFamily: BENCH.fontMono,
    fontSize: '9px',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: BENCH.inkSoft,
    ...extra,
  };
}

/** Proofing stamp: compact mono token carrying a state. */
export function stampStyle(color: string, filled = false): CSSProperties {
  return {
    fontFamily: BENCH.fontMono,
    fontSize: '9px',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: filled ? BENCH.paper : color,
    background: filled ? color : 'transparent',
    border: `1px solid ${color}`,
    borderRadius: '2px',
    padding: '3px 7px',
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
  };
}

export function benchButtonStyle(extra?: CSSProperties): CSSProperties {
  return {
    fontFamily: BENCH.fontMono,
    fontSize: '10px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: BENCH.inkSoft,
    background: 'transparent',
    border: `1px solid ${BENCH.hairlineDark}`,
    borderRadius: '2px',
    padding: '5px 9px',
    cursor: 'pointer',
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
    ...extra,
  };
}

/** The press action — the one filled button in the chrome. */
export function pressButtonStyle(): CSSProperties {
  return {
    fontFamily: BENCH.fontMono,
    fontSize: '10px',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: BENCH.paper,
    background: BENCH.ink,
    border: `1px solid ${BENCH.ink}`,
    borderRadius: '2px',
    padding: '7px 14px',
    cursor: 'pointer',
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
  };
}

export function benchSelectStyle(extra?: CSSProperties): CSSProperties {
  return {
    fontFamily: BENCH.fontMono,
    fontSize: '10px',
    letterSpacing: '0.04em',
    color: BENCH.inkSoft,
    background: BENCH.paperRaised,
    border: `1px solid ${BENCH.hairlineDark}`,
    borderRadius: '2px',
    padding: '4px 6px',
    cursor: 'pointer',
    maxWidth: '100%',
    ...extra,
  };
}

export function hairlineRule(dark = false): CSSProperties {
  return { border: 'none', borderTop: `1px solid ${dark ? BENCH.hairlineDark : BENCH.hairline}`, margin: 0 };
}

/** Section header in the rack / spec sheet: label over a hairline. */
export function SectionLabel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        ...labelStyle(),
        borderBottom: `1px solid ${BENCH.hairline}`,
        paddingBottom: '5px',
        marginBottom: '8px',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Hover/focus rules the bench needs once per document. */
const BENCH_CSS = `
  .pu-chrome, .pu-chrome button, .pu-chrome input, .pu-chrome select { font-family: inherit; }
  .pu-chrome ::selection { background: ${BENCH.blueWash}; }
  .pu-row { transition: background 80ms linear; }
  .pu-row:hover { background: rgba(35, 33, 28, 0.055); }
  .pu-row .pu-actions { visibility: hidden; }
  .pu-row:hover .pu-actions, .pu-row:focus-within .pu-actions { visibility: visible; }
  .pu-hoverable:hover { border-color: ${BENCH.blue} !important; color: ${BENCH.ink} !important; }
  .pu-menu-item:hover, .pu-menu-item:focus-visible { background: rgba(35, 33, 28, 0.07); outline: none; }
  .pu-press:hover { background: #000; }
  .pu-block .pu-mark { opacity: 0; transition: opacity 100ms linear; }
  .pu-block:hover .pu-mark, .pu-block[data-pu-active='true'] .pu-mark { opacity: 1; }
  .pu-chrome button:focus-visible, .pu-chrome input:focus-visible, .pu-chrome select:focus-visible,
  .pu-chrome a:focus-visible {
    outline: 2px solid ${BENCH.blueBright};
    outline-offset: 1px;
  }
  .pu-scroll { scrollbar-width: thin; scrollbar-color: ${BENCH.hairlineDark} transparent; }
  .pu-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
  .pu-scroll::-webkit-scrollbar-thumb { background: ${BENCH.hairlineDark}; border-radius: 4px; }
  .pu-scroll::-webkit-scrollbar-track { background: transparent; }
  @media (prefers-reduced-motion: reduce) {
    .pu-row, .pu-block .pu-mark { transition: none; }
  }
`;

export function BenchStyle() {
  return <style>{BENCH_CSS}</style>;
}
