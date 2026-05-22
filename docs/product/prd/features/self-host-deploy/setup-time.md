# Feature PRD: Self-host deployment — setup-time

| Field | Value |
|---|---|
| Status | draft (pass 4 — second-pass sync cleanup) |
| Last updated | 2026-05-21 |
| Owner | W_YI |
| Parent PRD | [self-host-deploy.md] |

> **ADR reference status (2026-05-18 owner framing)**: 本 PRD 引用的**所有 ADR**（含 [ADR-0001] / [ADR-0002] / [ADR-0003]）均 **pending PRD-driven rework round 2**——遵循 owner framing "需求决定架构，架构决定代码与工期"：Phase E PRD 全完成后 ADR 统一 PRD-informed rework；之前标 REWORKED 的 ADR-0001/0002/0003 也需 PRD-informed 再 audit；ADR-0007/0014/0017/0018 的 partial rework 只是 cross-ADR alignment，**不算 final**。**同步规则**：ADR 改动时必须 grep 全 PRD ADR refs 同步修订，避免 PRD ↔ ADR drift。详 [AUDIT-2026-05.md](../../../../engineering/decisions/AUDIT-2026-05.md) 2026-05-18 entry。

---

## What this PRD covers

Self-host operator 在 **operator-active** 时刻对 SHCKB 做的所有改动——从 zero 到 first running，到日常配置调整、SHCKB 升版、替换底层组件的整套生命周期。

**核心边界**：本 PRD cover 的所有操作都要 **redeploy**（per [self-host-deploy.md] cross-cutting invariant "no runtime config hot reload"）。SHCKB 启动后自治期间的事（backup schedule / health check / monitoring / log / anomaly）归 [runtime.md]，不在本 PRD 范围。

---

## Why (motivation)

**为什么把 self-host-deploy 按时间维度拆 setup-time + runtime**：

Self-host operator 的实际心智本来就分两段——**主动改动**（要 redeploy，要 verify，要看 log，要担心 failure）跟 **运营自治**（SHCKB 跑着，operator 只关注异常）。把这两段混在一份 PRD 里 reader 抓不到 "什么时候我需要 active；什么时候 SHCKB 自己跑"。

**为什么 setup-time = redeploy**（不开 runtime config hot reload）：

简化 internal state management。SHCKB 不维护 "config changed mid-run" 状态；任何 config 改动 → restart → 干净起始状态。换来：

- **可预测性**：operator 不踩 "改了 config 但没 reload 的部分组件" 这种 race
- **failure-isolation**：每次 redeploy 都有明确停止边界；preflight / transactional failure 保留旧状态；已部分执行的 migration 失败则 reject startup，并交给 backup + runbook recovery
- **uniform model**：first install / 配置调整 / SHCKB upgrade / replace DB engine 都走 redeploy；operator 只学一种 mental model

**为什么本 PRD 跟 [self-host-deploy.md] top 独立**：

Top PRD 讲 framing + 3-tier profile + 5 deploy mode + cross-feature seams（跨 setup-time 跟 runtime 通用）；本 PRD 展开 setup-time 阶段的具体行为。Top 是 framing artifact 可复用到 ADR / release notes；本 PRD 是 setup phase 的 user-experience + acceptance roadmap。

---

## The whole picture

Operator 跟 SHCKB 的全生命周期可视化（**T0 / T2 / T3 / T5 都属 setup-time；T1 / T4 归 [runtime.md]**）：

```
 operator timeline
 ═════════════════

  T0 ──────►  [first install]                          setup-time
                  │  docker compose up + first admin
                  ▼  setup screen + sensible defaults
  T1 ────►   [running]                                 runtime  (→ runtime.md)
                  │  SHCKB autonomous; backup /
                  │  monitoring / health / log
                  ▲
  T2 ──────► [config change / add option]              setup-time
                  │  改 install profile + redeploy
                  │  可共存配置不迁移 user 数据
                  ▼
  T1' ───►   [running, with new config]                runtime
                  ▲
  T3 ──────► [SHCKB upgrade]                           setup-time
                  │  pull new image + redeploy
                  │  → auto schema migration
                  ▼
  T1'' ──►   [running, new version]                    runtime
                  ▲
  T5 ──────► [L3 replacement migration]                setup-time (rare)
                  │  export → redeploy + new L3 → import
                  ▼
  T1'''──►   [running on new L3 backing]               runtime

 ────────────────────────────────────────────────────────────────
 Setup-time 5 类操作：
   T0: first install                           (Day-1 critical / M2)
   T2: 改配置 (可叠加配置变更)                   (Day-1 critical / M2)
   T3: SHCKB 升版                              (Day-1 critical / M2)
   T5: 底层组件替换 (L3 replacement)            (M2 仅 future contract;
                                                CLI M3 / verified M4)
   + ongoing minor secrets / domain changes
```

