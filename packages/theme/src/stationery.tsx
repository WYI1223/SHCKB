/**
 * 「手帐 Stationery」— warm journal/diary theme, v2 deep showcase
 * [ADR-0025]: the first theme to use render slots — tilted paper
 * slips, washi-tape kind strips, deckle bottom edge, paper texture,
 * drop shadow, mount motion. Slot components reference TOKENS by
 * closure, NEVER via useTheme (stationery→context→themes→stationery
 * would be a runtime import cycle — the Bun TDZ bug class).
 */
import type { ReactNode } from 'react';
import type { BlockFrameProps, CanvasSurfaceProps, PageTitleProps, Theme, ThemeTokens } from './themes';

/** Code slips pasted into a journal: warm, low-saturation ink tones
 * that hold WCAG AA on the off-white paper slip (blockBg L 98%). */
const STATIONERY_CODE_CSS = `
.hljs-keyword, .hljs-selector-tag { color: oklch(44% 0.10 350); }
.hljs-string, .hljs-attr { color: oklch(45% 0.08 145); }
.hljs-number, .hljs-literal { color: oklch(47% 0.09 245); }
.hljs-comment { color: oklch(51% 0.045 70); font-style: italic; }
.hljs-title, .hljs-name { color: oklch(47% 0.10 65); }
.hljs-built_in, .hljs-type { color: oklch(49% 0.11 35); }
`;

const TOKENS: ThemeTokens = {
  id: 'stationery',
  name: 'Stationery',
  slot: 60,
  pad: 4,
  /** Warm cream notebook paper (kraft-warm hue 90). */
  canvasBg: 'oklch(95.5% 0.027 90)',
  /** Faint kraft-brown printed paper grid — not engineering coordinates. */
  dotColor: 'oklch(80% 0.045 75)',
  dotSize: 2,
  /** Off-white paper slip, a touch brighter than the cream canvas. */
  blockBg: 'oklch(98% 0.013 95)',
  /** Pencil-thin dashed kraft outline, like a cut-and-pasted slip. */
  blockBorder: '1px dashed oklch(72% 0.05 75)',
  blockRadius: '6px',
  /** Sepia ink-brown — warm but still ~11:1 on both paper surfaces. */
  textColor: 'oklch(33% 0.045 55)',
  mutedColor: 'oklch(49% 0.05 60)',
  /** Espresso-brown chrome, the journal's leather cover. */
  chromeBg: 'oklch(28% 0.04 60)',
  /** Misty fountain-pen blue. */
  accent: 'oklch(55% 0.08 240)',
  /** Warm muted red, a correction-pen mark rather than an alarm. */
  danger: 'oklch(52% 0.16 28)',
  surfaceInsetBg: 'oklch(94% 0.02 90)',
  hairline: 'oklch(80% 0.04 75)',
  quoteColor: 'oklch(46% 0.05 60)',
  /** Handwriting-leaning stack: Segoe Print (Latin) → Kai (CJK) →
   * cursive. Installed-font stacks only — font files are a theme-asset
   * pipeline future. */
  fontFamily: "'Segoe Print', 'KaiTi', '楷体', 'STKaiti', 'Comic Sans MS', cursive",
  /** Washi-tape strips pinning each slip. */
  kindHues: {
    markdown: 'oklch(78% 0.06 20)', // dusty pink washi
    image: 'oklch(78% 0.05 230)', // misty blue washi
    code: 'oklch(78% 0.06 145)', // sage green washi
  },
  kindHueFallback: 'oklch(78% 0.07 80)', // ochre washi
  codeCss: STATIONERY_CODE_CSS,
};

/** djb2 → deterministic tilt (publishedHtml purity). Wider slips tilt
 * less — a 1.2° tilt displaces a 12-col slip's corners ~15px, so the
 * max angle scales down with colSpan (owner feedback 2026-06-12). */
function tiltOf(id: string, colSpan: number): number {
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = ((h << 5) + h + id.charCodeAt(i)) | 0;
  const maxTilt = 1.2 * Math.min(1, 4 / Math.max(colSpan, 1));
  return ((Math.abs(h) % 1000) / 1000) * (2 * maxTilt) - maxTilt;
}

/** Second hash bit stream: which bottom corner lifts (owner feedback —
 * each slip curls a different corner, like real taped paper). */
function curlSideOf(id: string): 'left' | 'right' {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = ((h ^ id.charCodeAt(i)) * 16777619) | 0;
  return (Math.abs(h) & 1) === 0 ? 'right' : 'left';
}

/** Per-kind shell variation (the BlockFrame contract carries `kind`
 * precisely for this): images become Polaroid prints — stiff card,
 * clean edges (no tear), thick white border with the classic deep
 * bottom margin. Content stays kind-owned; only the shell changes. */
