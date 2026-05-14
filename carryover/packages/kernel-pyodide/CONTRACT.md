# @skb/kernel-pyodide Contract

Phase 1 唯一 `KernelAdapter` 实现。在浏览器内通过 Pyodide 运行 Python，零后端。
默认 pre-load `numpy` / `pandas` / `matplotlib`（见 `capabilities.libraries`）；
SymPy 等其他 Pyodide 兼容包需运行时通过 micropip 安装，不在 default libraries。

## Public surface

### Class

- `PyodideAdapter implements KernelAdapter` — `id = 'pyodide'`，`capabilities`
  暴露 `libraries: ['numpy', 'pandas', 'matplotlib']` / `gpu: false` /
  `persistentState: true`；`startSession(sessionId)` 返回 `PyodideSession`
- `PyodideSession implements KernelSession` — `execute(code)` /
  `interrupt()` / `shutdown()`

### Constructor options

```ts
new PyodideAdapter({
  hostFactory?: PyodideHostFactory; // override (tests / Wave 3 worker)
  boot?: { indexURL?: string; libraries?: readonly string[] };
});
```

`hostFactory` 是 Wave 2 → Wave 3 的演进点：默认 factory 在当前线程
`loadPyodide()`，Wave 3 将引入 `createWorkerHostFactory()` 把 Pyodide
搬入 Web Worker（`SharedArrayBuffer` 中断 + 主线程不阻塞）。`KernelAdapter`
公共契约不变。

### Errors (typed throw surface)

术语与 [@skb/kernel-adapter CONTRACT.md](../kernel-adapter/CONTRACT.md) §"Error
classes" 同步（同 family；公开 surface 一致）：

- `KernelStartupError`（继承自 `@skb/kernel-adapter`，`kind: 'startup'`）— Pyodide
  加载失败（`startSession()` could not bring the kernel online）
- `KernelImportError`（本包扩展子类，`kind: 'import'`）— `loadPackage` / micropip
  install 失败（adapter-specific 子类，sister-aligned 与 kernel-adapter 同语）
- `KernelShutdownError`（继承自 `@skb/kernel-adapter`，`kind: 'shutdown'`）—
  shutdown 失败 OR 在已 shutdown session 上再次调用 `execute` / `shutdown`
- `KernelInterruptError`（继承自 `@skb/kernel-adapter`，`kind: 'interrupt'`）—
  interrupt 失败 OR 在已 shutdown session 上调用 `interrupt`
- `KernelTimeoutError`（继承自 `@skb/kernel-adapter`，`kind: 'timeout'`）—
  **reserved for future timeout-wired sessions; not currently emitted by
  Wave 2 PyodideAdapter**（main-thread Pyodide 0.27.x 无 cancellation primitive；
  Wave 3 worker-isolated host 引入 `SharedArrayBuffer` 中断后会用此）
- 用户 Python 代码抛出的运行时异常**不**作为 throw，而是作为
  `KernelEvent { type: 'error', ename, evalue, traceback }` 出现在事件流中
  （`@skb/kernel-adapter` CONTRACT.md 规定）

`KernelImportError` 是 `KernelError` 子类，调用方 `instanceof KernelError`
仍可一次捕获。Per [@skb/kernel-adapter](../kernel-adapter/CONTRACT.md) §"Error
classes": "Adapters MAY define their own subclasses (e.g. `RemoteAuthError
extends KernelError`); adding new subclasses is non-breaking" — 即 sister-doc
同款规则：所有 adapter 抛出的非-event 错误必须 `extends KernelError`，保证
调用方 `instanceof KernelError` 一次捕获（无需 ADR）。

## Event stream contract

`PyodideSession.execute(code)` 产生的事件流满足以下不变量（与
`@skb/kernel-adapter` 6-variant `KernelEvent` 同款字段）：

- 首事件必为 `{ type: 'status', state: 'busy' }`
- 末事件必为 `{ type: 'status', state: 'idle' }`
- 中间按到达顺序产生 `stdout` / `stderr` / `display_data` 事件
- 若代码产生返回值，在末 status 之前产生**单次** `execute_result`
- 若代码抛出异常，在末 status 之前产生**单次** `error` 事件（不再产
  `execute_result`）
- `error` 事件字段：`ename`（异常类名）/ `evalue`（消息字符串）/
  `traceback`（行数组，至少含 1 行）

## Invariants

- 6 个 `KernelEvent` 变体的字段按 `@skb/kernel-adapter` 公共类型导入，**不在本
  包内 inline 重定义**（ADR-0006 item #4 consumer schema audit）
- `PyodideAdapter.id` 字符串字面量 `'pyodide'` 必须与
  `@skb/kernel-registry` 的 `register` 输入一致；本包是唯一权威
- `capabilities.libraries` 必须与 `boot.ts` 默认 `loadPackage(...)` 列表
  逐字相同（authority ↔ runtime-fact 同步；ADR-0006 item #5）；当前实现
  `PYODIDE_LIBRARIES = DEFAULT_LIBS` 通过引用别名让漂移在结构上不可能，
  并由 adapter.test.ts 的 `expect(PYODIDE_LIBRARIES).toBe(DEFAULT_LIBS)`
  锁定（防御未来 revert 引入并行字面量）
- `KernelImportError` 必须 `extends KernelError`（保证 `instanceof
  KernelError` 一次捕获）

## Test strategy

- `adapter.test.ts`：TS-level 类型契约 + capability 字段 + `startSession`
  返回值形状（mock host）
- `session.test.ts`：6 event variants 流（status bookends / stdout / stderr /
  execute_result / error / interrupt / shutdown lifecycle）
- `matplotlib.test.ts`：mock `display_data` event schema 形状（mime types map +
  payload 类型）。**真 Pyodide CDN 不在 CI 跑**（plan-challenger NICE 8 修订）：
  - 集成层（本地手动）：`matplotlib.integration.test.ts`，`it.skipIf(process.env.CI)`
  - E2E 层（Wave 4）：Playwright 跑真页面 + 真 CDN

## Wave 3 evolution points

- `boot.ts` 的 `wrapPyodide` 当前 `interrupt()` no-op；Wave 3 引入 worker host
  时实现 `SharedArrayBuffer` 中断
- `boot.ts` 当前在主线程 import；Wave 3 把 `loadPyodide` 搬入 Worker 通过
  postMessage 中转事件流
- 两次演进**均不改 `PyodideAdapter` / `PyodideSession` / `PyodideHost`
  公共签名**（`PyodideHost` 是稳定 swap point）

## Modifying this file

- 加方法可任意；改 `PyodideAdapter` / `PyodideSession` 公共签名是契约破坏
  （影响 `@skb/kernel-registry` 路由 + `block-jupyter` consumer）
- `capabilities` 字段增删需同步 `@skb/kernel-adapter` `KernelCapabilities`
  类型扩展（后者改动需 ADR）

## Related

- [@skb/kernel-adapter CONTRACT.md](../kernel-adapter/CONTRACT.md) — 接口权威
- [@skb/kernel-registry CONTRACT.md](../kernel-registry/CONTRACT.md) — 路由层
- [设计规格 §1.6 / §2.6](../../docs/superpowers/specs/2026-04-29-self-knowledge-base-design.md)
- [ADR-0001 §3.1](../../docs/decisions/ADR-0001-stack-selection.md) — 内核选型理由