**关键 invariant**（所有 setup-time 操作共享）：

- Redeploy required（不存在 runtime config hot reload）
- Failure-isolated（失败 reject startup + 清晰错误；旧 state 保证只限 preflight / transactional cases）
- Operator-observable（log + setup screen + CLI output 都明示 progress / failure）
- Idempotent re-run（同 config 跑两次结果一致；不重复 init）
- No silent fallback（缺 admin credential / 缺必填 config → reject startup，不静默 fallback default）

---

## User-facing experience

**Operator 视角**——每个 setup-time 事件应该是什么体验：

### T0 First install (新 operator 第一次部署)

```
1. operator 拉取 OCI image / single-binary
2. operator 填写 install profile（部署配置文件）:
   - profile 选择 (Solo NAS / Team VPS / Public Cloud)
   - admin 账号 (用户名 + 初始密码)
   - 数据库 / 存储 / 搜索 / 备份 各选一个 adapter（默认值可零配置）
   - (可选) email SMTP；OAuth/OIDC 等登录方式只在对应 auth milestone 支持后出现
3. operator 运行: `docker compose up -d`
4. SHCKB:
   - 校验 install profile
   - 自动生成签名密钥 (写入 secrets 文件)
   - 跑首次数据库 schema 初始化
   - 启动
5. operator 打开浏览器 → 用 admin 账号登录 → 立即可用
6. operator 创建第一个 author 用户 + 第一篇 notepage
```

**承诺**: step 1 到 step 6 < 10 min（per [self-host-deploy.md] M2 invariant）。

**First-admin 路径按 bootstrap mode 区分**：

Bootstrap mode 是 install-bootstrap 的安全模式，和 Solo NAS / Team VPS / Public Cloud 这类 operator profile 正交；install profile 可以显式选择，也可以根据是否公网暴露推导。

| Bootstrap mode | 缺 admin 账号时的行为 | 理由 |
|---|---|---|
| **Internet-exposed bootstrap mode** | **Reject startup**（要求 install profile 必须 seed admin 账号；启动后直接 login）| 防公网部署首访问者成 admin 的安全事故（per [identity.md] invariant） |
| **Dev-local bootstrap mode** | **允许 force first-admin setup screen** + **one-time setup token**（防局域网他人抢注）| 本地开发便利；setup token 限制只有持 token 的人能创建 first admin |

也就是：M2 canonical 是 "**install profile seed admin → 直接 login**"（internet-exposed bootstrap mode）；setup screen 是 dev-local 的便利路径，不是公网部署默认。

### T2 Config change (改一个配置选项 + redeploy)

"配置选项变更" 指 operator 改一个**附加的、与既有共存**的配置——加一个选项 / 调一个参数，不动现有 user 数据。术语上对应 authentication 4-layer 的 **L4 option add**（详 [authentication.md]；这里指"可叠加、可共存的配置层"，跟下面 T5 的"整层替换"区别）。

M2 verified 的典型场景（**不含 OAuth**——OAuth provider option 在 [identity.md] 是 M3+，M2 不承诺）：

```
1. operator 改 install profile / env，例如:
   - cookie domain (改域名)
   - session TTL (会话有效期)
   - signup policy (是否开放注册)
   - backup retention (备份保留份数)
2. operator 运行: `docker compose restart` (或 redeploy)
3. SHCKB:
   - 检测新配置
   - 现有 user 数据不变
4. 结果:
   - 新配置生效
   - 既有 login / session 继续 work（除非该配置本身改了 session 语义）
```

**承诺**: 配置选项变更 = 改配置 + redeploy + 与既有共存；**不**触发 user 数据迁移；不破现有 session（per [authentication.md] 4-layer + [plugin-system.md] L4 option add 语义）。

