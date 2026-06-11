# `@skb/grid-engine`

Headless 2D AABB layout engine —— `@skb` monorepo 的依赖图叶子包。Pure functions on `GridState`；不依赖 React / DOM / 任何 framework / 任何 runtime library。

## 当前状态

- ✅ Source 已自 carryover 提升至 `./src/`（2026-06-11，MVP Task 2；详 [ADR-0019]）
- ✅ Target contract 落地：`BlockKind = string`（kind-opaque）/ `inferDropIntent(state, cursor, size)` / `validateState(state, opts?)` 含 gravity-stability 检查
- ✅ 测试 44/44 green（`bun run --filter @skb/grid-engine test`）

## 消费方式

```ts
import {
  createEmptyState, insertBlock, moveBlock, resizeBlock, transformBlock, deleteBlock,
  applyGravity, inferDropIntent, validateState,
  type Block, type BlockSize, type GridState, type OpResult,
} from '@skb/grid-engine';
```

Client（编辑交互）与 server（落库前复验）消费同一份纯函数——consumer guidance 详 [CONTRACT.md](./CONTRACT.md)。

## References

- Contract: [CONTRACT.md](./CONTRACT.md)
- MVP 决策: [ADR-0019](../../docs/engineering/decisions/ADR-0019-mvp-implementation-baseline.md)
- Indexed at: [contracts/README.md](../../docs/engineering/contracts/README.md)
