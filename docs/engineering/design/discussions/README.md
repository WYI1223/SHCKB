# Design discussions

Living **discussion records**——按事实对话顺序记录 framing 层 / 架构层 design discussion 的过程、参与者、findings、待决策项。**不**是决策本身，**不**是 ADR，**不**是 PRD，也**不**是二次总结稿。

## 跟其他 doc layer 关系

| Layer | 性质 | 何时用 |
|---|---|---|
| `_frozen/` | Immutable 历史 DI（design iteration 起源） | 深度审计 design 来源 |
| `decisions/` (ADR) | Append-only at `accepted` | 锁 technical decision |
| `discussions/` (本 folder) | **Living；append-only 记录事实对话过程** | reviewer / owner / claude 多方讨论中 |
| `contracts/` | Package contract index | 找包契约 |
| `runbooks/` | Operational docs | M2+ ops 任务 |
| `product/prd/` | Product truth (master) | product 决策 |

**核心区别**：
- ADR 锁 "决定了什么"；discussion record 记录 "讨论了什么 + 各方观点 + 哪些待决策"
- 一个 discussion record 可能 lead 到 0~N 个 ADR 或 PRD 修订
- 已 ratified 的决策**不应**留在 discussion record 里——迁到 ADR / PRD changelog

## 事实对话原则

Discussion record 的默认写法是 **append-only factual log**：

- 按讨论实际发生顺序追加，不重排旧内容。
- 不把多轮对话重新包装成一个更漂亮的二次总结。
- 记录 "谁提出了什么 / 谁回应了什么 / 哪个文件因此被建议或实际修改"。
- Reviewer 的判断可以记录，但应写成 "Reviewer said / recommended / raised"，不要改写成客观定论。
- Owner 的决定可以记录，但如果已经 ratified，最终产品事实应同步到 PRD / ADR / AUDIT；discussion 只保留当时对话事实。
- 如果旧条目需要纠正，不直接改写旧条目；追加 `Correction` 或 `Follow-up`，说明原条目哪里不准确。
- 允许修 typo、坏链接、metadata，但不得改变旧条目的含义。

## 命名约定

`<subject>-YYYY-MM-DD.md`

举例：
- `auth-setup-2026-05-17.md` — auth subsystem framing review
- `theme-cascade-2026-05-16.md` — theme system 4-layer cascade 讨论（如未来要写）

如果同一 subject 多轮 discussion 仍属于同一工作流，继续 append 到原 record，按日期 / turn 增加新条目。只有当 subject 明显变化、原 discussion 已关闭后重新开启、或需要保留独立审计边界时，才开新文件。

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

## Source

- Conversation / PR / review / issue source:
- Files under discussion:

## Dialogue Log

### YYYY-MM-DD — Turn 1

- **Owner / writer / reviewer**:
- **Response / challenge**:
- **Files mentioned**:
- **Action proposed or taken**:

### YYYY-MM-DD — Turn 2

- **Owner / writer / reviewer**:
- **Response / challenge**:
- **Files mentioned**:
- **Action proposed or taken**:

## Open Items

- <pending question or owner decision, as surfaced in the dialogue>

## Artifact Updates

- <append only: file changed / discussion created / AUDIT synced / no file change>

## References

- <links>

## Changelog
```

详 [doc-conventions.md](../../../process/methods/doc-conventions.md) cross-reference 风格。

## 与 AUDIT register 的关系

AUDIT (`docs/engineering/decisions/AUDIT-2026-05.md`) 是 **PRD-surfaced ADR debt register**——结构化、机械的 debt list + status。

Discussion record 是 **append-only 的事实对话过程**——含 reasoning / nuance / withdrawn 路径 / methodology lesson，但不重新组织成事后总结。

两者 cross-ref：
- AUDIT 加 surfaced debt 时引用 discussion record（如有）
- Discussion record 引用 AUDIT 当前对应 entry

## Changelog

- 2026-05-17 initial（folder 制度 + 第一份 record `auth-setup-2026-05-17.md`）
- 2026-05-22 template update：discussion records 改为 append-only factual log；同一工作流继续追加；不再鼓励把多轮对话二次总结成 Section A/B/C 结论稿。
