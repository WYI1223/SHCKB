# Feature PRDs

每个核心 feature 一个 folder；按 product concept 命名（**不**按技术内部 mental model；不按 plugin 拆 —— plugin 是实现层，feature 是产品概念层）。

## 结构约定

```
features/
├── README.md                    ← 本文件，feature 索引
├── <feature-name>/              ← 大方向一 folder
│   ├── <feature-name>.md        ← top-level PRD（framing + cross-cutting + sub-PRD 索引）
│   ├── <feature-name>-<sub>.md  ← sub-PRD（如有）
│   └── <feature-name>-<sub>-<deeper>.md  ← 3rd level（仅在 sub-PRD 过大 / sub-feature 独立时启用）
```

- 单 sub-PRD 起步可 flat（folder 内只一个 `<feature-name>.md`）
- 多 sub-feature → folder 内 top-level + siblings 分层
- 3rd level **不预写**；触发条件：sub-PRD > 200 line OR sub-feature 独立 user journey / milestone
- folder 内**不**用单独 `README.md`，top-level PRD 兼任 framing + 索引职责

详 [prd-discipline.md] 写作 method + [doc-conventions.md] cross-reference 风格。

## 当前 feature PRD 索引

### Day-1 critical

| Feature | Folder | Status |
|---|---|---|
| Notepage（user-facing notepage 整体） | [notepage/](./notepage/) | draft（top + 3 sub-PRDs） |
| Theme system（presentation layer + 4-layer cascade） | [theme-system/](./theme-system/) | draft（top + user-view + author-view） |
| Plugin system（generic extension framework） | [plugin-system/](./plugin-system/) | draft（top + new-block sub-PRD） |
| Authentication（system-level PEP + 4-layer abstraction）| [authentication/](./authentication/) | draft（top + pep + identity；pass 5 split）|
| Self-host deployment（operator lifecycle；3 profiles + 5 modes） | [self-host-deploy/](./self-host-deploy/) | draft（top pass 2 + setup-time/runtime narrative）|

### Phase 2+ (owner-driven)

| Feature | Folder | Status |
|---|---|---|
| AI integration（in-app + external client） | [ai-integration/](./ai-integration/) | TODO |
| Discussion（per-block opt-in） | [discussion/](./discussion/) | TODO |
| Search + cross-note discovery | [search-discovery/](./search-discovery/) | TODO |

## Hierarchical sub-PRDs

### Notepage（note author / reader 视角）

| Sub-PRD | Scope |
|---|---|
| [notepage/notepage.md](./notepage/notepage.md) | top-level framing + cross-cutting invariants + cross-feature seams |
| [notepage/notepage-view.md](./notepage/notepage-view.md) | Reader 阅读流（view mode + SSR + private auth） |
| [notepage/notepage-editing.md](./notepage/notepage-editing.md) | Author 编辑流（insert/move/resize/delete + affordance + keyboard） |
| [notepage/notepage-responsive.md](./notepage/notepage-responsive.md) | Viewport projection（mobile 1-col / tablet 6-col / desktop 12-col） |

### Theme system（presentation layer 子系统；horizontal subsystem）

| Sub-PRD | Scope |
|---|---|
| [theme-system/theme-system.md](./theme-system/theme-system.md) | top-level framing：4-layer cascade（L0/L1/L2/L3）+ L0 hard invariants + cross-cutting invariants + per-attribute override |
| [theme-system/theme-system-user-view.md](./theme-system/theme-system-user-view.md) | Note author / reader 视角（3 built-in theme + switching + persistence + notepage metadata override） |
| [theme-system/theme-system-author-view.md](./theme-system/theme-system-author-view.md) | Theme 开发者视角（fork / compose / from-scratch path + cascade override + L0 enforcement） |

### Plugin-system（extension author 视角；generic extension framework）

| Sub-PRD | Scope |
|---|---|
| [plugin-system/plugin-system.md](./plugin-system/plugin-system.md) | top-level framing：generic extension framework + cross-cutting invariants + plugin vs operator-pluggable 区分 |
| [plugin-system/new-block.md](./plugin-system/new-block.md) | Block kind extension（author 怎么写 new block plugin） |

### Authentication（system-level PEP + 4-layer abstraction；按 domain split）

| Sub-PRD | Scope |
|---|---|
| [authentication/authentication.md](./authentication/authentication.md) | top（pass 5）：system-level PEP framing + **4-layer abstraction** diagram + 13 cross-cutting invariants + Build/Buy=Buy（Better-Auth preferred baseline）+ cross-feature seams + sub-PRD 索引 |
| [authentication/pep.md](./authentication/pep.md) | **PEP enforcement domain**：PEP middleware contract + ctx.user immutable Value Object + declarative authz（含 resource ownership）+ anonymous principal state + browser vs agent/API wire path 分离 |
| [authentication/identity.md](./authentication/identity.md) | **Identity management domain**：AuthAdapter L3 implementation + L4 provider options + signup policy operator-only + first admin via install bootstrap + role model + admin user mgmt + audit baseline + cookie/CSRF mandate |

