/**
 * 「边注 Marginalia」— publication-grade reading theme, the content-side
 * carrier of the ui-fork/reader design language (see
 * docs/engineering/design/discussions/ui-fork-reader-2026-06-12.md).
 *
 * Stance: a published notepage should read like a printed page — blocks
 * are not cards, they are passages *printed on* the paper. No borders,
 * no shadows, no per-kind coloring; hierarchy comes from typography
 * (serif body, hairline rules, one vermilion "rubric" accent used the
 * way rubricated manuscripts used red ink).
 *
 * Slot components read tokens via useTheme() at render time (M6-D6),
 * are deterministic, and renderToStaticMarkup-safe [ADR-0025].
 */
import { useTheme } from './context';
import { blockOverflow, type BlockFrameProps, type CanvasSurfaceProps, type PageTitleProps, type Theme, type ThemeTokens } from './themes';

/** Quiet warm code colors — ink tones with one rubric note, AA on the
 * faint inset surface. */
const MARGINALIA_CODE_CSS = `
.hljs-keyword, .hljs-selector-tag { color: oklch(42% 0.10 35); }
.hljs-string, .hljs-attr { color: oklch(42% 0.06 130); }
.hljs-number, .hljs-literal { color: oklch(45% 0.08 250); }
.hljs-comment { color: oklch(56% 0.02 70); font-style: italic; }
.hljs-title, .hljs-name { color: oklch(38% 0.07 60); }
.hljs-built_in, .hljs-type { color: oklch(44% 0.06 290); }
`;

const TOKENS: ThemeTokens = {
  id: 'marginalia',
  name: 'Marginalia',
  slot: 60,
  pad: 4,
  /** Warm paper. */
  canvasBg: 'oklch(97.6% 0.006 85)',
  /** No baseplate dots — printed pages have no grid. */
  dotColor: 'transparent',
  dotSize: 0,
  /** Blocks sit directly on the paper. */
  blockBg: 'transparent',
  blockBorder: 'none',
  blockRadius: '0px',
  /** Near-black warm ink. */
  textColor: 'oklch(23% 0.012 60)',
  mutedColor: 'oklch(48% 0.018 65)',
  /** Ink — used by hosts that paint chrome from theme tokens. */
  chromeBg: 'oklch(23% 0.012 60)',
  /** Vermilion rubric — the one color on the page. */
  accent: 'oklch(50% 0.135 35)',
  danger: 'oklch(46% 0.16 28)',
  /** Faint inset for code/pre/inline chips: slightly cooler paper. */
  surfaceInsetBg: 'oklch(94.5% 0.008 85)',
  hairline: 'oklch(88% 0.012 80)',
  quoteColor: 'oklch(44% 0.02 65)',
  /** Publication serif stack — installed fonts only (no webfont). */
  fontFamily: 'Georgia, "Times New Roman", "Noto Serif SC", "Songti SC", SimSun, serif',
  /** Ink-quiet kind identity: kinds differ by typography, not hue. */
  kindHues: {
    markdown: 'oklch(40% 0.02 60)',
    image: 'oklch(40% 0.02 60)',
    code: 'oklch(40% 0.02 60)',
  },
  kindHueFallback: 'oklch(40% 0.02 60)',
  codeCss: MARGINALIA_CODE_CSS,
};

/** Default shell: the passage — content printed on the paper, generous
 * line height, no chrome at all. */
function MarginaliaBlockFrame({ kind, autofit, children }: BlockFrameProps) {
  const t = useTheme();
  return (
    <div
      className="skb-block"
      data-kind={kind}
      style={{
        width: '100%',
        height: '100%',
        overflow: blockOverflow(autofit),
        padding: '8px 10px',
        fontSize: '15px',
        lineHeight: 1.7,
        color: t.textColor,
        scrollbarWidth: 'thin',
      }}
    >
      {children}
    </div>
  );
}

/** 'plate' shell: a figure plate — hairline box, the way printed books
 * frame illustrations and tables. */
