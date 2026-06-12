# Devdocs — 产品内开发者文档（docs-as-bundle）

`skb-devdocs.zip` 是一个 SHCKB 导出包（format v4），含四页开发者文档，
用产品自身写产品的文档（M7-D3 dogfooding）：

| 页面 | 内容 | 主题 |
|---|---|---|
| 开发者导览 | 仓库结构 / 跑起来 / 文档树指引 / 新人四坑 | workbench |
| 架构说明 | 五个系统不变量：两态模型 / 发布纯函数 / 三层外观分权 / PEP / 确定性导出 | workbench |
| 扩展开发 QA | 加块 kind / 写主题 / 契约护栏测试 | workbench |
| 运维与数据 QA | 部署 env / 备份恢复 / 升降级保数据 / blob GC / 排障 | workbench |

**真理源治理**：canonical 源 = `apps/server/scripts/seed-devdocs.ts`（git 审阅
的对象）；本 zip 是它在空实例上的确定性产物（modulo `manifest.exportedAt`）。
PRD / ADR / CONTRACT 等治理文档**不**进产品——它们的家在 `docs/` 与
`packages/*/CONTRACT.md`（PRD-master 纪律）。

## 导入

导入仅支持**空实例**（[ADR-0023]）。已有内容的实例请用 seed 脚本：

```bash
# 空实例：直接导入
curl -X POST -H "cookie: $SESSION" -H 'content-type: application/zip' \
  --data-binary @devdocs/skb-devdocs.zip \
  http://localhost:3000/api/admin/import

# 任意实例：重放 seed（顶层已存在「开发者文档」文件夹时拒绝运行）
bun apps/server/scripts/seed-devdocs.ts \
  --base http://localhost:3000 --email <admin> --password <pw>
```

四页均已 publish 且 public，导入后直接访问 `/notes/<slug>`。

## 更新流程

改 `seed-devdocs.ts` → 在临时空实例上重放 → `GET /api/admin/export`
覆盖本 zip → 一起提交。文档内容的 review 发生在脚本 diff 上。
