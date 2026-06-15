// @vitest-environment happy-dom
/**
 * Atomicity invariant (spec §4.4 STRESS-1): while a follow gesture
 * is active on block A, INACTIVE block B must NOT receive drag handlers
 * and its context-menu delete must be disabled. Interleaving structural
 * ops (move/delete) would mutate interaction.state while
 * useAutofitGesture holds a stale base snapshot, silently clobbering the
 * interleaved op on the next debounced reconcile.
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

/**
 * Two blocks:
 *   A (id='a'): markdown, autofit=follow — will be the active block.
 *   B (id='b'): text, autofit=fix       — the inactive bystander.
 * activeId='a' simulates an active follow gesture on A.
 */
function Harness({ activeId }: { activeId: string | null }) {
  const interaction = useGridInteraction({
    initialBlocks: [
      { id: 'a', col: 0, row: 0, colSpan: 2, rowSpan: 2, kind: 'markdown' },
      { id: 'b', col: 0, row: 2, colSpan: 2, rowSpan: 1, kind: 'text' },
    ],
    initialGravity: false,
    defaultSizeFor: () => ({ colSpan: 2, rowSpan: 1 }),
    onBlockInserted: () => {},
    initialAutofit: { a: 'follow', b: 'fix' },
  });
  return (
    <ThemeProvider theme={graphPaper}>
      <HostContext.Provider value={host}>
        <OverlayProvider>
          <GridCanvas
            interaction={interaction}
            contents={{ a: { markdown: '' }, b: { text: '' } }}
            shells={{}}
            background={null}
            activeId={activeId}
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

describe('autofit gesture atomicity — STRESS-1', () => {
  test('inactive block B has no drag handlers while A is in an active follow gesture', () => {
    render(<Harness activeId="a" />);
    const blockB = document.querySelector('[data-block-id="b"]') as HTMLElement;
    expect(blockB).toBeTruthy();
    // When autofitGestureLocked, blockDragProps are NOT spread onto B:
    // the element should NOT be draggable.
    expect(blockB.getAttribute('draggable')).toBeNull();
  });

  test('inactive block B IS draggable when no autofit gesture is active', () => {
    render(<Harness activeId={null} />);
    const blockB = document.querySelector('[data-block-id="b"]') as HTMLElement;
    expect(blockB).toBeTruthy();
    // No gesture active → blockDragProps are spread → draggable="true"
    expect(blockB.getAttribute('draggable')).toBe('true');
  });

  test('inactive block B context-menu delete is disabled while A is in an active follow gesture', async () => {
    render(<Harness activeId="a" />);
    const blockB = document.querySelector('[data-block-id="b"]') as HTMLElement;
    fireEvent.contextMenu(blockB);
    // The delete menuitem should be present but HTML-disabled (disabled attribute on the button).
    const deleteItem = await screen.findByRole('menuitem', { name: /delete/i });
    expect(deleteItem).toHaveProperty('disabled', true);
  });
});
