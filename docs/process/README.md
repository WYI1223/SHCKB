# Process

How we work —— method docs / SOP / 文档分类规则。

## 子目录

- [`methods/`](./methods/) —— Method docs：DI doc class / ADR discipline / SOP（待写）

## 当前 method docs

- [`methods/adr-discipline.md`](./methods/adr-discipline.md) —— ADR append-only 规则 + template + supersede 机制
- [`methods/di-doc-class.md`](./methods/di-doc-class.md) —— DI doc 定义 + 何时用 / 不用 / Living vs Frozen 边界

## 待写（下一轮）

- `methods/sop-bootstrap.md` —— M1 启动 SOP（"建新 component / 加 plugin / 写 PRD" 的标准动作）
- `methods/sop-adr-authoring.md` —— ADR 起草到 lock 的标准流程
- `methods/sop-pr-review.md` —— PR review 检查清单
- `methods/sop-shadcn-add.md` —— shadcn ui CLI add 治理流程（per ADR-0016）

## 文档分类规则一览

| 类型 | 路径 | 修改规则 |
|---|---|---|
| Project PRD | `product/prd/project.md` | Living + changelog |
| Feature PRD | `product/prd/features/*.md` | Living + changelog |
| Retrospective | `product/retrospectives/*.md` | 写完不改 |
| Frozen DI | `engineering/design/_frozen/*.md` | Owner-only typo fix；不改实质 |
| Living DI | `engineering/design/*.md` | Living；commit message `living:` |
| ADR | `engineering/decisions/ADR-XXXX-*.md` | **Append-only**；新 ADR supersede |
| Runbook | `engineering/runbooks/*.md` | Living；版本演化时更新 |
| Method doc | `process/methods/*.md` | Living；workflow 调整时更新 |