> **注**: 加 OAuth/OIDC/passkey 这类登录方式 **不在 M2**——它们是 [identity.md] 的 M3+ provider options。届时 auth PRD 把 OAuth promote 到某 M-stage 后，本 PRD 同步（per ADR-PRD 同步规则）。本 T2 scenario 的 M2 范围只验证"可共存配置变更"的通用语义，用 cookie domain / session TTL 等已 M2-ready 的配置作例子。

### T3 SHCKB upgrade (v1.0 → v1.1)

```
1. operator pulls new OCI image / new binary
2. operator runs: `docker compose down && docker compose up -d`
3. SHCKB:
   - detect schema version (v1.0 → v1.1)
   - run forward migration (auto)
   - emit migration log
4. operator verifies success via /health endpoint + admin login
```

**失败 case**：migration 失败 → **reject startup + 明确错误 + 不静默继续**。**"旧 schema 未改变" 的保证只限于 transactional migration 或 preflight 阶段失败的 case**（DDL 是否事务化跨 DB engine 不一；MySQL DDL 通常非事务）。一旦 migration 已部分执行才失败 → 完整 recovery **依赖 backup + runbook**，PRD 不承诺自动 rollback 到旧 schema。

**承诺**: upgrade 是 low-risk 常规操作；version skip (n-2) 支持；n-3+ 提示 step-by-step。强保证只有一条：**失败绝不静默继续运行在不一致 schema 上**。

**M2 backup 提示**：upgrade 开始前必须给 operator 一个明确的 **manual backup warning + runbook pointer**。M2 不承诺自动 backup；auto-backup / backup-now shortcut 可以后移到 M3+。

### T5 底层组件替换 (替换整层 implementation，rare event)

"底层组件替换" 指 operator 把某个底层 implementation **整层换掉**——如把认证库 Better Auth 换成 Auth.js，或把数据库引擎 SQLite 换成 Postgres。术语上对应 authentication 4-layer 的 **L3 replacement**（跟 T2 的"可叠加配置"区别：T5 是"换底座"，要迁数据）。

```
未来形态 (M2 不 ship；详下方 scope 说明):
1. operator 导出现有数据:
   `skb export --include=users,auth,notepages,blocks,...`
   → 生成标准化 archive
2. operator 改 install profile（如 DB_TYPE = "postgres" + DATABASE_URL）
3. operator 用新 image / 新配置 redeploy
4. operator 导入数据: `skb import <archive>`
   → SHCKB 校验 schema 兼容性 + 写入新 instance
5. operator 验证: admin 登录 + 抽查 notepage
```

**承诺 + M2 scope**：底层组件替换是 **导出 → redeploy → 导入** 三步 workflow（per [authentication.md] L3 replacement + [plugin-system.md] adapter variant change ladder）。**Rare** event。

- **M2**: 仅把此 workflow **文档化为 future contract**；**不 ship CLI skeleton；无 user-facing migration guarantee**（与 [identity.md] "L3 replacement migration M2 不 ship" 对齐）
- **M3**: `skb export` / `skb import` CLI skeleton ship
- **M4**: verified import (schema 兼容性校验完整) + full migration runbook

### 跨场景共通体验

- **Setup screen + CLI feedback**: 任何 setup-time 操作的 progress / failure / next-step operator 立即可见，不需 grep deep logs
- **Failure recovery**: 失败 → reject startup + 清晰 error message + 修复指引；preflight / transactional failure 保留旧 state；已部分执行的 migration 失败则按 backup + runbook recovery
- **Documentation pointer**: setup screen / CLI output 含 link to relevant runbook section（future engineering/runbooks/）

---

## MVP — minimum shippable (M2)

**操作能力** (operator 在 M2 可以做的):

- ✅ **First install via Docker compose**（Canonical OCI image；per [ADR-0001] tier 1）
- ✅ **First install via single-binary**（Bun；per [ADR-0001] tier 2）
- ✅ **First admin via install bootstrap**（per [identity.md] invariant）：internet-exposed bootstrap mode 缺 admin → reject startup；dev-local bootstrap mode → force first-admin setup screen + one-time setup token
- ✅ **Initial adapter config**（首次选底层组件）：M2 使用下方 adapter support matrix 区分 roadmap vocabulary / M2 selectable behavior / M2 verified gate；Solo NAS profile 有 sensible defaults（零配置 work）
- ✅ **Config change baseline**（可叠加配置变更 = L4 option add）：改 config + redeploy + 与既有共存；**M2 verified 例子**：cookie domain / session TTL / signup policy / backup retention。**OAuth 不在 M2**（待 [identity.md] promote；当前 M3+）
- ✅ **SHCKB version upgrade**：startup 时 forward schema migration；upgrade 前展示 manual backup warning + runbook pointer；migration 失败 → reject startup + 不静默继续（"旧 schema 未变" 保证只限 transactional/preflight-safe；完整 recovery 靠 backup/runbook）
- ✅ **底层组件替换 (L3 replacement)**：M2 仅 **文档化为 future contract**；不 ship CLI；无 user-facing migration guarantee（CLI skeleton M3 / verified import M4）