function PlateFrame({ kind, shell, autofit, children }: BlockFrameProps) {
  const t = useTheme();
  return (
    <div
      className="skb-block"
      data-kind={kind}
      data-shell={shell ?? undefined}
      style={{
        width: '100%',
        height: '100%',
        overflow: blockOverflow(autofit),
        padding: '12px 14px',
        fontSize: '15px',
        lineHeight: 1.7,
        color: t.textColor,
        border: `1px solid ${t.hairline}`,
        background: 'oklch(99% 0.004 90)',
        scrollbarWidth: 'thin',
      }}
    >
      {children}
    </div>
  );
}

/** 'aside' shell: a margin note — smaller, muted, rubric-ruled on the
 * left, like an editor's gloss beside the text. */
function AsideFrame({ kind, shell, autofit, children }: BlockFrameProps) {
  const t = useTheme();
  return (
    <div
      className="skb-block"
      data-kind={kind}
      data-shell={shell ?? undefined}
      style={{
        width: '100%',
        height: '100%',
        overflow: blockOverflow(autofit),
        padding: '4px 10px 4px 12px',
        fontSize: '13px',
        lineHeight: 1.65,
        color: t.quoteColor,
        borderLeft: `2px solid ${t.accent}`,
        scrollbarWidth: 'thin',
      }}
    >
      {children}
    </div>
  );
}

function MarginaliaCanvasSurface({ widthPx, heightPx, children }: CanvasSurfaceProps) {
  return (
    <div
      className="skb-canvas"
      style={{ position: 'relative', width: `${widthPx}px`, height: `${heightPx}px` }}
    >
      {children}
    </div>
  );
}

/** Title as a book chapter opening: serif display over a double rule —
 * thick-thin, the classic editorial pair. */
function MarginaliaPageTitle({ title }: PageTitleProps) {
  const t = useTheme();
  return (
    <div style={{ margin: '0 0 30px' }}>
      <h1
        style={{
          color: t.textColor,
          fontSize: '34px',
          fontWeight: 600,
          letterSpacing: '-0.01em',
          lineHeight: 1.25,
          margin: '0 0 14px',
        }}
      >
        {title}
      </h1>
      <div aria-hidden style={{ borderTop: `2px solid ${t.textColor}` }} />
      <div aria-hidden style={{ borderTop: `1px solid ${t.hairline}`, marginTop: '2px' }} />
    </div>
  );
}

const MARGINALIA_GLOBAL_CSS = `
.skb-block a { color: oklch(50% 0.135 35); text-decoration: none; border-bottom: 1px solid oklch(50% 0.135 35 / 35%); }
.skb-block a:hover { border-bottom-color: oklch(50% 0.135 35); }
.skb-block hr { border: none; border-top: 1px solid oklch(88% 0.012 80); }
.skb-block h1, .skb-block h2, .skb-block h3 { letter-spacing: -0.01em; line-height: 1.3; }
.skb-block blockquote { font-style: italic; }
.skb-block pre, .skb-block code { font-family: ui-monospace, Consolas, "SF Mono", monospace; font-size: 0.86em; }
.skb-block ::selection { background: oklch(50% 0.135 35 / 18%); }
`;

export const marginalia: Theme = {
  ...TOKENS,
  BlockFrame: MarginaliaBlockFrame,
  CanvasSurface: MarginaliaCanvasSurface,
  PageTitle: MarginaliaPageTitle,
  globalCss: MARGINALIA_GLOBAL_CSS,

  shells: {
    plate: { name: 'Plate', Frame: PlateFrame },
    aside: { name: 'Aside', Frame: AsideFrame },
  },

  palettes: [
    {
      id: 'cool',
      name: 'Cool stock',
      tokens: {
        canvasBg: 'oklch(97.6% 0.004 250)',
        surfaceInsetBg: 'oklch(94.5% 0.006 250)',
        hairline: 'oklch(88% 0.01 250)',
        textColor: 'oklch(22% 0.012 270)',
        mutedColor: 'oklch(47% 0.015 265)',
        quoteColor: 'oklch(43% 0.018 265)',
        accent: 'oklch(44% 0.12 265)',
      },
    },
  ],

  customizableTokens: ['fontFamily', 'accent'],
};