### Self-host deployment（operator lifecycle；setup-time vs runtime 二分）

| Sub-PRD | Scope |
|---|---|
| [self-host-deploy/self-host-deploy.md](./self-host-deploy/self-host-deploy.md) | top：operator-lifecycle shared model；3-tier operator profile + 5 deploy mode + bootstrap mode + setup-time/runtime split + cross-feature seams；M2 OCI/single-binary，M3 NAS/VPS templates，M4 Workers constraints |
| [self-host-deploy/setup-time.md](./self-host-deploy/setup-time.md) | Operator-active changes：first install / config change / SHCKB upgrade / L3 replacement marker；internet-exposed vs dev-local bootstrap；M2 setup gates + M3/M4 deploy breadth |
| [self-host-deploy/runtime.md](./self-host-deploy/runtime.md) | SHCKB-autonomous running instance：backup artifact / manual backup / health / logs / audit / metrics / alerting / restore milestone；M2 backup-only verified path，M4 canonical local restore smoke |

**Cross-PRD audience split**:
- `notepage/` = note author / reader 视角（产品 user）
- `theme-system/` = horizontal subsystem，含 user-view 和 author-view 双 PRD
- `plugin-system/` = extension author（developer-user）视角
- `self-host-deploy/` = operator lifecycle 视角（setup-time 主动变更 + runtime 自主运行）
- Theme / block 在多 folder 都出现，分别是 user-observable / author-observable / framework-level view。

**Horizontal subsystem relationship**:
- `theme-system/` 跟 `plugin-system/` 是**平级 horizontal subsystem**（不是 parent-child）
- Theme 走 plugin-system 通用 extension lifecycle / capability / sandbox 机制
- Theme 自身的 product 责任（cascade / presentation / 3 built-in）归 theme-system folder

## Feature PRD template

详 [prd-discipline.md](../../../process/methods/prd-discipline.md) 的 Structure section。

## References

- PRD writing method: [prd-discipline.md](../../../process/methods/prd-discipline.md)
- Doc cross-reference convention: [doc-conventions.md](../../../process/methods/doc-conventions.md)
- Project PRD: [project.md](../project.md)

## Changelog

- 2026-05-16 initial（Phase E setup）
- 2026-05-16 reframe: canvas-editing.md → notepage/ folder（vocab `canvas` → `notepage` PRD product vocabulary；hierarchical structure with top + 4 sub-PRDs）；其他 feature 同步 folder 结构
- 2026-05-16 plugin-system reframe: 从 "block extension only" 扩为 generic extension framework；plugin-system/ folder 加 top + new-block + new-theme sub-PRDs；audience split 显式化（notepage/ = user 视角；plugin-system/ = author 视角）
- 2026-05-16 **theme-system reframe (horizontal subsystem)**：theme 抽出独立 folder `theme-system/`（原 `notepage/notepage-themes.md` + `plugin-system/new-theme.md` `git mv` 合并）；承载 4-layer cascade model（L0 hard invariants / L1 framework default / L2 theme default / L3 plugin new theme）+ per-attribute override + fork-friendly；audience split 升级（theme-system 跟 plugin-system 平级 horizontal subsystem；非 parent-child）；notepage / plugin-system 6 PRD 同步 cross-folder refs
- 2026-05-16 **Day-1 PRD #3 authentication 起草**：reframe auth 为 **system-level PEP**（vs horizontal feature）；8 cross-cutting invariants；Build vs Buy = Buy（Better-Auth baseline，M2 ship 前 verify）；3-layer abstraction（AuthProvider plugin / TokenStrategy operator-config / TokenCarrier library-internal）；AuthProvider 跟 BlockPlugin / ThemePlugin 平级 plugin extension type；Day-1 M2 = UsernamePassword + admin via install bootstrap + 3-role + anonymous public read；OAuth / WebAuthn / 2FA / PAT Phase 2+ as AuthProvider plugin
- 2026-05-17 **Day-1 PRD #4 self-host-deploy 起草**：operator-facing feature folder（非 horizontal subsystem）；owner ratify **setup-time vs runtime 时间维度二分**（per discussion 候选 Y）；3 PRDs（top + setup-time + runtime）；top 含 3-tier operator profile + 5 deploy mode + 12 cross-cutting invariants；setup-time 5 sections（first install / adapter config / L4 option add / upgrade / L3 replacement migration）；runtime 4 sections（backup schedule / health / log + audit / anomaly detection）；M2 ship Canonical OCI + single-binary + < 10 min onboarding；M3 NAS/VPS templates；M4 Workers tier 3 verify + 5 mode 全 verify；surface 多条 ADR debts（migration archive format / metrics ADR / audit event ADR / alert delivery / install profile validation / etc.）
- 2026-05-22 **self-host-deploy top pass 2 sync**：top-level PRD 改为 operator-lifecycle shared model（What / Why / Whole picture / Operator-facing experience / MVP / Progressive / Done / Reference）；features index 同步 setup-time/runtime narrative form、bootstrap mode、M-stage restore/deploy-mode口径；新增 self-host top-level discussion record。
