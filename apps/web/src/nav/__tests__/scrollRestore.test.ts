import { describe, expect, test } from 'vitest';
import { __store as store } from '../useScrollRestore';

describe('scroll-position store', () => {
  test('stash + read back per (pageId, surface)', () => {
    store.set('view', 'P1', 120);
    store.set('edit', 'P1', 40);
    expect(store.get('view', 'P1')).toBe(120);
    expect(store.get('edit', 'P1')).toBe(40);
    expect(store.get('view', 'P2')).toBeUndefined();
  });
});
