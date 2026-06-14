/**
 * The spec sheet — the selection-driven Properties inspector as a
 * right-hand rail on the bench (Paste-Up IA: rack | light table | spec
 * sheet). Contributors per selection are unchanged (MVP-6 M6-D1):
 *   page  → host (page stock: background color / image)
 *   block → theme (curated shell options) + kind module (tools)
 * Future: text-range → richtext kind contributions.
 *
 * Paint/data split: shell OPTIONS come from the page's effective
 * content theme (read before re-providing), but everything inside the
 * rail renders under benchTheme — chrome never wears the content
 * theme, and ui-kit primitives/kind tool Views pick the bench voice up
 * through the normal ThemeContext (block-kinds contract untouched).
 */
import { useRef } from 'react';
import { blockModule, useHost } from '@skb/block-kinds';
import { ThemeProvider, skinOptionsFor, useTheme, type PageBackground, type Theme } from '@skb/theme';
import { UiButton } from '@skb/ui-kit';
import { BENCH, SectionLabel, benchTheme, labelStyle } from '../chrome/bench';
import type { Interaction } from './useGridInteraction';

export type Selection = { type: 'page' } | { type: 'block'; blockId: string };

export type PropertiesProps = {
  selection: Selection;
  interaction: Interaction;
  contents: Record<string, unknown>;
  shells: Record<string, string | null>;
  background: PageBackground | null;
  onContentChange: (id: string, content: unknown) => void;
  onShellChange: (id: string, shell: string | null) => void;
  onBackgroundChange: (bg: PageBackground | null) => void;
};

export function Properties(props: PropertiesProps) {
  // effective content theme — data source for shell options only
  const contentTheme = useTheme();
  return (
    <ThemeProvider theme={benchTheme}>
      <aside
        data-skb-properties
        className="pu-scroll"
        aria-label="Properties"
        style={{
          width: '236px',
          flexShrink: 0,
          borderLeft: `1px solid ${BENCH.hairlineDark}`,
          background: BENCH.paper,
          padding: '12px',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          fontSize: '12px',
          color: BENCH.ink,
          fontFamily: BENCH.fontUi,
        }}
      >
        {props.selection.type === 'page' ? (
          <PageSection {...props} />
        ) : (
          <BlockSection {...props} blockId={props.selection.blockId} contentTheme={contentTheme} />
        )}
      </aside>
    </ThemeProvider>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span style={labelStyle({ fontSize: '8px' })}>{children}</span>;
}

function PageSection({ background, onBackgroundChange }: PropertiesProps) {
  const { uploadBlob } = useHost();
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <SectionLabel>Spec sheet · page</SectionLabel>
      <FieldLabel>Page stock</FieldLabel>
      <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ flex: 1, fontSize: '12px' }}>Background color</span>
        <input
          type="color"
          // native color input speaks hex only; non-hex (cleared/oklch)
          // shows as neutral until the author picks
          value={background?.color?.startsWith('#') ? background.color : '#ffffff'}
          onChange={(e) => onBackgroundChange({ ...background, color: e.target.value })}
          aria-label="Page background color"
          style={{
            width: '30px',
            height: '20px',
            padding: 0,
            border: `1px solid ${BENCH.hairlineDark}`,
            borderRadius: '2px',
            background: 'transparent',
            cursor: 'pointer',
          }}
        />
      </label>
      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
        <UiButton onClick={() => fileRef.current?.click()} title="Use an image as the page background">
          {background?.blobHash ? 'Replace image' : 'Background image'}
        </UiButton>
        {(background?.color || background?.blobHash) && (
          <UiButton onClick={() => onBackgroundChange(null)} variant="danger" title="Back to the theme canvas">
            Clear
          </UiButton>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp,image/avif"
        aria-label="Background image file"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            void uploadBlob(f).then(({ hash }) => onBackgroundChange({ ...background, blobHash: hash }));
          }
          e.target.value = '';
        }}
      />
      <p style={{ margin: '4px 0 0', fontSize: '10px', color: BENCH.inkFaint, lineHeight: 1.5 }}>
        Select a block on the sheet to see its shell options and tools.
      </p>
    </>
  );
}

function BlockSection({
  blockId,
  interaction,
  contents,
  shells,
  contentTheme,
  onContentChange,
  onShellChange,
}: PropertiesProps & { blockId: string; contentTheme: Theme }) {
  const block = interaction.state.blocks.find((b) => b.id === blockId);
  if (!block) return null;
  const mod = blockModule(block.kind);
  // options come from the CONTENT theme (the sheet), not the bench
  const options = skinOptionsFor(contentTheme, block.kind);
  const current = shells[blockId] ?? null;
  const content = contents[blockId] ?? mod?.createContent();

  const chip = (id: string | null, name: string) => {
    const active = current === id;
    return (
      <button
        key={id ?? '__default'}
        onClick={() => onShellChange(blockId, id)}
        style={{
          padding: '3px 8px',
          fontSize: '10px',
          fontFamily: BENCH.fontMono,
          letterSpacing: '0.04em',
          color: active ? BENCH.paper : BENCH.inkSoft,
          background: active ? BENCH.blue : BENCH.paperRaised,
          border: `1px solid ${active ? BENCH.blue : BENCH.hairlineDark}`,
          borderRadius: '2px',
          cursor: 'pointer',
        }}
      >
        {name}
      </button>
    );
  };

  return (
    <>
      <SectionLabel>
        Spec sheet · {mod ? mod.label : block.kind}
      </SectionLabel>
      {/* instrument readout: where the galley sits on the board */}
      <span
        style={{
          fontFamily: BENCH.fontMono,
          fontSize: '10px',
          letterSpacing: '0.06em',
          color: BENCH.blue,
        }}
        title="Column / row · size (grid units)"
      >
        c{block.col + 1} r{block.row + 1} · {block.colSpan}×{block.rowSpan}
      </span>
      {options.length > 0 && (
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <FieldLabel>Shell — curated by {contentTheme.name}</FieldLabel>
          <span style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {chip(null, 'default')}
            {options.map((o) => chip(o.id, o.name))}
          </span>
        </label>
      )}
      {mod?.tools?.map((tool) => (
        <label key={tool.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <FieldLabel>{tool.label}</FieldLabel>
          <tool.View content={content as never} onChange={(next) => onContentChange(blockId, next)} />
        </label>
      ))}
      {options.length === 0 && !mod?.tools?.length && (
        <span style={{ color: BENCH.inkFaint, fontSize: '11px', fontStyle: 'italic' }}>
          No properties for this block.
        </span>
      )}
    </>
  );
}
