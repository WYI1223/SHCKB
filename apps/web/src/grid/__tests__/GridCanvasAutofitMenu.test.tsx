// @vitest-environment happy-dom
/**
 * The height-mode toggle in the block right-click menu (spec §3.2): an
 * OPT-IN menuitemcheckbox labelled "Fixed height" whose checked state is
 * `interaction.autofit !== 'follow'` (checked = fix; the default follow is
 * unchecked), and which flips the mode on select ('follow' ↔ 'fix'). Shown
 * per the kind's autofit policy (blockModule(kind).autofit?.canFollow !==
 * false): markdown/richtext/code in, image (canFollow:false) out.
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
            pageId="test-page"
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

describe('Fixed-height toggle — per-kind policy', () => {
  test('the "Fixed height" checkbox is UNCHECKED for a follow block (the default)', async () => {
    render(<Harness kind="markdown" mode="follow" />);
    const block = document.querySelector('[data-block-id="g"]')!;
    fireEvent.contextMenu(block);
    const toggle = await screen.findByRole('menuitemcheckbox', { name: /fixed height/i });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
  });

  test('the "Fixed height" checkbox is CHECKED when the block is in fix mode', async () => {
    render(<Harness kind="markdown" mode="fix" />);
    const block = document.querySelector('[data-block-id="g"]')!;
    fireEvent.contextMenu(block);
    const toggle = await screen.findByRole('menuitemcheckbox', { name: /fixed height/i });
    expect(toggle.getAttribute('aria-checked')).toBe('true');
  });

  test('checking "Fixed height" on a follow block writes fix', async () => {
    render(<Harness kind="markdown" mode="follow" />);
    const block = document.querySelector('[data-block-id="g"]')!;
    fireEvent.contextMenu(block);
    const toggle = await screen.findByRole('menuitemcheckbox', { name: /fixed height/i });
    fireEvent.click(toggle);
    // re-open the menu; the checkbox should now reflect fix (checked).
    fireEvent.contextMenu(block);
    const after = await screen.findByRole('menuitemcheckbox', { name: /fixed height/i });
    expect(after.getAttribute('aria-checked')).toBe('true');
  });

  test('unchecking "Fixed height" on a fix block writes follow', async () => {
    render(<Harness kind="markdown" mode="fix" />);
    const block = document.querySelector('[data-block-id="g"]')!;
    fireEvent.contextMenu(block);
    const toggle = await screen.findByRole('menuitemcheckbox', { name: /fixed height/i });
    fireEvent.click(toggle);
    fireEvent.contextMenu(block);
    const after = await screen.findByRole('menuitemcheckbox', { name: /fixed height/i });
    expect(after.getAttribute('aria-checked')).toBe('false');
  });

  test.each(['markdown', 'richtext', 'code'])(
    'the "Fixed height" toggle is present for follow-eligible kind "%s"',
    async (kind) => {
      render(<Harness kind={kind} />);
      const block = document.querySelector('[data-block-id="g"]')!;
      fireEvent.contextMenu(block);
      const toggle = await screen.findByRole('menuitemcheckbox', { name: /fixed height/i });
      expect(toggle).toBeTruthy();
    },
  );

  test('the "Fixed height" toggle is ABSENT for image (canFollow: false)', async () => {
    render(<Harness kind="image" mode="fix" />);
    const block = document.querySelector('[data-block-id="g"]')!;
    fireEvent.contextMenu(block);
    // wait for the menu itself, then assert no Fixed-height checkbox is in it.
    await screen.findByRole('menuitem', { name: /edit/i });
    expect(screen.queryByRole('menuitemcheckbox', { name: /fixed height/i })).toBeNull();
  });
});
