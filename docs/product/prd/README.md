# PRD —— Product Requirements Documents

## 结构

- [`project.md`](./project.md) —— **项目级 PRD**：vision / 产品定义 / 原则 / target operator + user / non-goals / success criteria / roadmap
- [`features/`](./features/) —— **功能级 PRD**：每个核心功能一份，user stories + functional / non-functional requirements + acceptance criteria + dependencies

## 编辑规则

- PRD 是 **living document** —— 产品演化时更新
- 每份 PRD 底部维护 `## Changelog` section；记录大改（≥ section 级别）日期 + 改了什么
- 小改（typo / link fix / 措辞调整）不必入 changelog
- PRD 引用 ADR / DI doc 时用相对路径 markdown link

## PRD vs ADR 边界

- **PRD** = 用户感受得到 / 产品想做什么（功能 / 体验 / 约束 / 接受标准）
- **ADR** = 工程怎么实现（技术选型 / 架构决策 / 实施约束）
- 一个 feature 通常对应：1 个 feature PRD + N 个 ADR（feature 引用 ADR 但不重复 ADR 内容）
