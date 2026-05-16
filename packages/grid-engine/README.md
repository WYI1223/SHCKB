# `@skb/grid-engine`

Headless 2D AABB layout engine —— `@skb` monorepo 的依赖图叶子包。Pure functions on `GridState`；不依赖 React / DOM / Drizzle / Lexical / 等任何 framework。

- **Contract**（types / ops / invariants / consumer guidance）: [CONTRACT.md](./CONTRACT.md)
- **Architectural decisions**: [ADR-0003](../../docs/engineering/decisions/ADR-0003-grid-engine-contract.md)
- **Indexed at**: [`docs/engineering/contracts/README.md`](../../docs/engineering/contracts/README.md)

## 当前状态

- ✅ Contract 已定（本目录 + 上述 ADR）
- ⏳ Source 仍在 `carryover/packages/grid-engine/src/`（45/45 scenarios + 50k stress validated；Option A locked）
- ⏳ Phase F（carryover 清理）时 source 提升至 `./src/`，加 `package.json` / `tsconfig.json` / `vitest.config.ts`

## 消费方式（after Phase F）

```ts
import {
  createEmptyState, insertBlock, moveBlock, resizeBlock, deleteBlock,
  applyGravity, inferDropIntent, validateState,
  type Block, type GridState, type OpResult,
} from '@skb/grid-engine';
```
