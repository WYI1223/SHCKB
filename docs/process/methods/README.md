# Methods

How we work —— method docs / SOP / 文档约定。

## 当前 method docs

| 文件 | 主题 |
|---|---|
| [`adr-discipline.md`](./adr-discipline.md) | ADR append-only 规则 / template / supersede 机制 / Status 流转 |
| [`di-doc-class.md`](./di-doc-class.md) | DI doc 定义 / Living vs Frozen 边界 / 何时写不写 / DI→ADR→Living 流转 |

## 待写（下一轮 SOP）

- `sop-bootstrap.md` —— M1 启动 SOP
- `sop-adr-authoring.md` —— ADR 起草到 lock 的标准流程
- `sop-pr-review.md` —— PR review 检查清单
- `sop-shadcn-add.md` —— shadcn ui CLI add 治理流程

## 这些文档的角色

Method docs 是 process-level 的 "**怎么做事**" reference：

- 不是 product feature
- 不是 architecture decision
- 是 contributor 在 day-to-day workflow 中需要遵守的 conventions / disciplines / processes

新 contributor onboarding 应当先读这里再开始写代码 / 写 ADR / 改 doc。
