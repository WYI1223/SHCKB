import { describe, expect, test } from 'vitest';
import { blockModule } from '../registry';

describe('per-kind autofit policy (follow/fix)', () => {
  test('text kinds default to follow', () => {
    for (const k of ['markdown', 'richtext', 'code']) {
      expect(blockModule(k)?.autofit).toEqual({ default: 'follow' });
    }
  });
  test('image is fix-only (cannot follow)', () => {
    expect(blockModule('image')?.autofit).toEqual({ default: 'fix', canFollow: false });
  });
});
