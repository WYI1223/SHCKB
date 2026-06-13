/**
 * 「校样 Galley」— the content-side companion of the Paste-Up chrome
 * (owner request, M7-D7: "需要一套与这个外观对应的 theme"). If the
 * bench is the room, Galley is the sheet the process camera shoots:
 * bone repro paper, blocks as pasted white galley strips with cut
 * edges, crop marks in the corners, commercial grotesque type, one
 * warm spot-ink accent. No non-photo blue anywhere — by Paste-Up law
 * the reader never sees the instruments.
 *
 * Slot components read tokens via useTheme() at render time (M6-D6),
 * are deterministic, and renderToStaticMarkup-safe [ADR-0025].
 */
import { useTheme } from './context';
import { blockOverflow, type BlockFrameProps, type CanvasSurfaceProps, type PageTitleProps, type Theme, type ThemeTokens } from './themes';

/** Warm-paper code colors — process black with restrained ink hues. */
const GALLEY_CODE_CSS = `
.hljs-keyword, .hljs-selector-tag { color: oklch(40% 0.10 25); }
.hljs-string, .hljs-attr { color: oklch(42% 0.07 140); }
.hljs-number, .hljs-literal { color: oklch(44% 0.09 245); }
.hljs-comment { color: oklch(56% 0.015 80); font-style: italic; }
.hljs-title, .hljs-name { color: oklch(38% 0.08 55); }
.hljs-built_in, .hljs-type { color: oklch(43% 0.07 290); }
`;

const TOKENS: ThemeTokens = {
  id: 'galley',
  name: 'Galley',
  slot: 60,
  pad: 4,
  /** The sheet: whiter than the bench's bone so it reads as A SHEET
   * lying on the light table. */
  canvasBg: 'oklch(97.8% 0.008 90)',
  /** No printed grid — the artists' blue grid is non-repro and the
   * camera (the reader) must never see it. */
  dotColor: 'transparent',
  dotSize: 0,
  /** Pasted galley strips: brighter white than the sheet. */
  blockBg: 'oklch(99.4% 0.003 95)',
  blockBorder: '1px solid oklch(87% 0.015 90)',
  /** Cut paper has square corners. */
  blockRadius: '0px',
  /** Process black, warm. */
  textColor: 'oklch(20% 0.01 80)',
  mutedColor: 'oklch(46% 0.015 80)',
  /** Graphite — harmonizes with the bench chrome without quoting it. */
  chromeBg: 'oklch(24% 0.012 80)',
  /** Spot ink: warm press red (brighter/more orange than marginalia's
   * manuscript vermilion). */
  accent: 'oklch(54% 0.155 40)',
  danger: 'oklch(48% 0.16 28)',
  surfaceInsetBg: 'oklch(95% 0.012 90)',
  hairline: 'oklch(86% 0.018 90)',
  quoteColor: 'oklch(42% 0.018 80)',
  /** Commercial grotesque — the voice the owner picked in Paste-Up. */
  fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, system-ui, sans-serif",
  /** Kind identity stays ink-quiet; the strips, not hues, organize. */
  kindHues: {
    markdown: 'oklch(35% 0.015 80)',
    image: 'oklch(35% 0.015 80)',
    code: 'oklch(35% 0.015 80)',
  },
  kindHueFallback: 'oklch(35% 0.015 80)',
  codeCss: GALLEY_CODE_CSS,
};

/** Default shell: a pasted galley strip — white stock, cut edge, the
 * faintest paste-up lift. */
function GalleyBlockFrame({ kind, autofit, children }: BlockFrameProps) {
  const t = useTheme();
  return (
    <div
      className="skb-block"
      data-kind={kind}
      style={{
        width: '100%',
        height: '100%',
        overflow: blockOverflow(autofit),
        padding: '10px 12px',
        fontSize: '14.5px',
        lineHeight: 1.62,
        color: t.textColor,
        background: t.blockBg,
        border: t.blockBorder,
        boxShadow: '0 1px 2px oklch(40% 0.02 80 / 14%)',
        scrollbarWidth: 'thin',
      }}
    >
      {children}
    </div>
  );
}

/** 'keyline' shell: a keyline box — the hairline frame print production
 * draws around figures and tables before the plates exist. */
function KeylineFrame({ kind, shell, autofit, children }: BlockFrameProps) {
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
        padding: '14px 16px',
        fontSize: '14.5px',
        lineHeight: 1.62,
        color: t.textColor,
        background: t.blockBg,
        border: `1px solid ${t.textColor}`,
        outline: `1px solid ${t.hairline}`,
        outlineOffset: '3px',
        scrollbarWidth: 'thin',
      }}
    >
      {children}
    </div>
  );
}

/** 'cutout' shell: pasted without a strip — the content (a photo, a
 * clipped paragraph) sits directly on the sheet. */
function CutoutFrame({ kind, shell, autofit, children }: BlockFrameProps) {
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
        fontSize: '14.5px',
        lineHeight: 1.62,
        color: t.textColor,
        filter: 'drop-shadow(0 1px 2px oklch(40% 0.02 80 / 18%))',
        scrollbarWidth: 'thin',
      }}
    >
      {children}
    </div>
  );
}

