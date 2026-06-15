// @vitest-environment happy-dom
/**
 * The follow/fix toggle in the block right-click menu (spec §3.2): a
 * menuitemcheckbox labelled "follow content" whose checked state reflects
 * interaction.autofit === 'follow', and which flips the mode on select
 * ('follow' ↔ 'fix'). Shown per the kind's autofit policy
 * (blockModule(kind).autofit?.canFollow !== false): markdown/richtext/code
 * in, image (canFollow:false) out.
 */
import { afterEach, describe, expect, test } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider, graphPaper } from '@skb/theme';
import { HostContext, type HostServices } from '@skb/block-kinds';
import { OverlayProvider } from '../../chrome/overlays';
import { GridCanvas } from '../GridCanvas';
import { useGridInteraction } from '../useGridInteraction';

afterEach(cleanup);

const host: HostServices = { uploadBlob: async () => ({ hash: 'h', size: 0, mimeType: 'x' }) };

function Harness({ kind, mode = 'follow' }: { kind: string; mode?: 'follow' | 'fix' }) {
  const interaction = useGridInteraction({
    initialBlocks: [{ id: 'g', col: 0, row: 0, colSpan: 2, rowSpan: 1, kind }],
    initialGravity: false,
    defaultSizeFor: () => ({ colSpan: 2, rowSpan: 1 }),
    onBlockInserted: () => {},
    initialAutofit: { g: mode },
  });
  return (
    <ThemeProvider theme={graphPaper}>
      <HostContext.Provider value={host}>
        <OverlayProvider>
          <GridCanvas
            interaction={interaction}
            // omit content → BlockBody self-seeds via mod.createContent(),
            // so each kind's RenderView mounts with its own valid shape.
            contents={{}}
            shells={{}}
            background={null}
            activeId={null}
            onActivate={() => {}}
            onContentChange={() => {}}
            onBlockDeleted={() => {}}
            onShellChange={() => {}}
            onBackgroundChange={() => {}}
          />
        </OverlayProvider>
      </HostContext.Provider>
    </ThemeProvider>
  );
}

describe('follow/fix toggle — per-kind policy', () => {
  test('block menu shows a checked "follow content" menuitemcheckbox (markdown, follow mode)', async () => {
    render(<Harness kind="markdown" mode="follow" />);
    const block = document.querySelector('[data-block-id="g"]')!;
    fireEvent.contextMenu(block);
    const toggle = await screen.findByRole('menuitemcheckbox', { name: /follow content/i });
    expect(toggle.getAttribute('aria-checked')).toBe('true');
  });

  test('the toggle is unchecked when the block is in fix mode', async () => {
    render(<Harness kind="markdown" mode="fix" />);
    const block = document.querySelector('[data-block-id="g"]')!;
    fireEvent.contextMenu(block);
    const toggle = await screen.findByRole('menuitemcheckbox', { name: /follow content/i });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
  });

  test('toggling a fix block writes follow', async () => {
    render(<Harness kind="markdown" mode="fix" />);
    const block = document.querySelector('[data-block-id="g"]')!;
    fireEvent.contextMenu(block);
    const toggle = await screen.findByRole('menuitemcheckbox', { name: /follow content/i });
    fireEvent.click(toggle);
    // re-open the menu; the checkbox should now reflect follow.
    fireEvent.contextMenu(block);
    const after = await screen.findByRole('menuitemcheckbox', { name: /follow content/i });
    expect(after.getAttribute('aria-checked')).toBe('true');
  });

  test('toggling a follow block writes fix', async () => {
    render(<Harness kind="markdown" mode="follow" />);
    const block = document.querySelector('[data-block-id="g"]')!;
    fireEvent.contextMenu(block);
    const toggle = await screen.findByRole('menuitemcheckbox', { name: /follow content/i });
    fireEvent.click(toggle);
    fireEvent.contextMenu(block);
    const after = await screen.findByRole('menuitemcheckbox', { name: /follow content/i });
    expect(after.getAttribute('aria-checked')).toBe('false');
  });

  test.each(['markdown', 'richtext', 'code'])(
    'follow toggle is present for follow-eligible kind "%s"',
    async (kind) => {
      render(<Harness kind={kind} />);
      const block = document.querySelector('[data-block-id="g"]')!;
      fireEvent.contextMenu(block);
      const toggle = await screen.findByRole('menuitemcheckbox', { name: /follow content/i });
      expect(toggle).toBeTruthy();
    },
  );

  test('follow toggle is ABSENT for image (canFollow: false)', async () => {
    render(<Harness kind="image" mode="fix" />);
    const block = document.querySelector('[data-block-id="g"]')!;
    fireEvent.contextMenu(block);
    // wait for the menu itself, then assert no follow-content checkbox is in it.
    await screen.findByRole('menuitem', { name: /edit/i });
    expect(screen.queryByRole('menuitemcheckbox', { name: /follow content/i })).toBeNull();
  });
});
