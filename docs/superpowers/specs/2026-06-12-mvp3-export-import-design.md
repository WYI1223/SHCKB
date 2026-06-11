# MVP-3 Design: Export / Import — git 友好的数据自主权格式

| Field | Value |
|---|---|
| Status | approved (owner ratified 2026-06-12) |
| Theme | "数据是你的" — operator 对实例数据的完全自主权 |
| Lineage | MVP-1 核心循环 → MVP-2 可部署可分享 → **MVP-3 数据可带走/可恢复/可降级** |
| Discussion | 本文件即设计记录；build log 落 `docs/engineering/design/discussions/mvp3-scope-2026-06-12.md` |

## 1. 目标与边界

**目标**：一个 canonical、git 友好的全实例导出格式，配套 export / import 能力，使三件事成为可能：

1. **备份/恢复**：与 `/data` 卷备份互补的逻辑层备份（可读、可 diff、可进 git）
2. **实例迁移**：setup-time 的 operator 迁移路径（export → 重装/换 L3 adapter → import），兑现 [setup-time.md] 的产品口径与 operator-pluggable 原则
3. **保数据的版本降级**：通过导出端格式降级，填上 [ADR-0020]"无 DB down migration"留下的唯一空洞

**明确不做（已定边界，非延期）**：

- 双向同步 / 增量 import / merge —— CRDT/git 与多端同时编辑不共存（owner 2026-06-11 拍板）
- import 进非空实例 —— import 仅全量恢复进空实例
- 导出 `publishedHtml` —— 派生物，import 时重渲染

## 2. Canonical 格式（格式即契约，落新 ADR）

```
export-root/
  manifest.json          # formatVersion + schemaVersion + appVersion + 导出时间 + 页面清单
  tree/                  # 目录结构 = 文件夹森林的镜像
    方法论/               # 文件夹 → 目录
      my-note.page.json  # 单个 notepage 的全部真相
    another.page.json    # 根级页面
  blobs/
    <sha256>             # content-addressed，文件名即校验和（无扩展名）
```

**`*.page.json` 内容**：id、title、slug、visibility、gravityEnabled、sortKey、publish 状态（是否已发布 + publishedDoc 快照）、blocks 数组。block 的 kind-owned content **原样保留不解释**（与 DB 中 blocks.content 的 kind-opaque 原则一致）。

**git 友好的可验证性质**（写进 ADR 作为格式不变量）：

- 稳定排序：blocks 按 id 排序；manifest 清单按路径排序；JSON key 顺序固定
- pretty-print JSON + LF 行尾（同 `.gitattributes` 已有约定）
- blob 文件名 content-addressed → 内容不变则 diff 为零
- 确定性：同一实例连续两次 export（无写入间隔），除 manifest 的导出时间戳单字段外字节级一致——时间戳被刻意限制在这一个字段，其余任何文件不得携带导出时刻信息

## 3. 格式迁移管线（镜像 [ADR-0020] 的模式，不复用其实现）

| | DB migration | 格式 migration |
|---|---|---|
| 作用对象 | 活库（DDL，有状态） | 导出物（JSON→JSON 纯函数，无状态） |
| 版本记录 | journal 表 | manifest.formatVersion |
| 方向 | 只升（降级=恢复备份） | **双向**（up/down 成对） |

**管线**：有序版本化 transform，逐级串行。import 时自动跑：load → migrate 到当前版本 → validate → 入库。

**双向规则（owner ratified 2026-06-12）**：

1. **降级发生在导出端，不在 import 端**——旧实例不认识新格式，无从降级后导入；唯一可行位置是新代码做 vN→vN-1 变换后导出，旧实例 import 它本来就认识的旧格式。export API 留 `?format=<version>` 参数位。
2. **降级天然有损，必须显式**：down transform 声明丢什么，导出报告明说（如"3 个 xxx block 已降级为占位"）或直接拒绝；不允许静默丢数据。
3. **成对提交纪律**：此后每次格式变更必须成对提交 up/down transform。成本翻倍是接受的——格式是契约本就应极少变，翻倍成本是健康的刹车。
4. 与 [ADR-0020] 不矛盾：危险的从来不是"降级"，是"原地改唯一副本"。格式降级是纯函数产出新文件，原数据一字不动，旧实例 import 校验照常把关。

**MVP-3 实装面**：管线机器 + 一对合成测试 transform（虚构 v0↔v1）把机器测透。生产 transform 等格式 v2 真出现才写（YAGNI——现在只有 v1，没有东西可迁）。

## 4. Export

- Admin-only API：打包整棵森林（folders + notepages + 被引用 blobs + manifest）为 zip 流下载
- Shell 内导出入口（admin 可见）
- `?format=<version>` 参数：MVP-3 只接受当前版本，给出明确错误信息

## 5. Import

- 仅空实例（users 表可非空——auth 数据不在导出物内；判定"空"= 无 notepage 无 folder）
- 入口形态：admin API（空实例上）；CLI/bootstrap 路径若实现成本低则顺带
- 管线：解包 → manifest 校验（格式版本、schema 兼容）→ 格式 migrate → 逐项 validate（含 grid-engine validateState）→ 事务内全量写入 → 已发布页面重渲染 publishedHtml
- **原子性**：要么全进要么全不进；任何一项失败回滚并报告失败项
- 新格式进旧实例：manifest.formatVersion 高于本实例 → 明确拒绝（同 DB 降级护栏的语义，报错信息指向"用导出端降级"）

## 6. 顺风车：Blob GC（还 [ADR-0022] 的债）

Export 必须实现"枚举所有被引用的 blob"（扫描 blocks.content + publishedDoc 中的 blobHash）。同一套引用枚举逻辑 + admin 触发的清理动作 = GC。删除未引用 blob，报告释放空间。

## 7. 验证

- **Round-trip 性质测试**：export → 空库 import → 再 export，除 manifest 时间戳字段外字节级一致（核心正确性证明）
- 格式管线：合成 v0↔v1 transform 的升降级测试（含有损降级的报告断言）
- 原子性：构造中途失败的 import，断言库为空
- Blob GC：引用/未引用混合场景
- 容器实测：真实例 export → 新容器 import → 公开页/编辑器行为一致

## 8. 文档动作

- 新 ADR：canonical 格式 + 格式迁移双向纪律（PRD-informed，引 [setup-time.md] operator 迁移口径）
- `self-host-upgrade.md` runbook 增补：逻辑备份 vs 卷备份的关系、保数据降级路径
- AUDIT register：blob GC 债标记已还

## 9. 不进这一轮（记录在案）

边栏拖拽排序、markdown 编辑打磨、gravity 重开塌陷 UX —— "编辑体验"主题，MVP-4 候选。SSR/SPA 双渲染器 drift 仍是已记录债（import 重渲染会再次穿过它，但不在本轮解决）。
