// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest';
import type React from 'react';
import { authorSurfaceOf, currentId, makeLinkClickHandler, resolveTarget, surfaceOf } from '../useNavigateToPage';

describe('surfaceOf', () => {
  test.each([
    ['/edit/A', 'edit'], ['/view/A', 'view'], ['/read/A', 'read'],
    ['/notes/A', 'note'], ['/', 'other'], ['/login', 'other'],
  ])('%s -> %s', (path, s) => expect(surfaceOf(path)).toBe(s));
});

describe('authorSurfaceOf (sidebar/toggle mode source)', () => {
  // The author has two live surfaces — edit + view. This collapses any path to
  // the one the sidebar/toggle should reflect: 'view' only while explicitly
  // previewing, else 'edit'. read/note/other are not author working surfaces.
  test.each([
    ['/edit/A', 'edit'], ['/view/A', 'view'],
    ['/read/A', 'edit'], ['/notes/A', 'edit'], ['/', 'edit'], ['/login', 'edit'],
  ])('%s -> %s', (path, s) => expect(authorSurfaceOf(path)).toBe(s));
});

describe('currentId', () => {
  test('extracts the id segment', () => expect(currentId('/edit/A')).toBe('A'));
  test('decodes percent-encoding', () => expect(currentId('/view/p%2Fx')).toBe('p/x'));
  test('empty on a non-page route', () => expect(currentId('/')).toBe(''));
});

describe('resolveTarget (all-id, surface-preserving)', () => {
  test('edit -> /edit/:id', () =>
    expect(resolveTarget('/edit/A', { pageId: 'B' })).toEqual({ kind: 'navigate', to: '/edit/B' }));
  test('view -> /view/:id', () =>
    expect(resolveTarget('/view/A', { pageId: 'B' })).toEqual({ kind: 'navigate', to: '/view/B' }));
  test('read stays read (not note)', () =>
    expect(resolveTarget('/read/A', { pageId: 'B' })).toEqual({ kind: 'navigate', to: '/read/B' }));
  test('note stays note', () =>
    expect(resolveTarget('/notes/A', { pageId: 'B' })).toEqual({ kind: 'navigate', to: '/notes/B' }));
  test('other defaults to view', () =>
    expect(resolveTarget('/', { pageId: 'B' })).toEqual({ kind: 'navigate', to: '/view/B' }));
  test('cross-page block adds #blockId', () =>
    expect(resolveTarget('/read/A', { pageId: 'B', blockId: 'b1' })).toEqual({ kind: 'navigate', to: '/read/B#b1' }));
  test('same-page block -> pure scroll (read surface, by id)', () =>
    expect(resolveTarget('/read/A', { pageId: 'A', blockId: 'b1' })).toEqual({ kind: 'scroll', blockId: 'b1' }));
  test('same-page block -> pure scroll (note surface too)', () =>
    expect(resolveTarget('/notes/A', { pageId: 'A', blockId: 'b1' })).toEqual({ kind: 'scroll', blockId: 'b1' }));
  test('encodes id + blockId', () =>
    expect(resolveTarget('/edit/A', { pageId: 'p/x', blockId: 'b#1' }))
      .toEqual({ kind: 'navigate', to: '/edit/p%2Fx#b%231' }));
});

describe('makeLinkClickHandler', () => {
  function fakeClick(href: string, attrs: Record<string, string> = {}) {
    const a = document.createElement('a');
    a.setAttribute('href', href);
    for (const [k, v] of Object.entries(attrs)) a.setAttribute(k, v);
    document.body.appendChild(a);
    let prevented = false;
    return {
      a,
      ev: { target: a, button: 0, defaultPrevented: false, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, preventDefault: () => { prevented = true; } } as any,
      get prevented() { return prevented; },
    };
  }

  test('data-skb-page link -> nav(ref) + preventDefault', () => {
    const seen: any[] = [];
    const h = makeLinkClickHandler((r) => seen.push(r));
    const c = fakeClick('/p/B', { 'data-skb-page': 'B', 'data-skb-block': 'b1' });
    h(c.ev);
    expect(seen).toEqual([{ pageId: 'B', blockId: 'b1' }]);
    expect(c.prevented).toBe(true);
  });
  test('bare /p/:id link -> parsed ref', () => {
    const seen: any[] = [];
    const h = makeLinkClickHandler((r) => seen.push(r));
    h(fakeClick('/p/B').ev);
    expect(seen).toEqual([{ pageId: 'B' }]);
  });
  test('external link -> ignored', () => {
    const seen: any[] = [];
    const h = makeLinkClickHandler((r) => seen.push(r));
    const c = fakeClick('https://example.com');
    h(c.ev);
    expect(seen).toEqual([]);
    expect(c.prevented).toBe(false);
  });
  test('modified click (new-tab) -> passes through, not intercepted', () => {
    const seen: any[] = [];
    const h = makeLinkClickHandler((r) => seen.push(r));
    const c = fakeClick('/p/B', { 'data-skb-page': 'B' });
    h({ ...c.ev, metaKey: true });
    expect(seen).toEqual([]);
    expect(c.prevented).toBe(false);
  });
});
