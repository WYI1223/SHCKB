# Devdocs — 产品内开发者文档（docs-as-bundle）

`skb-devdocs.zip` 是一个 SHCKB 导出包（format v4），含 12 页三级层级的开发者文档，
用产品自身写产品的文档（M7-D3 起；M7-D10 按 owner 反馈重做：层级加深、内容加厚、
**结构导图用画布本身表达架构**——每个模块一个块、块的空间布局即软件结构）。

```
开发者文档/
├── 结构导图            ← galley 钉选；模块块穿 keyline 壳、带规线穿 cutout 壳
├── 开发者导览
├── 架构/
│   ├── 网格引擎与画布
│   ├── 两态模型与发布管线
│   ├── 主题引擎
│   ├── 块系统
│   ├── 认证与权限
│   └── 数据与存储
├── 扩展开发/
│   ├── 写一个块
│   └── 写一个主题
└── 运维/
    ├── 部署与环境
    └── 备份迁移与排障
```

除结构导图外全部 workbench 钉选；页间用 `/notes/<slug>` 硬链接互引
（产品尚无一等页间链接——已记录的 dogfooding 摩擦）。

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

# 任意实例：重放 seed；--replace 删除既有「开发者文档」文件夹树后重灌
bun apps/server/scripts/seed-devdocs.ts \
  --base http://localhost:3000 --email <admin> --password <pw> [--replace]
```

12 页均已 publish 且 public，导入后从 `/notes/结构导图` 进入。

## 更新流程

改 `seed-devdocs.ts` → 在临时空实例上重放 → `GET /api/admin/export`
覆盖本 zip → 一起提交。文档内容的 review 发生在脚本 diff 上。
