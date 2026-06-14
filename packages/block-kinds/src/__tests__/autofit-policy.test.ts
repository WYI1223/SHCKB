import { describe, expect, test } from 'vitest';
import { blockModule } from '../registry';

describe('per-kind autofit policy', () => {
  test('text kinds default to grow', () => {
    for (const k of ['markdown', 'richtext', 'code']) {
      expect(blockModule(k)?.autofit).toEqual({ default: 'grow' });
    }
  });
  test('image is autofit-unavailable', () => {
    expect(blockModule('image')?.autofit).toBe(false);
  });
});
