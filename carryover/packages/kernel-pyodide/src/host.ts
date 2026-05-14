import type { KernelEvent } from '@skb/kernel-adapter';

/**
 * Swap point between real Pyodide runtime and test mocks.
 *
 * `runCode` runs Python source. The host emits 0-N KernelEvent values
 * to `emit` (display_data / stdout / stderr) as the code runs, and resolves
 * with the final execute_result data (or null when the cell produced no value).
 * Errors raised by user Python code MUST be re-thrown so the session layer
 * can convert them to a single `error` KernelEvent — the host MUST NOT emit
 * `error` events itself.
 *
 * `interrupt` MAY no-op when the host has no cancellation primitive (Wave 2
 * main-thread Pyodide); the session layer still flips status back to idle.
 * Returning `Promise<void>` (Wave 3 worker host) is also allowed — session
 * awaits the result so async failures wrap into KernelInterruptError.
 */
export interface PyodideHost {
  runCode(
    code: string,
    emit: (event: KernelEvent) => void,
  ): Promise<Record<string, unknown> | null>;
  interrupt(): void | Promise<void>;
  shutdown(): Promise<void>;
}

export interface PyodideHostFactory {
  create(): Promise<PyodideHost>;
}
