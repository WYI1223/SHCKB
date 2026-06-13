/**
 * The light table — the themed sheet sits bounded on the bench with a
 * visible edge: what's inside the edge is what the reader's camera
 * shoots; everything blue is non-photo instrumentation the reader
 * never sees. Block bodies host real BlockKindModule views: inactive
 * blocks render the module RenderView (preview), only the active block
 * mounts its EditView (block-markdown.md performance boundary).
 */
import { useState } from 'react';
import { totalRows, type Block } from '@skb/grid-engine';
import { BLOCK_KINDS, blockModule, DefaultBlockFrame, DefaultCanvasSurface, pageBackgroundStyle } from '@skb/block-kinds';
import { resolveBlockFrame, shellOptionsFor, useTheme, type PageBackground, type Theme } from '@skb/theme';
import { BENCH } from '../chrome/bench';
import { useOverlays, type MenuItem } from '../chrome/overlays';
import { DeleteButton, DropGhost, ResizeHandles, ResizePreview } from './overlays';
import type { Interaction } from './useGridInteraction';
import { MeasureProbe } from './MeasureProbe';
import { useAutofitGesture } from './useAutofitGesture';

const MIN_ROWS_PADDING = 4;
/** Sheet margin around the grid — the board's edge belongs to the sheet. */
const SHEET_PAD = 24;

export type GridCanvasProps = {
  interaction: Interaction;
  contents: Record<string, unknown>;
  /** Author-picked shell option id per block (M6-D3). */
  shells: Record<string, string | null>;
  /** Author-picked page background (M6-D4) — live working-state preview. */
  background: PageBackground | null;
  activeId: string | null;
  onActivate: (id: string | null) => void;
  onContentChange: (id: string, content: unknown) => void;
  onBlockDeleted: (id: string) => void;
  /** Author shell pick from the block context menu (M8-D4). */
  onShellChange: (id: string, shell: string | null) => void;
  /** Paper pick from the sheet context menu (M8-D4). */
  onBackgroundChange: (bg: PageBackground | null) => void;
};

/** Paper choices row for the sheet menu — theme-curated stock plus the
 * theme-default swatch; the author's FREE picker stays in Properties
 * (M6-D4 freedom is not withdrawn, this is the curated quick face). */
function paperChoices(
  theme: Theme,
  background: PageBackground | null,
  onBackgroundChange: (bg: PageBackground | null) => void,
): MenuItem[] {
  const papers = theme.papers ?? [];
  if (papers.length === 0) return [];
  return [
    {
      kind: 'choices',
      label: `paper · ${theme.name}`,
      options: [
        { id: '__default', name: 'Theme default', swatch: theme.canvasBg, selected: !background?.color },
        ...papers.map((p) => ({ id: p.id, name: p.name, swatch: p.css, selected: background?.color === p.css })),
      ],
      onPick: (id) => {
        if (id === '__default') {
          onBackgroundChange(background?.blobHash ? { blobHash: background.blobHash } : null);
        } else {
          const paper = papers.find((p) => p.id === id);
          if (paper) onBackgroundChange({ ...background, color: paper.css });
        }
      },
    },
    { kind: 'separator' },
  ];
}

