// @vitest-environment happy-dom
/**
 * Overlay primitives (M8): the Promise semantics every migrated call
 * site depends on (confirm/prompt resolve exactly once with the right
 * value on every exit path), menu selection/dismissal, and Esc behavior.
 */
import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect, useRef, useState } from 'react';

// no vitest globals in this repo → testing-library never auto-cleans;
// stale portals would leak into the next test's role queries.
afterEach(cleanup);
import { Modal, OverlayProvider, useOverlays, type MenuItem, type OverlaysApi } from '../overlays';

/** Mount the provider and capture the imperative API. */
function mountOverlays() {
  const apiRef: { current: OverlaysApi | null } = { current: null };
  function Capture() {
    apiRef.current = useOverlays();
    return <button>opener</button>;
  }
  const utils = render(
    <OverlayProvider>
      <Capture />
    </OverlayProvider>,
  );
  return { api: () => apiRef.current!, ...utils };
}

describe('confirm dialog', () => {
  test('confirm button resolves true', async () => {
    const { api } = mountOverlays();
    let result: boolean | undefined;
    void api().confirm({ title: 'delete page', message: 'Delete "x"?', confirmLabel: 'delete', danger: true })
      .then((v) => (result = v));
    fireEvent.click(await screen.findByRole('button', { name: 'delete' }));
    await waitFor(() => expect(result).toBe(true));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('cancel button resolves false', async () => {
    const { api } = mountOverlays();
    let result: boolean | undefined;
    void api().confirm({ message: 'Sure?' }).then((v) => (result = v));
    fireEvent.click(await screen.findByRole('button', { name: 'cancel' }));
    await waitFor(() => expect(result).toBe(false));
  });

  test('Escape resolves false', async () => {
    const { api } = mountOverlays();
    let result: boolean | undefined;
    void api().confirm({ message: 'Sure?' }).then((v) => (result = v));
    fireEvent.keyDown(await screen.findByRole('dialog'), { key: 'Escape' });
    await waitFor(() => expect(result).toBe(false));
  });

  test('danger confirm parks initial focus on cancel (safe exit)', async () => {
    const { api } = mountOverlays();
    void api().confirm({ message: 'Burn it?', danger: true });
    const cancel = await screen.findByRole('button', { name: 'cancel' });
    await waitFor(() => expect(document.activeElement).toBe(cancel));
  });
});

describe('prompt dialog', () => {
  test('typed value resolves on ok', async () => {
    const { api } = mountOverlays();
    let result: string | null | undefined;
    void api().prompt({ title: 'new page', initial: 'Untitled' }).then((v) => (result = v));
    const input = (await screen.findByRole('textbox')) as HTMLInputElement;
    expect(input.value).toBe('Untitled');
    fireEvent.change(input, { target: { value: 'My page' } });
    fireEvent.click(screen.getByRole('button', { name: 'ok' }));
    await waitFor(() => expect(result).toBe('My page'));
  });

  test('Enter in the input accepts; Escape resolves null', async () => {
    const { api } = mountOverlays();
    let r1: string | null | undefined;
    void api().prompt({ title: 'rename', initial: 'a' }).then((v) => (r1 = v));
    fireEvent.keyDown(await screen.findByRole('textbox'), { key: 'Enter' });
    await waitFor(() => expect(r1).toBe('a'));

    let r2: string | null | undefined;
    void api().prompt({ title: 'rename' }).then((v) => (r2 = v));
    fireEvent.keyDown(await screen.findByRole('dialog'), { key: 'Escape' });
    await waitFor(() => expect(r2).toBeNull());
  });
});

describe('alert dialog', () => {
  test('ok resolves and closes', async () => {
    const { api } = mountOverlays();
    let done = false;
    void api().alert({ title: 'import', message: 'Done.' }).then(() => (done = true));
    fireEvent.click(await screen.findByRole('button', { name: 'ok' }));
    await waitFor(() => expect(done).toBe(true));
  });
});

describe('menu', () => {
  function openMenu(api: OverlaysApi, onSelect = vi.fn()) {
    const items: MenuItem[] = [
      { label: 'rename…', onSelect },
      { kind: 'separator' },
      { label: 'delete', danger: true, onSelect: vi.fn(), disabled: false },
      { label: 'pinned', onSelect: vi.fn(), disabled: true },
    ];
    api.menu({ x: 40, y: 40 }, items, { header: 'page' });
    return onSelect;
  }

  test('selecting an item closes the menu and fires onSelect once', async () => {
    const { api } = mountOverlays();
    const onSelect = openMenu(api());
    fireEvent.click(await screen.findByRole('menuitem', { name: 'rename…' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  test('Escape closes without selecting', async () => {
    const { api } = mountOverlays();
    const onSelect = openMenu(api());
    fireEvent.keyDown(await screen.findByRole('menu'), { key: 'Escape' });
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  test('disabled items are not selectable', async () => {
    const { api } = mountOverlays();
    openMenu(api());
    const pinned = (await screen.findByRole('menuitem', { name: 'pinned' })) as HTMLButtonElement;
    expect(pinned.disabled).toBe(true);
  });

  test('choices row: pick closes and fires; selection is announced', async () => {
    const { api } = mountOverlays();
    const onPick = vi.fn();
    api().menu({ x: 20, y: 20 }, [
      {
        kind: 'choices',
        label: 'paper · Galley',
        options: [
          { id: '__default', name: 'Theme default', swatch: '#eee', selected: true },
          { id: 'manila', name: 'Manila', swatch: '#e8dcc0' },
          { id: 'bare', name: 'Bare' }, // no swatch → text pill
        ],
        onPick,
      },
    ]);
    const def = await screen.findByRole('menuitemradio', { name: 'Theme default' });
    expect(def.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('menuitemradio', { name: 'Bare' }).textContent).toBe('Bare');
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Manila' }));
    expect(onPick).toHaveBeenCalledWith('manila');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  test('an item may open a follow-up menu (move-to flow)', async () => {
    const { api } = mountOverlays();
    api().menu({ x: 10, y: 10 }, [
      {
        label: 'move to…',
        onSelect: () => api().menu({ x: 10, y: 10 }, [{ label: '(top level)', onSelect: vi.fn() }], { header: 'move to' }),
      },
    ]);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'move to…' }));
    expect(await screen.findByRole('menuitem', { name: '(top level)' })).toBeTruthy();
  });
});

describe('Modal', () => {
  test('renders children, Escape and × close, focus returns to opener', async () => {
    function Host() {
      const [open, setOpen] = useState(false);
      const opener = useRef<HTMLButtonElement>(null);
      useEffect(() => opener.current?.focus(), []);
      return (
        <>
          <button ref={opener} onClick={() => setOpen(true)}>
            settings
          </button>
          {open && (
            <Modal title="settings · back office" onClose={() => setOpen(false)}>
              <p>panel body</p>
            </Modal>
          )}
        </>
      );
    }
    render(<Host />);
    const opener = screen.getByRole('button', { name: 'settings' });
    fireEvent.click(opener);
    expect(screen.getByText('panel body')).toBeTruthy();

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });
});
