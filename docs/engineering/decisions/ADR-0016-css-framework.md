# ADR-0016: CSS framework — Tailwind 4 + cva + shadcn ui + grid-themes

| Field | Value |
|---|---|
| Status | accepted |
| Date | 2026-05-13 |
| Authors | W_YI + gatekeeper Claude Opus 4.7 |
| Supersedes | — |
| Superseded by | — |
| Source DI doc | `engineering/design/_frozen/architecture-rebuild-2026-05-11.md` §11.16 |

## Context

App shell + plugin chrome + UI primitives 需要 CSS framework；约束：
- 多 theme via CSS vars（grid-themes carryover 已建）
- Plugin extension 模型对 plugin author 友好（不强加陡峭学习曲线）
- SSR compatible（Hono + Bun runtime）
- Lighthouse 90+（详 ADR-0010）；bundle 小
- Type-safety 越好越好（AI 助手 hallucinate 防御）
- Multi-deploy（no vendor-specific CSS tooling）

User push back gatekeeper 初次 Panda CSS 推荐："Panda CSS 太新了吧，开发者可能不是很多... Tailwind 没有专门的测试包吗？lint 校验？比如说 React + TypeScript + Tailwind + cva / tailwind-variants"。

Tailwind 生态自身的 type-safety 工具：
- Tailwind CSS IntelliSense (VS Code) 自动补全 + hover docs + 拼错 squiggle
- eslint-plugin-tailwindcss lint 规则
- cva (class-variance-authority) variant TS-typed
- tailwind-variants 升级 (slots + compound variants)
- shadcn ui (Tailwind + Radix + cva 组合) defacto 2026 React primitives

## Decision

### 4 层 stack

```
Layer 3: shadcn ui primitives (CLI-vendored copy-paste)
         apps/web/src/ui/{shadcn/, custom/}
         Button / Dropdown / Dialog / Toast / Form / etc.

Layer 2: cva / tailwind-variants for component variants
         每 plugin + 每 shell component 的 variant API 用 cva
         variant TS-union；compile-time 校验

Layer 1: Tailwind CSS 4 (utility-first)
         apps/web/ 的全局 utility classes
         tailwind.config.js theme.extend 引用 grid-themes CSS vars

Layer 0: grid-themes CSS variables (carryover)
         OKLCH 颜色 + 字体 + 间距 + 圆角 + shadow
         3 theme 切换 = CSS var 替换
```

### Type-safety 工具链

- Tailwind CSS IntelliSense (VS Code 官扩) —— 自动补全 + hover docs + 拼错 squiggle
- eslint-plugin-tailwindcss —— CI 强制 lint：禁未注册 class / 强 sort / shorthand 优先 / no contradictory
- prettier-plugin-tailwindcss —— 自动 sort
- class-variance-authority (cva) —— component variant API TS-typed
- tailwind-variants (tv) —— cva 升级；按需引入
- clsx —— class string 拼接 helper
- @tailwindcss/typography —— `.prose` for rendered markdown (markdown plugin RenderView)

### shadcn ui CLI governance

User proposed + gatekeeper 补充实操：

| 治理点 | 实施 |
|---|---|
| CLI vendored 进 repo (不用 npm 引用) | `npx shadcn add <component>` 生成 file 进 repo；这些 file 是 own code |
| 固定 CLI 版本 | `devDependencies` pin `shadcn@x.y.z` + 根目录 `.shadcn-version` + CI check |
| add 走 PR | 不允许 feature PR 内夹带；`npx shadcn add button` 单独 PR；title `chore(ui): add shadcn <name>` |
| PR review | reviewer 验：(a) 无 duplicate (b) 真用得到 (c) CLI 版本一致 |
| 禁 duplicate | PR template checkbox + CI lint scan `apps/web/src/ui/` name 唯一性 |
| 重度改造规则 | 改 >30 lines 或改 component API surface → rename `Skb-` 前缀 + 移到 `apps/web/src/ui/custom/` |
| 升级 diff 逐个 | `shadcn diff <component>` 列 upstream 改；review → cherry-pick / reject |

