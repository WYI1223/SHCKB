import { describe, expect, test } from 'vitest';
import { resolveTarget, surfaceOf } from '../useNavigateToPage';

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
