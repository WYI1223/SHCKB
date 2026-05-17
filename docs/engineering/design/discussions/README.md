# Design discussions

Living **discussion records**——记录 framing 层 / 架构层 design discussion 的过程、参与者、findings、待决策项。**不**是决策本身，**不**是 ADR，**不**是 PRD。

## 跟其他 doc layer 关系

| Layer | 性质 | 何时用 |
|---|---|---|
| `_frozen/` | Immutable 历史 DI（design iteration 起源） | 深度审计 design 来源 |
| `decisions/` (ADR) | Append-only at `accepted` | 锁 technical decision |
| `discussions/` (本 folder) | **Living；记录讨论过程** | reviewer / owner / claude 多方讨论中 |
| `contracts/` | Package contract index | 找包契约 |
| `runbooks/` | Operational docs | M2+ ops 任务 |
| `product/prd/` | Product truth (master) | product 决策 |

**核心区别**：
- ADR 锁 "决定了什么"；discussion record 记录 "讨论了什么 + 各方观点 + 哪些待决策"
- 一个 discussion record 可能 lead 到 0~N 个 ADR 或 PRD 修订
- 已 ratified 的决策**不应**留在 discussion record 里——迁到 ADR / PRD changelog

## 命名约定

`<subject>-YYYY-MM-DD.md`

举例：
- `auth-setup-2026-05-17.md` — auth subsystem framing review
- `theme-cascade-2026-05-16.md` — theme system 4-layer cascade 讨论（如未来要写）

如果同一 subject 多轮 discussion，开新文件加日期；不 append-only 单文件。

## 何时写 discussion record

**写**：
- 新 PRD / ADR initial draft 后 reviewer 给 multi-findings 时
- 跨多个 stakeholder 的 framing 决策（reviewer + owner + claude 多方）
- Multi-round review 触发的 layer / scope reframe
- 涉及多个 PRD / ADR 反向 sync 的 architectural reframe

**不写**：
- 单点 typo / hygiene fix
- 已 ratified 决策的执行（直接进 PRD / ADR commit + AUDIT entry）
- 仅 implementation detail 讨论（归 implementation phase notes）

## Record 结构（推荐 template）

```markdown
# Discussion Record: <Subject>

| Field | Value |
| Date | YYYY-MM-DD |
| Subject | <topic> |
| Participants | <list> |
| Trigger | <what initiated> |
| Status | <pending / partially ratified / closed> |
| Output target | <which PRD/ADR will be revised> |

## Context
## Section A — Reviewer / external findings
## Section B — Internal challenges / counter-proposals
## Section C — Connected reframes (consequence)
## Section D — Pending owner decisions
## Section E — References
## Changelog
```

详 [doc-conventions.md](../../../process/methods/doc-conventions.md) cross-reference 风格。

## 与 AUDIT register 的关系

AUDIT (`docs/engineering/decisions/AUDIT-2026-05.md`) 是 **PRD-surfaced ADR debt register**——结构化、机械的 debt list + status。

Discussion record 是 **未结构化的讨论过程**——含 reasoning / nuance / withdrawn 路径 / methodology lesson。

两者 cross-ref：
- AUDIT 加 surfaced debt 时引用 discussion record（如有）
- Discussion record 引用 AUDIT 当前对应 entry

## Changelog

- 2026-05-17 initial（folder 制度 + 第一份 record `auth-setup-2026-05-17.md`）