### 目录形态

```
apps/web/src/ui/
├── shadcn/                 # CLI add 的，min 修改
│   ├── button.tsx
│   ├── dropdown-menu.tsx
│   ├── dialog.tsx
│   ├── toast.tsx
│   └── form.tsx
├── custom/                 # 重度改造 fork 的，Skb- 前缀
│   ├── SkbButton.tsx
│   └── ...
└── index.ts                # barrel export → `@/ui` import

.shadcn-version             # CLI 版本锁
components.json             # shadcn 配置 file
```

未来出现第 2 个 app（desktop / mobile）→ promote 到 `packages/ui/`；Day-1 不阻塞。

### Plugin 内部 CSS 不限制

User explicit (2026-05-13)："plugin 内部的不管吧，我们只负责整体应用的层面，不要限制开发者的方法"。

Platform 只锁 Layer 0-3。**Plugin 内部 styling 完全 plugin author 自选**：
- 想全 Tailwind utility → OK
- 想 CSS Modules → OK
- 想 vanilla-extract / Linaria / styled-components → OK
- 想纯 vanilla CSS file → OK

BlockPlugin contract（ADR-0004 / ADR-0014）不规定 styling 实现方式，只规定 `EditView` / `RenderView` 是 React component。Plugin 自带 CSS 的 bundling 由 plugin package 自己负责（Bun build / vite resolver / etc.）。

## Consequences

**Positive**:
- Tailwind 4 + shadcn ui = 2026 React 主流；plugin author 学习成本最低
- cva + IntelliSense + ESLint + clsx 在实践中达到接近 type-safe CSS-in-JS 的安全度
- grid-themes CSS vars 已 carryover；theme 切换 free
- shadcn CLI vendored governance 兼具 own + 跟 upstream
- Plugin 内 CSS 不约束 → plugin 作者自由

**Negative / Trade-offs**:
- Refactor token name 比 vanilla-extract / Panda 略繁（grep + IDE）
- utility class string 不是 TS-typed（cva 在 component 层补救）
- shadcn ui 治理流程（add 走 PR / 禁 duplicate / 升级 diff）是新 contributor 上手成本
- 多个 IDE plugin / ESLint plugin 配置 prerequisite；onboarding step 要文档化

**Risks**:
- Tailwind config / grid-themes CSS vars drift；通过 CI lint + tests catch
- shadcn upstream 演化与 fork-after-modify 同步；通过 `shadcn diff` workflow 控制

## Alternatives considered

- **Panda CSS / vanilla-extract**: ecosystem 太小 + AI training data 弱；rejected per user push back
- **Emotion / styled-components**: runtime cost + SSR mismatch + 2026 dying；rejected
- **shadcn npm package (not vendored)**: 失去 own + fork-after-copy 灵活性；rejected
- **CSS Modules everywhere**: 失去 Tailwind utility 速度；rejected
- **No utility framework (pure CSS)**: solo dev + AI 节奏下生产力损失；rejected
- **Pure component library (Mantine / Chakra / 等)**: 失去 design 自由度 + shadcn fork-friendly；rejected

## References

- Source DI doc: `engineering/design/_frozen/architecture-rebuild-2026-05-11.md` §11.16
- Related ADRs: ADR-0010 (Lighthouse + bundle size), ADR-0013 (Lexical markdown editor uses `@tailwindcss/typography`)
- External:
  - Tailwind CSS 4 docs
  - shadcn ui CLI
  - cva docs
  - tailwind-variants
  - eslint-plugin-tailwindcss
  - Radix UI (shadcn primitive base)

## Changelog

- 2026-05-13 initial draft + accepted (LOCKED 2026-05-13 in source DI doc post user Tailwind push back + cva surface)
