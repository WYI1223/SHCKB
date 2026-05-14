/**
 * THROWAWAY — root component for the grid UI prototype.
 *
 * Owns the GridState via useGridInteraction. Switching theme variants
 * (via the floating bottom chip) PRESERVES the state — same blocks,
 * same positions, different render style. This is the load-bearing
 * test: same engine + ops, 3 different themes, all must feel right.
 */
import { useEffect, useState } from 'react';
import { MiniPalette } from './MiniPalette';
import {
  getCurrentVariant,
  PrototypeSwitcher,
  type VariantKey,
} from './PrototypeSwitcher';
import { useGridInteraction } from './useGridInteraction';
import { VariantA } from './variants/VariantA';
import { VariantB } from './variants/VariantB';
import { VariantC } from './variants/VariantC';

export function GridPrototype(): React.JSX.Element {
  const [variant, setVariant] = useState<VariantKey>('A');
  const interaction = useGridInteraction();

  useEffect(() => {
    setVariant(getCurrentVariant());
  }, []);

  return (
    <>
      {variant === 'A' && <VariantA interaction={interaction} />}
      {variant === 'B' && <VariantB interaction={interaction} />}
      {variant === 'C' && <VariantC interaction={interaction} />}
      <MiniPalette interaction={interaction} />
      <PrototypeSwitcher current={variant} />
    </>
  );
}
