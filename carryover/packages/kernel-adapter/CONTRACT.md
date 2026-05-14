# @skb/kernel-adapter Contract

## Public surface

### Types & interfaces

- `KernelAdapter` interface — `id` / `capabilities` / `startSession()`
- `KernelSession` interface — `execute()` / `interrupt()` / `shutdown()`
- `KernelEvent` discriminated union — 6 type 覆盖 stdout/stderr/display/result/error/status
- `KernelCapabilities` interface

### Error classes (typed throw surface)

- `KernelError` — abstract base; all adapter-thrown errors extend this so callers can catch with one `instanceof` check
- `KernelStartupError` (`kind: 'startup'`) — `startSession()` could not bring the kernel online
- `KernelShutdownError` (`kind: 'shutdown'`) — shutdown failed or invoked on already-shutdown session
- `KernelInterruptError` (`kind: 'interrupt'`) — interrupt requested but adapter could not honor it
- `KernelTimeoutError` (`kind: 'timeout'`) — operation did not complete within adapter-specific deadline (Phase 2+ remote adapters; reusable in Wave 2 if Pyodide hangs)

In-band Python/runtime exceptions (e.g. user code raises) are NOT thrown — they
arrive as `KernelEvent { type: 'error', ename, evalue, traceback }` on the
event stream. Errors above are reserved for adapter-level failures.

## Invariants

- KernelEvent 必须保持 discriminated union（`type` 字段 literal）—— packages/kernel-pyodide 与未来 RemoteJupyterAdapter 都依赖此
- `KernelEvent.type` 当前枚举：`stdout` · `stderr` · `display_data` · `execute_result` · `error` · `status`
- 包内**只放 type / interface / error 类**，不放具体实现（实现归属各 adapter 包，例如 `@skb/kernel-pyodide`）
- 所有 adapter 抛出的非-event 错误必须 `extends KernelError`（包括 adapter 自定义子类如 `RemoteAuthError`），保证调用方 `instanceof KernelError` 一次捕获

## Implementations

- Phase 1：`@skb/kernel-pyodide` (Wave 2)
- Phase 2+：`@skb/kernel-remote-jupyter` 等

## Modifying this file

公共表面（`KernelAdapter` / `KernelSession` / `KernelCapabilities` / `KernelEvent` / `KernelError` 及其 4 个子类）的任何字段或方法增删改一律需 ADR — **包括添加 optional 字段、新增 KernelEvent 变体、新增 KernelError 子类**。spec §2.3 把 kernel-adapter 列为接口包，规则"改动需 ADR；全员同步"不区分 optional vs required。

原因：`KernelAdapter` 接口 freeze 是 Wave 2 PyodideAdapter 与 Phase 2 RemoteJupyterAdapter 共同的契约基础；optional 字段会在 2+ 实现间产生兼容性矩阵，无 ADR 协调会引发漂移。同步范围：本文件 + kernel-registry + 全部已实现 adapter 包。

## Related

- [设计规格 §1.6 / §2.6](../../docs/superpowers/specs/2026-04-29-self-knowledge-base-design.md)
- [kernel-registry/CONTRACT.md](../kernel-registry/CONTRACT.md)
