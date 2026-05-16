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
| Notepage（user-facing notepage 整体） | [notepage/](./notepage/) | draft（top + 4 sub-PRDs） |
| Plugin system（generic extension framework） | [plugin-system/](./plugin-system/) | draft（top + new-block + new-theme sub-PRDs） |
| Authentication + multi-user | [authentication/](./authentication/) | TODO |
| Self-host deployment（5 modes） | [self-host-deploy/](./self-host-deploy/) | TODO |

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
| [notepage/notepage-themes.md](./notepage/notepage-themes.md) | Theme system 的 user-observable behavior（3 内置 theme + persistence + switcher） |
| [notepage/notepage-responsive.md](./notepage/notepage-responsive.md) | Viewport projection（mobile 1-col / tablet 6-col / desktop 12-col） |

### Plugin-system（extension author 视角）

| Sub-PRD | Scope |
|---|---|
| [plugin-system/plugin-system.md](./plugin-system/plugin-system.md) | top-level framing：generic extension framework + cross-cutting invariants + plugin vs operator-pluggable 区分 |
| [plugin-system/new-block.md](./plugin-system/new-block.md) | Block kind extension（author 怎么写 new block plugin） |
| [plugin-system/new-theme.md](./plugin-system/new-theme.md) | Theme extension（author 怎么写 new theme + fork / compose path） |

**Cross-PRD audience split**: notepage/ = note author / reader 视角；plugin-system/ = extension author（developer-user）视角。Theme / block 在两 folder 都出现，分别是 user-observable vs author-observable view。

## Feature PRD template

详 [prd-discipline.md](../../process/methods/prd-discipline.md) 的 Structure section。

## References

- PRD writing method: [prd-discipline.md](../../process/methods/prd-discipline.md)
- Doc cross-reference convention: [doc-conventions.md](../../process/methods/doc-conventions.md)
- Project PRD: [project.md](../project.md)

## Changelog

- 2026-05-16 initial（Phase E setup）
- 2026-05-16 reframe: canvas-editing.md → notepage/ folder（vocab `canvas` → `notepage` PRD product vocabulary；hierarchical structure with top + 4 sub-PRDs）；其他 feature 同步 folder 结构
- 2026-05-16 plugin-system reframe: 从 "block extension only" 扩为 generic extension framework；plugin-system/ folder 加 top + new-block + new-theme sub-PRDs；audience split 显式化（notepage/ = user 视角；plugin-system/ = author 视角）
