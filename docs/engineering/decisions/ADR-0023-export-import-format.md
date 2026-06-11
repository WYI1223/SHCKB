# ADR-0023: Canonical export/import format & bidirectional format migration

| Field | Value |
|---|---|
| Status | proposed |
| Date | 2026-06-12 |
| Authors | W_YI (owner), Claude |
| Supersedes | — |
| Superseded by | — |
| Source | [mvp3-scope-2026-06-12.md](../design/discussions/mvp3-scope-2026-06-12.md) + spec [2026-06-12-mvp3-export-import-design.md](../../superpowers/specs/2026-06-12-mvp3-export-import-design.md)（owner ratified；PRD-informed：[setup-time.md] operator 迁移口径） |

## Context

Self-host 产品的第三块基石是 operator 对数据的完全自主权：逻辑备份（可读可 diff）、跨实例迁移（含换 L3 adapter 的 export-reinstall-import 路径，per [setup-time.md]）、以及保数据的版本降级。[ADR-0020] 故意不做 DB down migration（原地 DDL 降级危险），留下的降级路径只有"恢复备份"——备份之后的数据会丢。

## Decision

### 1. Canonical 格式 v1（格式即契约）

```
manifest.json            # formatVersion / schemaVersion / appVersion / exportedAt / counts / 页面清单 / blob 清单(hash+mime+size+createdAt)
tree/<目录…>/folder.json  # 目录结构 = 文件夹森林镜像；folder.json 携带 id/name/sortKey/createdAt
tree/<目录…>/<slug>.page.json  # 单页全部真相：id/slug/title/visibility/gravity/sortKey/时间戳/published 快照/blocks
blobs/<sha256>           # content-addressed，文件名即校验和
```

- **确定性不变量**：同一实例两次导出，除 `manifest.exportedAt` 单字段外字节级一致。手段：固定 key 顺序（代码显式构造）、2-space pretty JSON + LF、blocks 按 id 排、同级排序 (sortKey, id)、manifest 清单字典序、zip mtime 固定 DOS epoch。导出目录扔进 git 后 diff 有意义。
- **目录名 = sanitize(文件夹名)**，同级碰撞（含大小写不敏感，Windows/macOS）按 (sortKey, id) 顺序加 `~2` 后缀；原始名在 folder.json 里，目录名只是表现。页面文件名取自 slug（全局唯一），但 import 以 JSON 内容为准。
- **`publishedHtml` 不导出**（派生物，import 重渲染）；block content 为 kind-owned JSON **原样保留不解释**。

### 2. 格式迁移管线（镜像 [ADR-0020] 的模式，非其实现）

纯函数 JSON→JSON、无状态（版本在 manifest 里）、有序版本化 transform 逐级串行。import 自动升级到当前版本。

**双向纪律（owner ratified 2026-06-12）**：

1. 每次格式变更**必须成对提交 up/down transform**。成本翻倍是刹车不是负担——格式是契约，本就应极少变。
2. **降级发生在导出端**：旧 build 不可能认识新格式，唯一可行位置是新代码做 vN→vN-1 后导出。export API 留 `?format=` 参数（v1 阶段只接受当前版本）。
3. **有损必须显式**：down() 必须枚举丢弃的每项数据，静默丢失是缺陷。
4. 与 [ADR-0020] 不矛盾：危险的从来不是降级，是原地改唯一副本。格式降级产出新文件，原数据不动，旧实例 import 校验照常把关。这给了产品**唯一保数据的降级路径**（优于恢复备份）。

v1 阶段 production registry 为空；管线机器由合成 transform 对测透。

### 3. Blob 引用契约（新增 content 契约）

**Block kind 必须以小写 hex sha256 原文在 content JSON 中引用 blob。** 这使 kind-opaque 的引用枚举成为可能：扫描任意 JSON 值中的 64-hex 字符串。误报方向安全——export 端与 blobs 表求交（不导出非 blob 字符串），GC 端误报只会多保活、永不误删。

### 4. Import 门（全部在任何写入之前）

1. 仅空实例（无 notepage 无 folder；users/auth 数据不在导出物内，不受影响）→ 否则 409
2. 新格式拒绝（同 DB 降级护栏语义，报错指向导出端降级）→ 409
3. 结构 + 逐页校验（grid-engine validateState 含 gravity / slug & id 去重 / blob sha256 复核）→ 任一失败 422 全不写
4. 原子性：blob 文件先写（content-addressed 幂等，事务失败留下的孤儿由 GC 清扫），DB 单事务全量写入，published 页面重渲染 HTML

### 5. Blob GC（还 [ADR-0022] 的显式债）

与 export 共享引用枚举：删除 blobs 表中未被引用的行 + 磁盘上无表行的孤儿文件，admin 手动触发（`POST /api/admin/blobs/gc`），返回 `{deleted, freedBytes}`。

## Consequences

- Admin 角色出现第一个真实授权差异点（export/import/gc 仅 admin；此前任何认证用户同权）
- Import 重渲染会穿过 SSR/SPA 双渲染器（drift 债仍开放，本 ADR 不解决）
- 逻辑备份与 [ADR-0020] 卷备份互补：卷备份快且全（含 users），逻辑导出可读可迁移（不含 users）
- 未来格式 v2 出现时：写一对 up/down、注册进 FORMAT_TRANSFORMS、export 端 `?format=` 解锁降级——机器已就位

## Alternatives considered

1. **per-kind blob 清单（kind 自报引用）** —— 拒绝：破坏 kind-opaque；每个 kind 多一个必须实现的接口，引用契约（原文 sha256）更便宜且可静态检验。
2. **tar / 裸目录** —— 拒绝：zip 是 operator 最熟悉的单文件形态，单请求 HTTP 上传下载，fflate 同步 API 简单。
3. **增量 / merge import** —— 拒绝（owner 已定边界）：CRDT/git 与多端同时编辑不共存；全量恢复语义简单且可验证（round-trip 字节一致）。
4. **复用 DB migration 框架跑格式迁移** —— 拒绝：作用对象不同（活库 DDL vs 导出物纯函数），强行复用会把无状态管线绑上 journal 表。镜像其模式即可。

## References

- Spec: [2026-06-12-mvp3-export-import-design.md](../../superpowers/specs/2026-06-12-mvp3-export-import-design.md)
- Source discussion: [mvp3-scope-2026-06-12.md](../design/discussions/mvp3-scope-2026-06-12.md)
- PRD: [setup-time.md](../../product/prd/features/self-host-deploy/setup-time.md)
- 相关 ADR: [ADR-0020](./ADR-0020-db-migrations-upgrade.md)（迁移模式镜像 + 降级护栏语义）/ [ADR-0022](./ADR-0022-blob-storage.md)（GC 债源 + content-addressed 基础）
