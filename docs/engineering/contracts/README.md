# Package Contracts 索引

每个 internal package 的**对外契约**（types / ops / invariants / consumer guidance）。

**SoT 物理位置**：每个包的 `CONTRACT.md` 住在 `packages/<pkg>/CONTRACT.md`（贴源码同包根）。本索引页只列已存在契约 + 一句话定位 + 链接；不放契约本体内容。

## 索引

| 包 | 契约 | 一句话定位 | 主要 consumer |
|---|---|---|---|
| `@skb/grid-engine` | [packages/grid-engine/CONTRACT.md](../../../packages/grid-engine/CONTRACT.md) | 2D AABB 布局算法（12 col × N row LEGO baseplate） | editor shell / API endpoint / plugin facade / agent dispatch |

（其他 package 契约随 ADR-0004 / ADR-0014 落地补；Phase F carryover 提升时一并补：`block-foundation` / `plugin-markdown` / 等）

## 与 ADR 的关系

- **ADR 决策的是 architectural induction**（架构承诺）—— 为什么 engine 存在 / 为什么 pure / 为什么 kind-opaque 等
- **CONTRACT 决策的是 surface**（types / op set / 算法细节）—— 具体函数叫什么名字 / OpResult shape 等
- **演化规则**：
  - CONTRACT surface 小步演化（minor / patch / breaking-but-not-induction）走 PR review，不每次都 supersede ADR
  - 破坏 ADR induction 承诺（如 Option A gravity 变 B / kind-opaque 变 kind-aware）才走 ADR supersede
- ADR 引用 CONTRACT 时用相对路径 `../../../packages/<pkg>/CONTRACT.md`
- CONTRACT 引用 ADR 时用 `../../docs/engineering/decisions/ADR-XXXX-...md`

详 ADR 写作 method：adr-discipline.md 的 foundational-ADR + contract-doc 分工节。

## 写作规则（per package CONTRACT.md）

每个 CONTRACT.md 应该包含：

1. **Types** —— 包对外暴露的核心 type definitions
2. **Operation set** —— 按能力面（state mutation / query / validation / 等）组织的 op 表
3. **Invariants** —— 包承诺保持的不变量 + property-based test 状态
4. **Algorithm details** —— 算法伪代码（当外部 consumer 需要理解 trade-off 时）
5. **Consumer guidance** —— 每类 consumer 怎么用（editor / API / plugin / agent / etc.）
6. **Versioning** —— 哪些变更走 minor / major / ADR supersede
7. **References** —— 链 ADR / 相关 contract / source DI doc

不应该包含：

- 架构 induction（"为什么这个包存在"）—— 归 ADR
- 实装细节（具体 .ts 文件位置 / 内部 helper function）—— 归 source code comments
- 产品决策（"用户为什么需要 grid"）—— 归 PRD

## 命名约定

- 文件名固定为 `CONTRACT.md`（大写，与 `package.json` 同级）
- 包名按 `@skb/<kebab-case>` 形态
- 索引页（本文件）按字母序列；不按时间序

## References

- ADR 写作 method: [adr-discipline.md](../../process/methods/adr-discipline.md)
- Doc cross-reference convention: [doc-conventions.md](../../process/methods/doc-conventions.md)
