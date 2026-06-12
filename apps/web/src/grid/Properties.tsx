/**
 * Properties panel (MVP-6 M6-D1) — the selection-driven inspector.
 * Docked under the sidebar directory (3D-engine mental model, owner
 * ratified); a floating right-click projection of the same sections
 * comes later. Contributors per selection:
 *   page  → host (background color / image)
 *   block → theme (curated shell options) + kind module (tools)
 * Future: text-range → richtext kind contributions.
 */
import { useRef } from 'react';
import { blockModule, useHost } from '@skb/block-kinds';
import { shellOptionsFor, useTheme, type PageBackground } from '@skb/theme';
import { UiButton } from '@skb/ui-kit';
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
  const theme = useTheme();
  return (
    <div
      data-skb-properties
      style={{
        borderTop: `1px solid ${theme.hairline}`,
        padding: '8px 6px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        fontSize: '12px',
        color: theme.textColor,
      }}
    >
      {props.selection.type === 'page' ? <PageSection {...props} /> : <BlockSection {...props} blockId={props.selection.blockId} />}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <span style={{ fontSize: '10px', color: theme.mutedColor, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
      {children}
    </span>
  );
}

function PageSection({ background, onBackgroundChange }: PropertiesProps) {
  const theme = useTheme();
  const { uploadBlob } = useHost();
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <SectionTitle>Page properties</SectionTitle>
      <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ flex: 1 }}>Background color</span>
        <input
          type="color"
          // native color input speaks hex only; non-hex (cleared/oklch)
          // shows as neutral until the author picks
          value={background?.color?.startsWith('#') ? background.color : '#ffffff'}
          onChange={(e) => onBackgroundChange({ ...background, color: e.target.value })}
          aria-label="Page background color"
          style={{ width: '28px', height: '20px', padding: 0, border: `1px solid ${theme.hairline}`, background: 'transparent', cursor: 'pointer' }}
        />
      </label>
      <div style={{ display: 'flex', gap: '4px' }}>
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
    </>
  );
}

function BlockSection({
  blockId,
  interaction,
  contents,
  shells,
  onContentChange,
  onShellChange,
}: PropertiesProps & { blockId: string }) {
  const theme = useTheme();
  const block = interaction.state.blocks.find((b) => b.id === blockId);
  if (!block) return null;
  const mod = blockModule(block.kind);
  const options = shellOptionsFor(theme, block.kind);
  const current = shells[blockId] ?? null;
  const content = contents[blockId] ?? mod?.createContent();

  const chip = (id: string | null, name: string) => {
    const active = current === id;
    return (
      <button
        key={id ?? '__default'}
        onClick={() => onShellChange(blockId, id)}
        style={{
          padding: '2px 8px',
          fontSize: '11px',
          fontFamily: 'inherit',
          color: theme.textColor,
          background: theme.surfaceInsetBg,
          border: `1px solid ${active ? theme.accent : theme.hairline}`,
          boxShadow: active ? `0 0 0 1px ${theme.accent}` : 'none',
          borderRadius: '999px',
          cursor: 'pointer',
        }}
      >
        {name}
      </button>
    );
  };

  return (
    <>
      <SectionTitle>
        {mod ? `${mod.glyph} ${mod.label}` : block.kind} properties
      </SectionTitle>
      {options.length > 0 && (
        <label style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <span style={{ fontSize: '10px', color: theme.mutedColor }}>Shell</span>
          <span style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {chip(null, 'Default')}
            {options.map((o) => chip(o.id, o.name))}
          </span>
        </label>
      )}
      {mod?.tools?.map((tool) => (
        <label key={tool.id} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <span style={{ fontSize: '10px', color: theme.mutedColor }}>{tool.label}</span>
          <tool.View content={content as never} onChange={(next) => onContentChange(blockId, next)} />
        </label>
      ))}
      {options.length === 0 && !mod?.tools?.length && (
        <span style={{ color: theme.mutedColor, fontSize: '11px' }}>No properties for this block.</span>
      )}
    </>
  );
}
