import { describe, expect, test } from 'vitest';
import { resolveSkin, skinOptionsFor, DEFAULT_SKIN_ID } from '../skin';
import type { BlockSkin, Theme } from '../index';

const paper: BlockSkin = { id: 'paper', name: 'Paper', box: { style: { padding: '10px' } } };
const polaroid: BlockSkin = { id: 'polaroid', name: 'Polaroid', kinds: ['image'], box: { style: {} } };
const card: BlockSkin = { id: 'card', name: 'Card', box: { style: {} } };

const theme = {
  defaultSkin: (kind: string) => (kind === 'image' ? polaroid : paper),
  skins: { card },
} as unknown as Theme;

describe('resolveSkin', () => {
  test('author-picked skin wins when it applies to the kind', () => {
    expect(resolveSkin(theme, 'markdown', 'card').id).toBe('card');
  });
  test('falls back to the theme default skin (per kind) when no pick', () => {
    expect(resolveSkin(theme, 'markdown', null).id).toBe('paper');
    expect(resolveSkin(theme, 'image', null).id).toBe('polaroid');
  });
  test('falls back to the framework DEFAULT_SKIN when the theme has none', () => {
    expect(resolveSkin({} as Theme, 'markdown', null).id).toBe(DEFAULT_SKIN_ID);
  });
  test('a skin not applicable to the kind is ignored (falls back)', () => {
    const t = { skins: { polaroid }, defaultSkin: paper } as unknown as Theme;
    expect(resolveSkin(t, 'markdown', 'polaroid').id).toBe('paper');
  });
});

describe('skinOptionsFor', () => {
  test('lists author-pickable skins applicable to the kind', () => {
    const t = { skins: { card, polaroid }, defaultSkin: paper } as unknown as Theme;
    expect(skinOptionsFor(t, 'markdown')).toEqual([{ id: 'card', name: 'Card' }]);
    expect(skinOptionsFor(t, 'image').map((o) => o.id).sort()).toEqual(['card', 'polaroid']);
  });
});