**M2 adapter support matrix**（避免把 roadmap vocabulary 误读成全组合验收）：

| Category | Roadmap option vocabulary | M2 selectable behavior | M2 verified gate |
|---|---|---|---|
| DB | SQLite / Postgres / MySQL via Drizzle | SQLite = supported；Postgres = supported；MySQL = unsupported with clear error in M2 | Solo NAS SQLite path + one Team VPS Postgres path |
| Storage | local-fs / S3-compatible | local-fs = supported；S3-compatible = optional smoke, not release gate；missing / invalid S3 config = unsupported with clear error | local-fs full path；S3-compatible smoke only if explicitly included, not release gate |
| Search | SQLite FTS5 / Postgres tsvector / external search (e.g. Meilisearch) | profile-matched default = supported；external search = unsupported with clear error in M2 | SQLite FTS5 for Solo + Postgres tsvector for Team if Postgres path verified |
| Backup | local / S3-compatible | local = supported；S3-compatible = optional smoke, not release gate | manual backup warning + pointer to runtime manual backup path；stronger S3 verification later |

**M2 demo flow** (operator zero → running notepage)：

```
# internet-exposed bootstrap mode canonical path (profile seed admin):
install profile 含 admin 账号
  → docker compose up -d
  → 浏览器访问
  → 用 admin 账号登录 (无需 setup screen)
  → 创建 author 用户
  → author 登录
  → 创建 markdown notepage
  → 全流程 < 10 min ✓

# dev-local bootstrap mode 便利 path:
docker compose up -d (install profile 未 seed admin)
  → 浏览器访问 → first-admin setup screen (带 one-time setup token)
  → 创建 admin → 后续同上
```

**M2 acceptance gates**（M-stage scope 必须 explicit + mechanically reviewable）：

- Internet-exposed canonical E2E（profile seed admin → login → author → notepage）passes < 10 min
- **First-admin by bootstrap mode**：internet-exposed bootstrap mode 缺 admin → startup reject + 清晰提示；dev-local bootstrap mode → setup screen + one-time token work
- Single-binary 跟 Docker compose 行为对齐（同 source；同 user experience）
- Adapter config validation at startup（缺必填项 reject；unsupported M2 option 给 clear unsupported error，不静默 fallback）
- **Config change (L4) coexist**：改 cookie domain / session TTL / signup policy / backup retention 之一 + redeploy → 生效 + 现有 user 不变（**OAuth 不作 M2 gate**）
- **Upgrade preflight warning**：upgrade 前 operator 看得到 manual backup warning + runbook pointer；M2 不要求 auto-backup
- **Upgrade migration**：forward-only；失败 → reject startup + 不静默继续（"旧 schema 未变" 只 assert transactional/preflight cases）
- **底层组件替换 (L3)**：M2 仅 verify "workflow documented as future contract"；**无 CLI skeleton gate，无 user-facing migration guarantee**

---

## Progressive completeness (M3 → M4)

### M3 — deploy breadth + tooling

operator 体验提升点：

- **NAS-specific templates**（Synology DSM Docker / TrueNAS apps / Unraid Community Apps；至少一个 verify）→ NAS operator 不需手写 Docker compose
- **VPS templates**（含 systemd unit + Caddy reverse proxy）→ VPS operator 不需手写 reverse proxy + TLS
- **Pre-deploy validation CLI**（`skb config validate`）→ operator redeploy 前 detect config 冲突，不会 redeploy 后才 startup 失败
- **Pre-upgrade backup integration** → 从 M2 manual warning 升级为 backup-now shortcut / archive validation / dry-run；canonical restore smoke follows [runtime.md] M4
- **底层组件替换 CLI skeleton**（`skb export` / `skb import`）→ 从 M2 的 "future contract marker" 升级为可跑的 CLI（但 verified import 校验在 M4）
- **Audit trail webapp view**（per [identity.md] M3）→ admin 看 setup-time 历史 (install / upgrade / migration / config change) 不需 grep log