/** One L-shaped crop mark; the four corners orient the trim. */
function CropMark({ corner, color }: { corner: 'tl' | 'tr' | 'bl' | 'br'; color: string }) {
  const v = corner[0] === 't' ? { top: '6px' } : { bottom: '6px' };
  const h = corner[1] === 'l' ? { left: '6px' } : { right: '6px' };
  return (
    <span
      aria-hidden
      style={{
        position: 'absolute',
        width: '14px',
        height: '14px',
        ...v,
        ...h,
        borderTop: corner[0] === 't' ? `1px solid ${color}` : 'none',
        borderBottom: corner[0] === 'b' ? `1px solid ${color}` : 'none',
        borderLeft: corner[1] === 'l' ? `1px solid ${color}` : 'none',
        borderRight: corner[1] === 'r' ? `1px solid ${color}` : 'none',
        opacity: 0.45,
      }}
    />
  );
}

/** The sheet: trim crop marks in the corners — the one production mark
 * that legitimately survives into print. */
function GalleyCanvasSurface({ widthPx, heightPx, children }: CanvasSurfaceProps) {
  const t = useTheme();
  return (
    <div
      className="skb-canvas"
      style={{ position: 'relative', width: `${widthPx}px`, height: `${heightPx}px` }}
    >
      <CropMark corner="tl" color={t.mutedColor} />
      <CropMark corner="tr" color={t.mutedColor} />
      <CropMark corner="bl" color={t.mutedColor} />
      <CropMark corner="br" color={t.mutedColor} />
      {children}
    </div>
  );
}

/** Title as the masthead: tight grotesque display over a thick black
 * bar — the commercial front-page voice. */
function GalleyPageTitle({ title }: PageTitleProps) {
  const t = useTheme();
  return (
    <div style={{ margin: '0 0 28px' }}>
      <h1
        style={{
          color: t.textColor,
          fontSize: '32px',
          fontWeight: 750,
          letterSpacing: '-0.02em',
          lineHeight: 1.15,
          margin: '0 0 12px',
        }}
      >
        {title}
      </h1>
      <div aria-hidden style={{ borderTop: `3px solid ${t.textColor}` }} />
    </div>
  );
}

const GALLEY_GLOBAL_CSS = `
.skb-block a { color: oklch(54% 0.155 40); text-decoration: none; border-bottom: 1px solid oklch(54% 0.155 40 / 40%); }
.skb-block a:hover { border-bottom-color: oklch(54% 0.155 40); }
.skb-block hr { border: none; border-top: 1px solid oklch(86% 0.018 90); }
.skb-block h1, .skb-block h2, .skb-block h3 { letter-spacing: -0.015em; line-height: 1.25; font-weight: 700; }
.skb-block blockquote { border-left: 3px solid oklch(20% 0.01 80); padding-left: 12px; font-style: normal; }
.skb-block pre, .skb-block code { font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace; font-size: 0.87em; }
.skb-block ::selection { background: oklch(54% 0.155 40 / 18%); }
`;

export const galley: Theme = {
  ...TOKENS,
  BlockFrame: GalleyBlockFrame,
  CanvasSurface: GalleyCanvasSurface,
  PageTitle: GalleyPageTitle,
  globalCss: GALLEY_GLOBAL_CSS,

  shells: {
    keyline: { name: 'Keyline', Frame: KeylineFrame },
    cutout: { name: 'Cutout', Frame: CutoutFrame },
  },

  palettes: [
    {
      id: 'press-blue',
      name: 'Press blue',
      tokens: {
        accent: 'oklch(46% 0.11 245)',
        canvasBg: 'oklch(97.8% 0.005 240)',
        blockBg: 'oklch(99.4% 0.002 240)',
        surfaceInsetBg: 'oklch(95% 0.008 240)',
        hairline: 'oklch(86% 0.012 240)',
        textColor: 'oklch(20% 0.012 260)',
        mutedColor: 'oklch(46% 0.015 255)',
        quoteColor: 'oklch(42% 0.015 255)',
      },
    },
    {
      id: 'jet',
      name: 'Jet proof',
      tokens: {
        accent: 'oklch(25% 0 0)',
        canvasBg: 'oklch(98.5% 0 0)',
        blockBg: 'white',
        surfaceInsetBg: 'oklch(95.5% 0 0)',
        hairline: 'oklch(86% 0 0)',
        textColor: 'oklch(15% 0 0)',
        mutedColor: 'oklch(45% 0 0)',
        quoteColor: 'oklch(40% 0 0)',
      },
    },
  ],

  customizableTokens: ['fontFamily', 'accent'],

  // Curated papers (M8-D4): repro-room stock — the ruled option proves
  // a short CSS texture flows through PageBackground.color untouched.
  papers: [
    { id: 'white', name: 'Plate white', css: 'oklch(99.5% 0 0)' },
    { id: 'proof-blue', name: 'Proof blue', css: 'oklch(96.5% 0.014 240)' },
    { id: 'manila', name: 'Manila', css: 'oklch(94% 0.028 85)' },
    {
      id: 'ruled',
      name: 'Ruled',
      css: 'repeating-linear-gradient(0deg,transparent 0 23px,oklch(93% 0.012 90) 23px 24px) oklch(97.8% 0.008 90)',
    },
  ],
};
