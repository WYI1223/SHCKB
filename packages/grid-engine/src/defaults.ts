/**
 * @skb/grid-engine — engine-level constants.
 *
 * Kind-keyed default sizes moved OUT of the engine (target contract):
 * the engine is kind-opaque; default sizes belong to the block-kind
 * module layer. Callers pass an explicit size to inferDropIntent.
 */

export const TOTAL_COLS = 12;