### M4 — production polish + 5-mode verify

- **Cloudflare Workers tier 3** verify（per [ADR-0001] tier 3）→ Workers operator 知道哪些 feature 在 Workers runtime 不可用（如 long-running migration timeout）；known constraint 文档化不静默失败
- **5 deploy mode 全 verify**：Docker compose / single-binary / NAS / VPS / Workers 各跑 M2 acceptance E2E
- **底层组件替换 complete workflow**：M3 CLI skeleton 升级为 **verified import**（schema 兼容性校验完整）+ migration runbook (归 future engineering/runbooks/；PRD mandate 存在) → operator 能完整执行 L3 replacement
- **Operator runbook baseline**：key rotation / DR / scaling baseline 文档化（per [self-host-deploy.md] M4）

---

## Done — final horizon (Phase 2+)

"什么情况算 setup-time 这块完成了"：

- **Pre-upgrade auto-backup**：upgrade 前 SHCKB 自动跑 backup（依赖 [runtime.md] backup integration M3+）
- **Cross-instance migration**：从另一 SHCKB instance import（不是 federated identity；是 explicit operator-initiated copy；per [project.md] non-goal 限制）
- **Bi-directional rollback**：rollback to old L3 implementation（需 dual-import + 数据兼容窗口；rare event）
- **Partial migration**：只 migrate 部分 user / 部分 notepage（rare；归 future）
- **Auto rollback on migration failure**：当前 M2 mandate 只到 "reject startup + 不静默继续"（旧 schema 保证限 transactional/preflight）；未来可加完整 auto-rollback（含已部分执行的 migration 回滚 + OCI image 回退）；rare value vs cross-DB-engine complexity
- **K8s / enterprise orchestration**：per [project.md] non-goal until owner override；Phase 2+ 才考虑

---

## Reference

> 以下 section 是 lookup 用；不是 narrative arc 一部分。Implementation team / reviewer 需要 specific 信息时来这里查。

### Cross-cutting setup-time invariants

| Invariant | 含义 |
|---|---|
| **All setup-time = redeploy** | 没有 runtime config hot reload；改 config = redeploy；统一 mental model |
| **Failure-isolated** | Redeploy / migration 失败 → reject startup + 清晰错误 + 不静默继续；**"保留旧 state" 只在 transactional / preflight-failed cases 保证**；migration 已部分执行才失败 → 完整 recovery 靠 backup + runbook |
| **Operator-observable** | Setup-time 操作的 success / failure / progress operator-visible（log / CLI output / setup screen）|
| **Idempotent re-run** | 同 install profile + 同 env 多次 redeploy → 结果一致；不重复 init / 不破现有 state |
| **No silent fallback** | 缺 admin credential / 缺必填 config / unknown profile → reject startup；不静默 fallback default |
| **Adapter change ladder** | L4 option add = config + redeploy + coexist；L3 replacement = export → redeploy → import；L1/L2 = NEVER（per [authentication.md] 4-layer + [plugin-system.md] round 5 sync）|

### Non-goals

- ❌ **Runtime config hot reload** —— 想改 config = redeploy；简化 internal state mgmt
- ❌ **K8s / enterprise orchestration** —— per [project.md] non-goal
- ❌ **Multi-region active-active migration** —— Phase 2+
- ❌ **Library 内部 token / schema / migration tooling 决策** —— 归 library + future ADRs
- ❌ **Specific runbook step-by-step** —— 归 future `engineering/runbooks/`
- ❌ **Plugin marketplace deploy** —— Phase 2+

### Edge cases

