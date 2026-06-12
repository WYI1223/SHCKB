# Examples

`skb-examples.zip` 是一个 SHCKB 导出包（format v2），含三个真实使用场景，
导入后即可浏览：

| 页面 | 场景 | 钉选主题 | 展示点 |
|---|---|---|---|
| 六月手帐 | 日记 | stationery | 手写体 / 撕边 / 胶带 / 拍立得 / 任务清单 |
| 海岸线三日 | 旅行照片记录 | stationery | 多图拍立得排版 / 图文混排 / blob 管线 |
| grid-engine 重力算法讲解 | 知识点 + 代码解析 | workbench | code(draft) 高亮 / 讲解流双栏布局 |

## 导入

导入仅支持**空实例**（全量恢复，[ADR-0023]）。新起一个实例后，
用管理员账号在侧栏点 ⤒ Import 选择本包，或走 API：

```bash
curl -X POST -H "cookie: $SESSION" -H 'content-type: application/zip' \
  --data-binary @examples/skb-examples.zip \
  http://localhost:3000/api/admin/import
```

三页均已 publish 且 public，导入后直接访问 `/notes/<slug>`。

## 重新生成

包由可重放 seed 脚本产生（图片为确定性程序生成 PNG，无版权问题）：

```bash
bun apps/server/scripts/seed-examples.ts \
  --base http://localhost:3000 --email <admin> --password <pw>
```

脚本有幂等护栏：顶层已存在 `示例` 文件夹时拒绝运行。
