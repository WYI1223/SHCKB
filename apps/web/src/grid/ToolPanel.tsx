/**
 * Tool panel — the host-owned chrome surface where the active block's
 * module renders its contributed tools (MVP-5 M5-D4: the module owns
 * panel CONTENT, the host owns panel position and layout). Form factor
 * is a dev-layer default, not a product lock.
 */
import { blockModule } from '@skb/block-kinds';
import { useTheme } from '@skb/theme';
import type { Interaction } from './useGridInteraction';

export type ToolPanelProps = {
  interaction: Interaction;
  activeId: string | null;
  contents: Record<string, unknown>;
  onContentChange: (id: string, content: unknown) => void;
};

export function ToolPanel({ interaction, activeId, contents, onContentChange }: ToolPanelProps) {
  const theme = useTheme();
  if (!activeId) return null;
  const block = interaction.state.blocks.find((b) => b.id === activeId);
  if (!block) return null;
  const mod = blockModule(block.kind);
  if (!mod?.tools?.length) return null;
  const content = contents[activeId] ?? mod.createContent();

  return (
    <div
      data-skb-tool-panel
      style={{
        position: 'fixed',
        top: '170px',
        right: '20px',
        background: theme.chromeBg,
        color: 'white',
        padding: '8px 12px',
        borderRadius: '12px',
        boxShadow: '0 4px 20px oklch(0% 0 0 / 25%)',
        fontSize: '12px',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        width: '180px',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ opacity: 0.7, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {mod.glyph} {mod.label}
      </div>
      {mod.tools.map((tool) => (
        <label key={tool.id} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <span style={{ fontSize: '10px', opacity: 0.75 }}>{tool.label}</span>
          <tool.View content={content as never} onChange={(next) => onContentChange(activeId, next)} />
        </label>
      ))}
    </div>
  );
}