| 场景 | 期望行为 |
|---|---|
| Docker compose up 后 DB connection 失败 | Startup reject + 清晰 error + 修复提示（"check DATABASE_URL env"）|
| Install profile 漏配 admin credential（internet-exposed bootstrap mode）| Reject startup + 清晰提示（per [identity.md]）；不静默 fallback "首访问者成 admin" |
| Install profile 漏配 admin credential（dev-local bootstrap mode）| Force first-admin setup screen + one-time setup token（防局域网他人抢注）|
| Operator 改 env DOMAIN + redeploy | Cookie domain / OAuth callback / SEO meta 全 sync；现有 session 视 library policy invalidate / 保留 |
| Upgrade migration 中途失败 (transactional / preflight) | Reject startup + 旧 schema 未变 + 清晰错误 |
| Upgrade migration 已部分执行才失败 (e.g. 非事务 DDL) | Reject startup + 不静默继续；旧 schema 可能已部分改；完整 recovery 靠 backup + runbook |
| Operator export archive 后改 schema 又 import | Import 校验 schema 兼容；不兼容 → reject import + 提示版本 mismatch |
| 漏配 storage S3 但选 S3 provider | Startup reject + 提示 "S3_BUCKET / S3_ACCESS_KEY 缺失" |
| Concurrent redeploy (rare race) | 第二个 redeploy 等第一个完成 OR reject；具体归 implementation |
| 底层组件替换 (L3) 中 import 失败 | Operator 持有 export archive（migration 前导出）；可 rollback OCI image + 重新 import 旧 archive；具体 recovery 步骤归 future migration runbook（M4）|
| Plugin 内 schema 跟 SHCKB version 不兼容 | Upgrade migration reject + 提示 plugin version requirement；不静默丢 plugin data |

### Dependencies

- **Parent PRD**: [self-host-deploy.md](./self-host-deploy.md)
- **Sibling PRDs**: [runtime.md](./runtime.md)
- **Cross-folder PRDs**:
  - [authentication.md](../authentication/authentication.md) — 4-layer abstraction + AuthAdapter (top)
  - [authentication/identity.md](../authentication/identity.md) — first admin + L4 provider config + signup policy
  - [authentication/pep.md](../authentication/pep.md) — PEP middleware behavior cross-deploy-mode 一致
  - [notepage.md](../notepage/notepage.md) — URL / SSR / SEO 跨 mode 一致（cross-feature seam）
  - [theme-system.md](../theme-system/theme-system.md) — SSR theme bundling 一致
  - [plugin-system.md](../plugin-system/plugin-system.md) — plugin closed registry deploy
- **External services**: Container runtime / Optional reverse proxy / Optional SMTP / Optional S3-compat

### Open questions

1. **Migration archive format**：JSON / SQLite dump / 自定 binary？归 future migration workflow ADR
2. **Plugin migration data ownership during L3 DB engine replacement**：plugin sidecar tables export-import semantics；归 future ADR
3. **Workers tier 3 setup-time gap**：Workers 不支持 long-running process（migration 可能 timeout）；setup-time 在 Workers 走什么 path；归 M4 verify
4. **Auto rollback on migration failure**：当前 M2 mandate 只到 "reject startup + 不静默继续"；是否要 auto rollback OCI image 到旧 version（含已部分执行 migration 的回滚）？倾向 not auto（operator-active 决策；跨 DB engine 复杂）；归 future runbook
5. **Pre-deploy validation tool 范围**：纯 config schema validate / 还是含 DB connection probe / S3 reachability check？trade-off 复杂度 vs setup confidence

### Surfaced ADR debts

- **Migration archive format (new)**：归 future migration workflow ADR；含 schema version metadata / partial migration support / 跨 deploy mode 兼容
- **Install profile schema validation timing**：startup pre-check vs lazy check；归 [ADR-0018] follow-up
- **Plugin migration 跟 L3 DB replacement 协同**：plugin sidecar tables export-import semantics；归 future ADR + [ADR-0014] cross-ref
- **Versioning compatibility window**：n-2 跳级 support；具体 window definition 归 future versioning ADR
- **Workers setup-time path**：long-running migration 在 Workers runtime constraint；归 [ADR-0001] Workers tier 3 follow-up

详 [AUDIT-2026-05.md](../../../../engineering/decisions/AUDIT-2026-05.md) PRD-surfaced debts log。

### References

- **Aligning ADRs**（pending PRD-driven rework；详顶部 disclaimer）:
  - [ADR-0001](../../../../engineering/decisions/ADR-0001-deployment-canonical-artifact.md) — Canonical OCI + 3-tier support
  - [ADR-0018](../../../../engineering/decisions/ADR-0018-install-bootstrap.md) — install profile + first admin
  - [ADR-0002](../../../../engineering/decisions/ADR-0002-substrate-db-backed.md) — schema migration baseline
  - [ADR-0006](../../../../engineering/decisions/ADR-0006-backend-stack.md) — Drizzle multi-dialect
  - [ADR-0007](../../../../engineering/decisions/ADR-0007-storage-provider.md) / [ADR-0008](../../../../engineering/decisions/ADR-0008-search-provider.md) / [ADR-0017](../../../../engineering/decisions/ADR-0017-backup-strategy.md) — adapter abstractions
  - [ADR-0014](../../../../engineering/decisions/ADR-0014-plugin-contract.md) — plugin migration