export function GridCanvas(props: GridCanvasProps) {
  const theme = useTheme();
  const overlays = useOverlays();
  const { interaction, activeId, onActivate } = props;
  const { state, drag } = interaction;
  const rows = totalRows(state) + MIN_ROWS_PADDING;
  const SLOT = theme.slot;
  const PAD = theme.pad;
  const Surface = theme.CanvasSurface ?? DefaultCanvasSurface;

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        minHeight: '100%',
        padding: '24px 24px 96px',
      }}
      onClick={() => onActivate(null)}
    >
      {/* the sheet: themed surface with an honest edge on the bench */}
      <div
        className="pu-sheet"
        onContextMenu={(e) => {
          // sheet right-click (M8-D3/D4): theme-curated papers, then
          // insert at the cursor cell. The handler lives on the SHEET
          // (the visual page — its margin ring included), but cell math
          // reads the inner grid's rect and clamps, so a click on the
          // margin inserts at the nearest edge cell. Block right-clicks
          // stop before reaching here.
          e.preventDefault();
          const grid = e.currentTarget.querySelector('[data-skb-canvas]');
          if (!(grid instanceof HTMLElement)) return;
          const rect = grid.getBoundingClientRect();
          const col = Math.max(0, Math.min(state.totalCols - 1, Math.floor((e.clientX - rect.left) / SLOT)));
          const row = Math.max(0, Math.floor((e.clientY - rect.top) / SLOT));
          const papers = paperChoices(theme, props.background, props.onBackgroundChange);
          overlays.menu(
            { x: e.clientX, y: e.clientY },
            [
              ...papers,
              ...(papers.length > 0 ? [{ kind: 'label', label: 'insert block' } as MenuItem] : []),
              ...Object.values(BLOCK_KINDS).map<MenuItem>((mod) => ({
                label: `${mod.glyph} ${mod.label}`,
                onSelect: () => interaction.ops.insertAt(col, row, mod.kind),
              })),
            ],
            { header: papers.length > 0 ? 'sheet' : 'insert block' },
          );
        }}
        style={{
          ...pageBackgroundStyle(props.background, theme.canvasBg),
          border: `1px solid ${BENCH.hairlineDark}`,
          padding: `${SHEET_PAD}px`,
          fontFamily: theme.fontFamily,
        }}
      >
        <div
          data-skb-canvas
          {...interaction.canvasDropProps(SLOT)}
          style={{
            position: 'relative',
            width: `${state.totalCols * SLOT}px`,
            height: `${rows * SLOT}px`,
          }}
        >
          <Surface widthPx={state.totalCols * SLOT} heightPx={rows * SLOT} background={props.background}>
            {state.blocks.map((b) => (
              <BlockShell key={b.id} block={b} {...props} slot={SLOT} pad={PAD} />
            ))}
            {drag.intent && <DropGhost intent={drag.intent} slotSize={SLOT} padding={PAD} />}
            <ResizePreview interaction={interaction} slotSize={SLOT} padding={PAD} />
          </Surface>
        </div>
      </div>
    </div>
  );
}

