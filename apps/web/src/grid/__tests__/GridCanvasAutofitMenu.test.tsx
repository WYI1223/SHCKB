// @vitest-environment happy-dom
/**
 * The autofit toggle in the block right-click menu (spec §7): a
 * menuitemcheckbox whose checked state reflects interaction.autofit, and
 * which flips the metadata on select. Markdown only.
 */
import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider, graphPaper } from '@skb/theme';
import { HostContext, type HostServices } from '@skb/block-kinds';
import { OverlayProvider } from '../../chrome/overlays';
import { GridCanvas } from '../GridCanvas';
import { useGridInteraction, type Interaction } from '../useGridInteraction';

afterEach(cleanup);

const host: HostServices = { uploadBlob: async () => ({ hash: 'h', size: 0, mimeType: 'x' }) };

function Harness() {
  const interaction = useGridInteraction({
    initialBlocks: [{ id: 'g', col: 0, row: 0, colSpan: 2, rowSpan: 1, kind: 'markdown' }],
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
            contents={{ g: { markdown: '' } }}
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

describe('autofit toggle', () => {
  test('block menu shows a checked "auto height" menuitemcheckbox', async () => {
    render(<Harness />);
    const block = document.querySelector('[data-block-id="g"]')!;
    fireEvent.contextMenu(block);
    const toggle = await screen.findByRole('menuitemcheckbox', { name: /auto height/i });
    expect(toggle.getAttribute('aria-checked')).toBe('true');
  });
});