function PolaroidFrame({ blockId, colSpan, tape, children }: { blockId: string; colSpan: number; tape: string; children: ReactNode }) {
  const tilt = (tiltOf(blockId, colSpan) * 1.4).toFixed(3);
  return (
    <div
      className="skb-block skb-paper-slip skb-polaroid"
      data-kind="image"
      style={{ position: 'relative', width: '100%', height: '100%', transform: `rotate(${tilt}deg)` }}
    >
      <div
        aria-hidden
        className="skb-washi"
        style={{
          position: 'absolute',
          top: '-7px',
          left: '50%',
          width: '58px',
          height: '14px',
          transform: `translateX(-50%) rotate(${(-Number(tilt) * 1.2).toFixed(3)}deg)`,
          background: tape,
          opacity: 0.78,
          boxShadow: '0 1px 2px oklch(40% 0.04 60 / 25%)',
          zIndex: 3,
        }}
      />
      <div
        className="skb-polaroid-card"
        style={{
          position: 'absolute',
          inset: 0,
          // card stock: faint top-light gradient + inner hairline emboss
          background: 'linear-gradient(178deg, oklch(98% 0.004 95), oklch(97% 0.005 95))',
          boxShadow:
            'inset 0 0 0 1px oklch(93% 0.008 95), 0 3px 8px oklch(38% 0.04 60 / 26%), 0 1px 2px oklch(38% 0.04 60 / 14%)',
          padding: '10px 10px 30px',
        }}
      >
        <div
          className="skb-paper"
          style={{
            // the photo window: dark slate behind the print, recessed
            position: 'relative',
            width: '100%',
            height: '100%',
            background: 'oklch(30% 0.01 80)',
            overflow: 'auto',
            fontSize: '14px',
            lineHeight: 1.55,
            color: 'oklch(90% 0.01 80)',
            boxShadow: 'inset 0 1px 3px oklch(0% 0 0 / 45%), inset 0 0 1px oklch(0% 0 0 / 55%)',
          }}
        >
          {children}
        </div>
        {/* glass sheen + vignette: fixed over the photo window (a
            sibling overlay — anything inside the scroll container
            would scroll away with the content) */}
        <div aria-hidden className="skb-polaroid-gloss" style={{ position: 'absolute', inset: '10px 10px 30px', pointerEvents: 'none' }} />
      </div>
    </div>
  );
}