- **Parent**: [self-host-deploy.md](./self-host-deploy.md)
- **Sibling**: [runtime.md](./runtime.md)
- **Discussion record**: [auth-setup-2026-05-17.md](../../../../engineering/design/discussions/auth-setup-2026-05-17.md) Section G follow-up — adapter change ladder cross-cutting；[self-host-setup-time-2026-05-21.md](../../../../engineering/design/discussions/self-host-setup-time-2026-05-21.md) — narrative form review + Codex 4 findings
- **Audit register**: [AUDIT-2026-05.md](../../../../engineering/decisions/AUDIT-2026-05.md)

### Changelog

- 2026-05-17 initial draft (Phase E Day-1 PRD #4 sub-PRD)；setup-time = operator-active redeploy 期间；5 H2 sections (first install / initial adapter config / L4 option add / upgrade / L3 replacement migration)；6 cross-cutting setup-time invariants；M2 / M3 / M4 acceptance；surface 4 ADR debts
- 2026-05-18 **pass 2 — 总分总 narrative 重写**（per owner 2026-05-18 framing "PRD 应该总分总；whole picture + UX 是关键部分能复用到 ADR / release / PR"）：结构重组为 What / Why / Whole picture (timeline diagram) / User-facing experience (4 typical operator events 详细 walk-through) + MVP / Progressive / Done milestone narrative + Reference sections 尾部。删除原来 5 H2 sections 平铺 + 各段 Must/Should/Nice-to-have 列表方式；改为 narrative arc。Whole picture + UX section 写为 self-contained reusable artifact（可复用到 ADR / release notes / PR description）
- 2026-05-21 **pass 3 — Codex 4 findings scope cleanup + 易读性**（per [self-host-setup-time-2026-05-21.md] discussion record + owner 易读性指令）：
  - **Finding 1**: M2 不再承诺 OAuth provider add（identity.md OAuth 是 M3+）；T2 scenario reframe 为通用"配置选项变更"，M2 example 用 cookie domain / session TTL / signup policy / backup retention；OAuth 标待 auth PRD promote
  - **Finding 2**: First-admin 路径按 profile 区分（production/public 缺 admin → reject startup；localhost/dev → setup screen + one-time setup token）；M2 canonical = profile seed admin 直接 login；demo flow / acceptance / edge case 全 sync
  - **Finding 3**: Migration failure 承诺收紧——"保留旧 schema" → "reject startup + 不静默继续；旧 schema 保证只限 transactional/preflight-safe；完整 recovery 靠 backup/runbook"（跨 SQLite/Postgres/MySQL DDL 事务化不一）
  - **Finding 4**: M2 L3 replacement skeleton → future contract marker（M2 无 user-facing migration guarantee + 无 CLI gate）；CLI skeleton 移 M3；verified import + runbook 移 M4
  - **易读性 (owner 指令)**: L4/L3 术语第一次出现给平实解释（"可叠加配置变更" / "底层组件替换"）；UX scenario step 中文平实化；术语作辅助不作主语
  - **Form note (per Codex Section C)**: narrative-first form 适用 lifecycle/operator/system-facing PRD；narrow feature PRD 仍需 explicit user stories + acceptance gates visible for grep；M-stage scope 不能被 narrative 藏（M2/M3/M4 acceptance 保持 explicit + mechanically reviewable）
- 2026-05-21 **pass 4 — second-pass sync cleanup**：按 [self-host-setup-time-2026-05-21.md] Section F 落地：first-admin 术语改为 internet-exposed / dev-local bootstrap mode；M2 增加 manual backup warning + runbook pointer；adapter config 拆成 roadmap vocabulary / M2 selectable / M2 verified gate；PRD body 移除内部 review provenance，保留在 discussion / changelog。
- 2026-05-21 **pass 4 follow-up**：定义 bootstrap mode 为 install-bootstrap security mode，和 operator profile 正交；adapter matrix 列名改为 M2 selectable behavior，并用 supported / unsupported with clear error / optional smoke, not release gate 三类状态收紧执行范围。
