# ADR-0010: Performance budget + Lighthouse acceptance

> **DEPRECATED / LEGACY DRAFT (2026-05-23)**: This ADR is retained only as historical carryover. It MUST NOT be used as an authoritative source for product behavior, architecture, implementation plan, or technology-stack choice. Technology choices must be derived from current PRDs and product shape, then captured in new PRD-informed ADRs. Treat any Decision/Consequences/technology names below as suspect until re-ratified.

| Field | Value |
|---|---|
| Status | deprecated (legacy draft; PRD-rework required) |
| Date | 2026-05-13 |
| Authors | W_YI + gatekeeper Claude Opus 4.7 |
| Supersedes | — |
| Superseded by | — |
| Source DI doc | `engineering/design/_frozen/architecture-rebuild-2026-05-11.md` §11.10 |

## Context

User raised "能否在 Google PageSpeed Insights / Lighthouse 拿到高分数？" 后续追加"性能不能有明显差距"作 backend hard requirement。

Performance 必须 day-1 嵌入架构（build-in，不是事后优化）；多 operator scale 谱（solo NAS → public 高并发）下都要保证 baseline。

## Decision

### Front-end Lighthouse acceptance（public read mode）

**LOCK target: Lighthouse mobile score ≥ 90** as CI gate。

| 指标 | 目标 | Levers |
|---|---|---|
| **TTFB** | < 200ms | DB query 优化 / 服务器到边缘距离 / SSR 不阻塞 stream |
| **FCP / LCP** | < 1.8s / < 2.5s | 关键 CSS inline；critical HTML stream；preload critical fonts；图片 srcset + WebP；非关键 JS defer |
| **CLS** | < 0.1 | grid 模型天然 CLS-friendly（block 尺寸 SSR-知）；字体 preload + fallback metric matching |
| **TBT / INP** | < 200ms / < 200ms | JS code split per route + per plugin；Pyodide lazy mount；heavy plugins 不阻塞 main thread |
| **JS bundle** | initial < 100KB | per-plugin import；plugin not on note → not loaded；core editor shell 拆 read-only / edit 两个 bundle |
| **Cache** | Public note immutable-ish | `Cache-Control: public, max-age=300, stale-while-revalidate`；CDN edge caching；mutation 触发 invalidation |

### Heavy block handling

保留 `HeavyBlockBoundary` 思路（SSR skeleton + 客户端 hydrate）。Pyodide / TensorFlow.js / React Flow 等 heavy lib **不在初始 bundle**；只在 corresponding plugin 实际 mount 时 lazy load。

### Backend SLO（per single instance）

| 指标 | 目标 (median) |
|---|---|
| Per-request CPU (read SSR) | < 30ms |
| Per-request CPU (write mutation) | < 50ms |
| Memory baseline (idle) | < 80MB |
| Memory under load (100 concurrent) | < 200MB |
| Concurrent WebSocket | > 1000 |
| Cold start (Bun binary) | < 100ms |

Bun + Drizzle SQLite / Postgres 在这些 baseline 下都 hit。

### CI 强制

- Lighthouse-CI 跑 `/` 和 `/notes/:slug` (sample note)；mobile profile；score < 90 = CI fail
- Optional: 跑 cross-viewport (mobile / tablet / desktop)
- Build job 出 bundle size report；> 100KB initial → CI fail

## Consequences

**Positive**:
- Performance 成 product acceptance criterion，不是事后任务
- Plugin author 知道有 budget，自然控 bundle size
- Self-host operator 装在低配 NAS 也能 work；不被臃肿 frontend 拖累

**Negative / Trade-offs**:
- Heavy plugin（jupyter / nn-viz）需要 hydration boundary 设计；增加 plugin complexity
- Lighthouse 80-90 vs 90+ 差距是 marginal 优化；可能 over-engineer
- CI runtime 增加（Lighthouse 跑一次几十秒）

**Risks**:
- 真实用户 device / 网络远比 CI 模拟差 → Lighthouse pass ≠ user experience pass；通过 Real User Monitoring (Phase 2+) 补
- 加 plugin 时不慎拖入大 dep → CI bundle size gate 防御

## Alternatives considered

- **No formal Lighthouse gate**: 行为不可预测；rejected per "性能不能有明显差距" hard requirement
- **Lighthouse 80 baseline**: 中等标准；user 直接说要"高分"；rejected per stricter
- **Web Vitals only (no Lighthouse overall score)**: 部分指标但失去 holistic check；rejected per Lighthouse 是 user-facing benchmark
- **Backend SLO only no frontend gate**: 失去 user-facing perceived perf control；rejected

## References

- Source DI doc: `engineering/design/_frozen/architecture-rebuild-2026-05-11.md` §11.10
- Related ADRs: ADR-0006 (backend stack incl. Bun perf baseline), ADR-0016 (CSS framework + bundle size)

## Changelog

- 2026-05-13 initial draft (decision LOCKED 2026-05-12 in source DI doc; backend SLO added 2026-05-13 per user "性能不能差" requirement)
