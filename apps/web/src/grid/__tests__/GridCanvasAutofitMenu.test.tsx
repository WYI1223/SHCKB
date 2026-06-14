// @vitest-environment happy-dom
/**
 * The autofit toggle in the block right-click menu (spec §7): a
 * menuitemcheckbox whose checked state reflects interaction.autofit, and
 * which flips the metadata on select. Shown per the kind's autofit policy
 * (blockModule(kind).autofit !== false): markdown/richtext/code in, image out.
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

function Harness({ kind }: { kind: string }) {
  const interaction = useGridInteraction({
    initialBlocks: [{ id: 'g', col: 0, row: 0, colSpan: 2, rowSpan: 1, kind }],
    initialGravity: false,
    defaultSizeFor: () => ({ colSpan: 2, rowSpan: 1 }),
    onBlockInserted: () => {},
    initialAutofit: { g: 'grow' },
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

describe('autofit toggle — per-kind policy', () => {
  test('block menu shows a checked "auto height" menuitemcheckbox (markdown)', async () => {
    render(<Harness kind="markdown" />);
    const block = document.querySelector('[data-block-id="g"]')!;
    fireEvent.contextMenu(block);
    const toggle = await screen.findByRole('menuitemcheckbox', { name: /auto height/i });
    expect(toggle.getAttribute('aria-checked')).toBe('true');
  });

  test.each(['markdown', 'richtext', 'code'])(
    'toggle is present for autofit-eligible kind "%s"',
    async (kind) => {
      render(<Harness kind={kind} />);
      const block = document.querySelector('[data-block-id="g"]')!;
      fireEvent.contextMenu(block);
      const toggle = await screen.findByRole('menuitemcheckbox', { name: /auto height/i });
      expect(toggle).toBeTruthy();
    },
  );

  test('toggle is ABSENT for image (autofit: false)', async () => {
    render(<Harness kind="image" />);
    const block = document.querySelector('[data-block-id="g"]')!;
    fireEvent.contextMenu(block);
    // wait for the menu itself, then assert no auto-height checkbox is in it.
    await screen.findByRole('menuitem', { name: /edit/i });
    expect(screen.queryByRole('menuitemcheckbox', { name: /auto height/i })).toBeNull();
  });
});
