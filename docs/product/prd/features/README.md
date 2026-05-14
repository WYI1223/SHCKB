# Feature PRDs

每个核心功能一份；按 feature scope 命名（不按 plugin 拆 —— plugin 是实现层，feature 是产品概念层）。

## 当前 feature PRD 列表（Phase E 待写）

| Feature | 文件 | Status |
|---|---|---|
| Canvas-based note editing | `canvas-editing.md` | TODO |
| Multi-plugin block system (extensibility) | `plugin-system.md` | TODO |
| AI integration (in-app + external client) | `ai-integration.md` | TODO |
| Discussion (per-block opt-in) | `discussion.md` | TODO |
| Self-host deployment (5 modes) | `self-host-deploy.md` | TODO |
| Authentication + multi-user | `authentication.md` | TODO |
| Search + cross-note discovery | `search-discovery.md` | TODO |

## Feature PRD template

```markdown
# Feature PRD: <name>

## Status
draft / in-progress / shipped / deprecated

## Overview
（1 段：这个 feature 是什么）

## User stories
- As <role>, I want to <action>, so that <benefit>

## Functional requirements
（具体能做什么 / 不能做什么）

## Non-functional requirements
- Performance budget
- A11y level
- Security

## Acceptance criteria
（M-milestone 中此 feature 算 done 的判定）

## Edge cases
（非典型场景 + 期望行为）

## Dependencies
- ADR-XXXX: <decision>
- Feature-Y (must ship before this)

## Open questions
（未决 / 待 owner 确认）

## Changelog
- YYYY-MM-DD initial draft
```
