# DI Doc Class

**Status**: living
**Last updated**: 2026-05-13
**Source**: `engineering/design/_frozen/architecture-rebuild-2026-05-11.md` §10

DI doc (Discussion-Informed document) 的定义、何时用、何时不用、Living vs Frozen 边界。

## 什么是 DI doc

DI doc = **讨论过程的沉淀**。不是：
- ❌ ADR（ADR 是 lock 后的简洁决策记录）
- ❌ Plan（plan 是 stage execution roadmap）
- ❌ Retro（retro 是 wave / 事件 close 后的回顾）
- ❌ Spec（spec 是 fully locked requirements）

DI doc **是**：
- ✅ 谁说了什么（quote-level fidelity）
- ✅ 哪些是 LOCKED 决策（user-driven）
- ✅ 哪些是 PROPOSED synthesis（gatekeeper-driven，待 confirm）
- ✅ 哪些是 OPEN questions
- ✅ 暴露的 cognitive defaults / framing biases
- ✅ 后续 ADR / PRD / living docs 的输入材料

## 路径 + 命名

| 类型 | 路径 | 命名 |
|---|---|---|
| **Frozen DI** | `engineering/design/_frozen/<topic>-<YYYY-MM-DD>.md` | 主题 + 起始讨论日期 |
| **Living DI** | `engineering/design/<topic>.md` | 主题，无日期（持续更新） |

Date 是讨论**发生**日，不是 lock 日。

## Frozen DI vs Living DI 边界

### Frozen DI

**性质**：完成一轮重大设计 discussion 后，把整个 conversation **冻结** 作 historical record。

**修改规则**：
- ❌ Contributor / gatekeeper / AI 不改
- ✅ Owner 可 fix typo / link / 渲染问题
- ❌ 不删除（这是源头 trace）
- ❌ 不补充新决策（新决策写新 ADR / 新 DI）

**何时新建**：
- 完成一轮深度 framing critique + 决策 emerge 的 conversation 后
- 内容 ≥ 一定篇幅（几百行 +）+ 跨多决策
- 想保留 quote-level discussion 给未来审计 / teaching 用

### Living DI

**性质**：持续更新的 design reference；通常是 cross-ADR integration view 或心智模型。

**修改规则**：
- ✅ 可持续更新；commit message 标 `living: update <name> for <reason>`
- ✅ 改时同步更新 `Last updated:` field
- ❌ 不维护内置 changelog（git log 够）
- ✅ 顶部含 `Status: living` + `Last updated: YYYY-MM-DD` + `Source ADRs: <list>`

**何时新建**：
- 跨多 ADR 的高层 integration view（如 architecture-overview）
- 心智模型 / 范畴 reframe 的核心表达（如 mental-model）
- 长期规划 / roadmap（如 bootstrap-evolution）
- 跨功能 UX 原则（如 ux-design-intent）

## DI doc 写作 patterns

### Status markers

每个 section / sub-decision 顶部标：

- **LOCKED YYYY-MM-DD** —— user 已决；不再讨论
- **PROPOSED** —— gatekeeper 提案；待 user confirm
- **OPEN** —— 未决；待讨论
- **CLOSED** —— 被其他 section 替代 / absorbed；保留作 trace

### 元 reframe

User push back gatekeeper 时记录："User XXXX-XX-XX: '<quote>'" + 接下来 gatekeeper 怎么 reframe。这是 cognitive default 暴露的关键 record。

### Cognitive defaults section

每个 DI doc 推荐有一节专门列**这次 discussion 暴露的 cognitive defaults**（gatekeeper 的隐性默认值，user 没明说就预设的）。

例：`architecture-rebuild-2026-05-11.md` §8 列了 8 条 cognitive defaults。

## DI doc → ADR → Living doc 流转

```
1. 重大 discussion 发生
   ↓
2. 边讨论边写 DI doc（最初是 working doc）
   ↓
3. 决策 lock 后 → frozen DI doc 冻结
   ↓
4. 决策提取成 ADR（一个 DI 通常 yield 多个 ADR）
   ↓
5. Cross-ADR integration view 写 living docs
   ↓
6. Retrospective 提取 cognitive defaults / framing failures 到 retrospectives/
```

每一步**都引用上一步**作 source。可追溯。

## 何时不写 DI doc

- 小决策（< 30 min 讨论）→ 直接进 ADR
- Pure mechanical 实施细节 → 进 runbook / SOP
- Bug fix / feature flag 等不涉及 framing → 不需要 DI

## DI doc 的反模式

- ❌ 把 ADR 当 DI 写（太多 discussion 在 ADR 里 → ADR 应当简洁）
- ❌ Frozen DI 改了实质内容（违反 frozen 规则）
- ❌ Living DI 锁死不更新（违反 living 性质 → 应转 frozen 或删）
- ❌ 多个 living DI 内容重复（应有清晰职责划分；冲突时 reframe）
- ❌ DI doc 不引用 user 原话 / 不保留 quote-level fidelity（失去 framing 暴露价值）