function StationeryBlockFrame({ kind, blockId, colSpan, rowSpan, children }: BlockFrameProps) {
  const tilt = tiltOf(blockId, colSpan).toFixed(3);
  const tape = TOKENS.kindHues[kind] ?? TOKENS.kindHueFallback;
  const curl = curlSideOf(blockId);
  if (kind === 'image') {
    return (
      <PolaroidFrame blockId={blockId} colSpan={colSpan} tape={tape}>
        {children}
      </PolaroidFrame>
    );
  }
  void rowSpan;
  return (
    <div
      className="skb-block skb-paper-slip"
      data-kind={kind}
      style={{ position: 'relative', width: '100%', height: '100%', transform: `rotate(${tilt}deg)` }}
    >
      <div
        aria-hidden
        className="skb-washi"
        style={{
          position: 'absolute',
          top: '-7px',
          left: '50%',
          width: '64px',
          height: '15px',
          transform: `translateX(-50%) rotate(${(-Number(tilt) * 1.7).toFixed(3)}deg)`,
          background: tape,
          opacity: 0.78,
          boxShadow: '0 1px 2px oklch(40% 0.04 60 / 25%)',
          zIndex: 3,
        }}
      />
      {/* lifted-corner shadow: spills past the torn edge onto the desk */}
      <div aria-hidden className={`skb-curl skb-curl-${curl}`} />
      {/* torn silhouette: turbulence-displaced backing layer; content
          never passes through the filter, so text stays crisp */}
      <div aria-hidden className="skb-paper-edge" />
      <div
        className="skb-paper"
        style={{
          // background lives in globalCss (scroll-aware curl shadows
          // need the layered background-attachment trick); inset leaves
          // a rim where the torn silhouette shows through.
          position: 'absolute',
          inset: '3px',
          padding: '10px 8px 8px',
          overflow: 'auto',
          fontSize: '14px',
          lineHeight: 1.55,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function StationeryCanvasSurface({ widthPx, heightPx, children }: CanvasSurfaceProps) {
  return (
    <>
      {/* one shared turbulence filter per canvas (fixed seed →
          deterministic markup; torn edges differ visually because each
          slip samples the noise at its own screen position) */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
        <filter id="skb-rough">
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="7" />
        </filter>
      </svg>
      <div
      className="skb-canvas skb-desk"
      style={{
        position: 'relative',
        width: `${widthPx}px`,
        height: `${heightPx}px`,
        backgroundImage: [
          // paper fiber texture (horizontal, very faint)
          'repeating-linear-gradient(0deg, transparent 0 2px, oklch(85% 0.02 90 / 7%) 2px 3px)',
          // printed journal grid (the kraft dots)
          `radial-gradient(circle, ${TOKENS.dotColor} 1px, transparent 1px)`,
        ].join(', '),
        backgroundSize: `auto, ${TOKENS.slot}px ${TOKENS.slot}px`,
        backgroundPosition: `0 0, ${TOKENS.slot - 1}px ${TOKENS.slot - 1}px`,
      }}
      >
        {children}
      </div>
    </>
  );
}

function StationeryPageTitle({ title }: PageTitleProps) {
  return (
    <h1
      style={{
        color: TOKENS.textColor,
        fontSize: '26px',
        margin: '0 0 24px',
        paddingBottom: '6px',
        borderBottom: `2px dashed ${TOKENS.hairline}`,
        display: 'inline-block',
      }}
    >
      {title}
    </h1>
  );
}

const STATIONERY_GLOBAL_CSS = `
@keyframes skb-paper-drop {
  from { opacity: 0; translate: 0 -8px; }
  to { opacity: 1; translate: 0 0; }
}
.skb-paper-slip .skb-paper-edge {
  animation: skb-paper-drop 240ms ease-out backwards;
}
.skb-paper-slip .skb-paper {
  animation: skb-paper-drop 240ms ease-out backwards;
}
/* torn silhouette: displaced backing layer; its drop-shadow follows
 * the ragged outline (applied AFTER displacement in the filter chain) */
.skb-paper-edge {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: oklch(98% 0.013 95);
  filter: url(#skb-rough) drop-shadow(0 2px 4px oklch(40% 0.04 60 / 22%));
  transition: filter 160ms ease;
}
.skb-paper-slip:hover .skb-paper-edge {
  filter: url(#skb-rough) drop-shadow(0 5px 10px oklch(40% 0.04 60 / 30%));
}
/* lifted bottom corner: skewed shadow spilling onto the desk */
.skb-curl {
  position: absolute;
  bottom: 1px;
  width: 42%;
  height: 14px;
  z-index: 0;
  box-shadow: 0 8px 9px oklch(38% 0.04 60 / 34%);
  background: transparent;
}
.skb-curl-right { right: 6px; transform: skewX(-9deg) rotate(2.5deg); }
.skb-curl-left { left: 6px; transform: skewX(9deg) rotate(-2.5deg); }
.skb-paper { position: relative; z-index: 2; }
/* polaroid material: glass sheen (diagonal light band) + corner
 * vignette over the recessed photo window; the sheen drifts slightly
 * on hover. Emboss ridge under the window on the card's bottom margin. */
.skb-polaroid-gloss {
  background:
    linear-gradient(115deg, transparent 36%, oklch(100% 0 0 / 9%) 42%, oklch(100% 0 0 / 17%) 49%, oklch(100% 0 0 / 5%) 55%, transparent 62%) 0 0 / 220% 100%,
    radial-gradient(120% 120% at 50% 45%, transparent 62%, oklch(0% 0 0 / 16%) 100%);
  background-position: 18% 0, 0 0;
  transition: background-position 360ms ease;
}
.skb-polaroid:hover .skb-polaroid-gloss { background-position: 62% 0, 0 0; }
.skb-polaroid-card::after {
  content: '';
  position: absolute;
  left: 10px;
  right: 10px;
  bottom: 24px;
  height: 2px;
  background: linear-gradient(oklch(91% 0.008 95), oklch(99% 0.003 95));
  border-radius: 1px;
}
@media (prefers-reduced-motion: reduce) {
  .skb-polaroid-gloss { transition: none; }
}
/* Hidden scrollbar + scroll-aware curl hints (owner feedback): the
 * paper "curls" at an edge exactly when more content lies beyond it.
 * Classic background-attachment local/scroll layering — the local
 * cover layers slide away from an edge once it is scrolled, revealing
 * the fixed curl shadow beneath. No JS; works on the static page. */
.skb-paper {
  scrollbar-width: none;
  background:
    linear-gradient(oklch(98% 0.013 95) 30%, oklch(98% 0.013 95 / 0%)) top / 100% 26px,
    linear-gradient(oklch(98% 0.013 95 / 0%), oklch(98% 0.013 95) 70%) bottom / 100% 26px,
    radial-gradient(70% 10px at 50% 0, oklch(38% 0.04 60 / 32%), transparent 70%) top / 100% 12px,
    radial-gradient(70% 10px at 50% 100%, oklch(38% 0.04 60 / 32%), transparent 70%) bottom / 100% 12px,
    oklch(98% 0.013 95);
  background-repeat: no-repeat;
  background-attachment: local, local, scroll, scroll;
}
.skb-paper::-webkit-scrollbar { display: none; }
.skb-paper pre { scrollbar-width: none; }
.skb-paper pre::-webkit-scrollbar { display: none; }
@media (prefers-reduced-motion: reduce) {
  .skb-paper-slip .skb-paper,
  .skb-paper-slip .skb-paper-edge { animation: none; transition: none; }
}
`;

export const stationery: Theme = {
  ...TOKENS,
  BlockFrame: StationeryBlockFrame,
  CanvasSurface: StationeryCanvasSurface,
  PageTitle: StationeryPageTitle,
  globalCss: STATIONERY_GLOBAL_CSS,
};
