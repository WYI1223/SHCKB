# Engineering

工程视角文档。HOW the system is built —— design discussions / architecture decisions / operational guides。

## 子目录

- [`design/`](./design/) —— **Design discussions (DI docs)**
  - [`_frozen/`](./design/_frozen/) —— Historical discussion records；完全 frozen
  - 顶层 living DI docs —— mental-model / architecture-overview / bootstrap-evolution / ux-design-intent；持续更新
- [`decisions/`](./decisions/) —— **ADRs**（append-only；锁定后不改）
- [`runbooks/`](./runbooks/) —— **Operational guides**（部署 / backup / migrate / troubleshoot）；living

## 何时读哪个

| 想知道 | 去哪 |
|---|---|
| 系统当前怎么 compose 起来 | [`design/architecture-overview.md`](./design/architecture-overview.md) |
| 某个具体决策为什么这么定 | [`decisions/`](./decisions/) ADR-XXXX |
| 怎么部署 / 维护 / 备份 | [`runbooks/`](./runbooks/) |
| 决策的完整 discussion / 怎么辩论出来的 | [`design/_frozen/`](./design/_frozen/) |
| 心智模型（"这是 canvas，不是 doc"）| [`design/mental-model.md`](./design/mental-model.md) |
| 实施顺序 / M1-M4 | [`design/bootstrap-evolution.md`](./design/bootstrap-evolution.md) |

## DI doc vs ADR 边界

- **DI doc** = 设计 discussion / 探索过程 / 替代方案 / framing critique；**可更新**（living）或**完全 frozen**（historical record）
- **ADR** = 锁定的决策；**append-only**；改决策 → 新 ADR with `Supersedes:` field

详见 [`../process/methods/adr-discipline.md`](../process/methods/adr-discipline.md) + [`../process/methods/di-doc-class.md`](../process/methods/di-doc-class.md)。
