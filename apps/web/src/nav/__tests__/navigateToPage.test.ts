// @vitest-environment happy-dom
import { describe, expect, test, vi } from 'vitest';
import type React from 'react';
import { makeLinkClickHandler, resolveTarget, surfaceOf } from '../useNavigateToPage';
import type { LinkRef } from '@skb/block-kinds';

describe('surfaceOf', () => {
  test.each([
    ['/edit/abc', 'editor'],
    ['/view/abc', 'view'],
    ['/notes/some-slug', 'public'],
    ['/', 'other'],
  ])('%s → %s', (path, expected) => expect(surfaceOf(path)).toBe(expected));
});

describe('resolveTarget', () => {
  test('editor → editor route by id (mode preserved)', () => {
    expect(resolveTarget('/edit/A', { pageId: 'B' })).toEqual({ kind: 'navigate', to: '/edit/B' });
  });
  test('view → view route by id', () => {
    expect(resolveTarget('/view/A', { pageId: 'B' })).toEqual({ kind: 'navigate', to: '/view/B' });
  });
  test('cross-page block target carries the hash', () => {
    expect(resolveTarget('/edit/A', { pageId: 'B', blockId: 'X' })).toEqual({ kind: 'navigate', to: '/edit/B#X' });
  });
  test('same-page block target = pure scroll (no navigation)', () => {
    expect(resolveTarget('/edit/A', { pageId: 'A', blockId: 'X' })).toEqual({ kind: 'scroll', blockId: 'X' });
  });
  test('public surface falls back to the /p/:id permalink (full nav)', () => {
    expect(resolveTarget('/notes/s', { pageId: 'B', blockId: 'X' })).toEqual({ kind: 'permalink', to: '/p/B#X' });
  });
});

describe('makeLinkClickHandler', () => {
  /** Build a plain-click event whose target is a fresh anchor with the given attrs. */
  function clickOn(attrs: Record<string, string>) {
    const a = document.createElement('a');
    for (const [k, v] of Object.entries(attrs)) a.setAttribute(k, v);
    const preventDefault = vi.fn();
    const e = { defaultPrevented: false, button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, target: a, preventDefault } as unknown as React.MouseEvent;
    return { e, preventDefault };
  }

  test('materialized /notes/:slug href → toPath (client nav), nav not called', () => {
    const nav = vi.fn();
    const toPath = vi.fn();
    const { e, preventDefault } = clickOn({ href: '/notes/my-note#b9', 'data-skb-page': 'pg1', 'data-skb-block': 'b9' });
    makeLinkClickHandler(nav, toPath)(e);
    expect(toPath).toHaveBeenCalledWith('/notes/my-note#b9');
    expect(nav).not.toHaveBeenCalled();
    expect(preventDefault).toHaveBeenCalled();
  });

  test('unresolved /p/:id href (data-skb-page) → nav with LinkRef, toPath untouched', () => {
    const nav = vi.fn();
    const toPath = vi.fn();
    const { e } = clickOn({ href: '/p/pg2', 'data-skb-page': 'pg2', 'data-skb-block': 'b3' });
    makeLinkClickHandler(nav, toPath)(e);
    expect(toPath).not.toHaveBeenCalled();
    expect(nav).toHaveBeenCalledWith({ pageId: 'pg2', blockId: 'b3' } satisfies LinkRef);
  });

  test('without toPath (Editor/View call sites) behavior is unchanged', () => {
    const nav = vi.fn();
    const { e, preventDefault } = clickOn({ href: '/p/pg9' });
    makeLinkClickHandler(nav)(e); // one-arg call site still compiles + works
    expect(nav).toHaveBeenCalledWith({ pageId: 'pg9' } satisfies LinkRef);
    expect(preventDefault).toHaveBeenCalled();
  });

  test('modified click (cmd/ctrl/new-tab) passes through untouched', () => {
    const nav = vi.fn();
    const toPath = vi.fn();
    const a = document.createElement('a');
    a.setAttribute('href', '/notes/x');
    const preventDefault = vi.fn();
    const e = { defaultPrevented: false, button: 0, metaKey: true, ctrlKey: false, shiftKey: false, altKey: false, target: a, preventDefault } as unknown as React.MouseEvent;
    makeLinkClickHandler(nav, toPath)(e);
    expect(toPath).not.toHaveBeenCalled();
    expect(nav).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });

  test('external link (no data-skb-page, not /notes/, not /p/) is ignored', () => {
    const nav = vi.fn();
    const toPath = vi.fn();
    const { e, preventDefault } = clickOn({ href: 'https://example.com' });
    makeLinkClickHandler(nav, toPath)(e);
    expect(toPath).not.toHaveBeenCalled();
    expect(nav).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });
});
