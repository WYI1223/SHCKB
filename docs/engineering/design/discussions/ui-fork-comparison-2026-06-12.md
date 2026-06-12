# UI 分叉研究对比（M7-D4）— owner 择采材料

| Field | Value |
|---|---|
| Date | 2026-06-12 |
| 方法 | 3 个平行 agent，隔离 worktree，brief 零现 UI 截图，宣言先于样式代码提交（概念独立性保证） |
| 状态 | 三分支全部可跑：typecheck 干净、全测试绿、7 张截图/分支 |
| 备注 | 实现由分叉 agent 完成；验证+截图由主会话补完（agent 中途撞用量上限） |

## 三个方向

| | `ui-fork/free`（不给方向） | `ui-fork/reader`（文档阅读型） | `ui-fork/workbench`（画布工作台型） |
|---|---|---|---|
| **设计语言** | **Paste-Up 拼版室**：印前拼版房隐喻 | **Marginalia 边注体**：抄本/出版物版式 | **Graphite Bench 石墨工作台**：制图桌图底关系 |
| **chrome 基调** | 骨纸+石墨墨，固定中性亮色 | 暖纸+四档墨+朱砂一色，亮色 | 哑光石墨暗色，单一机械青信号色 |
| **核心论点** | 作者工具用"非感光蓝"标记——凡是蓝的读者永远看不见（双通道词汇：墨=内容/蓝=仪器） | 阅读是默认态、编辑是临时态——chrome 静默，工具只在 hover/选中时浮现 | 深 chrome 是画框、亮画布是画——图底关系让任何主题都"被点亮" |
| **Properties** | 右侧 spec sheet，可折叠 | **默认不存在**，选中时从右缘滑入，取消即退场 | **常驻仪表**，无选中时显示页属性（3D 工具语义的直译） |
| **palette** | 画布左缘窄"字盘"托盘 | 不常驻——画布角落一枚 + 墨点，点开即收 | 左坞 Navigator 下方 INSERT 分区，常驻 |
| **保存状态** | 职票"校样戳"（等宽戳记） | 极小墨点（实心/呼吸/朱砂） | 状态栏常驻四态灯 + selection 读数 |
| **读者侧** | 排成 colophon 版权页式目次 | **设计预算的另一半**：书籍总目次（衬线+点线引导+日期），新增 marginalia 主题 | 同源石墨语言但卸下仪表，阅读模式索引 |
| **新增** | — | marginalia 主题（读者侧气质载体） | 键盘一等公民（方向键移块/Shift 改尺寸/状态栏快捷键提示） |

## 截图初见（主会话观察，仅供导览）

- **Paste-Up**：三区工作台成立——主题画布确实像"放在灯桌上的一张纸"，有边有框；发丝线 chrome 安静且与 stationery 主题无冲突。整体最"克制的中间态"。
- **Marginalia**：编辑器静止态几乎就是发布态，chrome 存在感最低；**公开目次是三者中最惊艳的单页**（书名页大标题 + 点线引导 + 日期，完全兑现宣言）。代价：工具可发现性最弱（+ 墨点、滑入检查器都要学）。
- **Graphite Bench**：图底关系立竿见影——stationery 亮纸在石墨框里确实"被点亮"；inspector/状态栏/双坞最贴近 owner 的 3D 引擎类比；信息密度最高，"工具感"最强。

## 怎么跑（各自 worktree 或任意 checkout）

```powershell
# 分支：ui-fork/free | ui-fork/reader | ui-fork/workbench
git checkout ui-fork/<name>
# server（避开 3278-3377 等 Windows 排除区）
$env:SHCKB_DB_PATH="...临时"; $env:SHCKB_AUTH_SECRET="..."; $env:SHCKB_ADMIN_EMAIL="..."; $env:SHCKB_ADMIN_PASSWORD="..."; $env:PORT='3121'; bun apps/server/src/index.ts
# web
$env:SHCKB_API_TARGET='http://localhost:3121'; cd apps/web; bun x vite --port 5273
# 内容：seed-examples.ts + seed-devdocs.ts 两个脚本灌
```

截图集：各分支 `docs/engineering/design/discussions/ui-fork-<name>/shots/`（登录/侧栏/手帐编辑器/激活块/代码编辑器/静态发布页/匿名目录 ×7）。

## 择采的真问题（不只是"哪个好看"）

1. **chrome 与主题的关系**：固定中性亮（Paste-Up）/ 静默纸感（Marginalia）/ 固定中性暗（Graphite）——三者都坚持"chrome 不随主题换肤"，与 CONTRACT 分权一致。选哪个基调 = 选产品的"身体"。
2. **检查器存在论**：常驻仪表 vs 按需滑入 vs 可折叠中间态——直接决定未来 chrome 放权时 properties 槽位的契约形状。
3. **palette 的地位**：插入是高频动作（常驻）还是低频动作（收纳）——dogfooding 数据（M7-D3 摩擦清单）可以参与回答。
4. **读者侧投资**：Marginalia 把读者目录当一等公民的立场值得单独评估——即使不采全套，目次页可以单独移植。
5. **混采路径**：三分支改的是同一批文件（Shell/EditorPage/Properties/Palette/login），整支合并互斥，但**理念可拆**（如 Graphite 的键盘系统 + Paste-Up 的两通道色彩纪律 + Marginalia 的目次页）。

## chrome 放权的形态样本（隐藏目标，已达成）

三个分叉对"chrome 槽位应该有哪些"给出了三份独立答案：topbar/状态栏/双坞（Graphite）、眉批/页边/脚注（Marginalia）、职票/字盘/spec sheet（Paste-Up）。冻结 chrome 契约前的 N 种形态样本（"3 themes = reference impl" 同款教训）现在 N=4（含现行 UI）。
