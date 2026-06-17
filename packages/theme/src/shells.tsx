/**
 * Generic skins any token-only theme can curate (M6-D3 → unified-block-capability).
 * A theme opts in by listing them in its `skins` map — declaration is
 * implementation, there is no second branch to keep in sync.
 */
import type { BlockSkin } from './skin';

/** 'flat': no card chrome — content sits directly on the canvas.
 * Color comes from the theme default/tokens via the host's token cascade. */
export const flatSkin: BlockSkin = {
  id: 'flat',
  name: 'Flat',
  box: {
    className: 'skb-block',
    style: {
      padding: '8px 10px',
      fontSize: '14px',
      lineHeight: 1.55,
    },
  },
};