function BlockShell({
  block,
  interaction,
  contents,
  shells,
  activeId,
  onActivate,
  onContentChange,
  onBlockDeleted,
  onShellChange,
  slot,
  pad,
}: GridCanvasProps & { block: Block; slot: number; pad: number }) {
  const theme = useTheme();
  const overlays = useOverlays();
  const mod = blockModule(block.kind);
  const isActive = activeId === block.id;
  const isResizing = interaction.resize.active && interaction.resize.blockId === block.id;
  // v2 [ADR-0025]: outer div = geometry + interaction + editing chrome
  // (editor-owned); the theme's BlockFrame owns the visual shell. An
  // author shell choice resolves to its own Frame (M6-D3).
  const shell = shells[block.id] ?? null;
  const Frame = resolveBlockFrame(theme, block.kind, shell) ?? theme.BlockFrame ?? DefaultBlockFrame;
  // Autofit: 'grow' = content drives rowSpan; 'off'/null = legacy.
  const isAutofit = interaction.autofit[block.id] === 'grow';
  // Content fit measurement (rows) — fed by MeasureProbe, used by gesture.
  const [fit, setFit] = useState(block.rowSpan);
  // Autofit gesture controller (C5 reconcile-from-base; gestureActive gates autosave).
  useAutofitGesture({
    interaction,
    activeId: isActive ? block.id : null,
    enabled: isAutofit,
    floor: interaction.minRowSpan[block.id] ?? block.rowSpan,
    fit,
  });

  return (
    <div
      data-block-id={block.id}
      data-block-kind={block.kind}
      data-pu-active={isActive || undefined}
      className="pu-block"
      {...(isActive ? {} : interaction.blockDragProps(block))}
      onClick={(e) => {
        e.stopPropagation();
        if (!isActive) onActivate(block.id);
      }}
      onContextMenu={(e) => {
        // active block keeps the native menu (copy/paste belongs to the
        // edit surface); inactive blocks get the chrome menu.
        e.stopPropagation();
        if (isActive) return;
        e.preventDefault();
        // theme-curated shells (M8-D4) — same data Properties feeds on;
        // pill choices because shells have no single swatch color.
        const shellOpts = shellOptionsFor(theme, block.kind);
        const shellSection: MenuItem[] =
          shellOpts.length > 0
            ? [
                { kind: 'separator' },
                {
                  kind: 'choices',
                  label: `shell · ${theme.name}`,
                  options: [
                    { id: '__default', name: 'default', selected: shell === null },
                    ...shellOpts.map((o) => ({ id: o.id, name: o.name, selected: shell === o.id })),
                  ],
                  onPick: (id) => onShellChange(block.id, id === '__default' ? null : id),
                },
              ]
            : [];
        overlays.menu(
          { x: e.clientX, y: e.clientY },
          [
            { label: 'edit', onSelect: () => onActivate(block.id) },
            ...(block.kind === 'markdown'
              ? [
                  {
                    label: 'auto height',
                    checked: isAutofit,
                    onSelect: () =>
                      interaction.setAutofit(block.id, isAutofit ? 'off' : 'grow'),
                  } as MenuItem,
                ]
              : []),
            ...shellSection,
            { kind: 'separator' },
            {
              label: 'delete',
              danger: true,
              onSelect: () => {
                interaction.ops.remove(block.id);
                onBlockDeleted(block.id);
              },
            },
          ],
          { header: `${mod ? mod.label : block.kind} · ${block.colSpan}×${block.rowSpan}` },
        );
      }}
      style={{
        position: 'absolute',
        left: `${block.col * slot + pad}px`,
        top: `${block.row * slot + pad}px`,
        width: `${block.colSpan * slot - 2 * pad}px`,
        height: `${block.rowSpan * slot - 2 * pad}px`,
        // active ring = non-photo blue editor chrome on the unrotated
        // geometry box — works for any frame shape a theme draws inside.
        ...(isActive ? { boxShadow: `0 0 0 2px ${BENCH.blueBright}`, zIndex: 30 } : {}),
        cursor: isActive ? 'default' : 'grab',
        opacity: isResizing ? 0.6 : 1,
      }}
    >
      {/* instrument readout: kind + dims, non-photo blue, hover/active only */}
      <div
        aria-hidden
        className="pu-mark"
        style={{
          position: 'absolute',
          top: '-15px',
          left: '0',
          right: '0',
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: BENCH.fontMono,
          fontSize: '9px',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: BENCH.blue,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        <span>{mod ? `${mod.glyph} ${mod.label}` : `? ${block.kind}`}</span>
        <span style={{ paddingRight: '22px' }}>
          {block.colSpan}×{block.rowSpan}
        </span>
      </div>
      <Frame kind={block.kind} blockId={block.id} colSpan={block.colSpan} rowSpan={block.rowSpan} shell={shell}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            // scrolling belongs to the theme's frame alone (owner
            // feedback: double scrollbars) — inactive blocks grow
            // naturally and the frame scrolls them.
            height: isActive ? '100%' : 'auto',
            minHeight: '100%',
            fontSize: '12px',
            color: theme.textColor,
          }}
        >
          <div style={{ flex: 1, minHeight: 0, overflow: isAutofit ? 'hidden' : 'visible' }}>
            <BlockBody
              block={block}
              mod={mod}
              isActive={isActive}
              content={contents[block.id]}
              onContentChange={onContentChange}
            />
          </div>
        </div>
      </Frame>
      {/* MeasureProbe: offscreen measurement surface for autofit markdown
          blocks; doubles as visible ghost preview when the block is active
          (spec §5.3 / §7). Mounted ONLY for active autofit markdown blocks. */}
      {isAutofit && block.kind === 'markdown' && (
        <MeasureProbe
          kind={block.kind}
          blockId={block.id}
          colSpan={block.colSpan}
          shell={shell}
          content={contents[block.id]}
          onFit={setFit}
          visible={isActive}
        />
      )}
      <DeleteButton
        onClick={() => {
          interaction.ops.remove(block.id);
          onBlockDeleted(block.id);
        }}
      />
      {!isActive && (
        <ResizeHandles
          block={block}
          interaction={interaction}
          slot={slot}
          autofitCtx={{ autofit: isAutofit, currentFit: fit }}
        />
      )}
    </div>
  );
}

function BlockBody({
  block,
  mod,
  isActive,
  content,
  onContentChange,
}: {
  block: Block;
  mod: ReturnType<typeof blockModule>;
  isActive: boolean;
  content: unknown;
  onContentChange: (id: string, content: unknown) => void;
}) {
  const theme = useTheme();
  if (!mod) {
    // Unsupported kind: preserve content, never overwrite (blocks.md fallback scenario).
    return (
      <div style={{ color: theme.mutedColor, fontStyle: 'italic' }}>
        Unsupported block kind "{block.kind}" — content preserved.
      </div>
    );
  }
  const safeContent = (content ?? mod.createContent()) as never;
  if (isActive) {
    const Edit = mod.EditView;
    return <Edit content={safeContent} onChange={(next) => onContentChange(block.id, next)} />;
  }
  const Render = mod.RenderView;
  return <Render content={safeContent} />;
}
