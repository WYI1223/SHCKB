import type { PyodideInterface } from 'pyodide';
import type { KernelEvent } from '@skb/kernel-adapter';
import { KernelStartupError } from '@skb/kernel-adapter';
import { KernelImportError } from './errors';
import type { PyodideHost, PyodideHostFactory } from './host';

/**
 * Default libraries pre-loaded by `createDefaultHostFactory`. Exported so
 * the cross-file regression test can lock byte-equivalence with
 * `PYODIDE_LIBRARIES` in adapter.ts (ADR-0006 item #5).
 */
export const DEFAULT_LIBS = ['numpy', 'pandas', 'matplotlib'] as const;

export interface PyodideBootOptions {
  indexURL?: string;
  libraries?: readonly string[];
}

/**
 * Default factory boots real Pyodide (npm package) on the current thread.
 * Wave 3 will move this into a Worker; the host abstraction lets the
 * adapter swap implementations without changing PyodideAdapter or the
 * KernelAdapter contract.
 */
export function createDefaultHostFactory(opts: PyodideBootOptions = {}): PyodideHostFactory {
  return {
    async create(): Promise<PyodideHost> {
      const libraries = opts.libraries ?? DEFAULT_LIBS;
      let pyodide: PyodideInterface;
      try {
        const mod = await import('pyodide');
        pyodide = await mod.loadPyodide(
          opts.indexURL === undefined ? {} : { indexURL: opts.indexURL },
        );
      } catch (cause) {
        throw new KernelStartupError('failed to load Pyodide runtime', { cause });
      }
      try {
        await pyodide.loadPackage([...libraries]);
      } catch (cause) {
        throw new KernelImportError(
          `failed to load default libraries: ${libraries.join(', ')}`,
          { cause },
        );
      }
      return wrapPyodide(pyodide);
    },
  };
}

function stringifyResult(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  try {
    return JSON.stringify(value) ?? Object.prototype.toString.call(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
}

function wrapPyodide(pyodide: PyodideInterface): PyodideHost {
  let activeEmit: ((event: KernelEvent) => void) | null = null;
  pyodide.setStdout({
    batched: (text: string) => activeEmit?.({ type: 'stdout', text }),
  });
  pyodide.setStderr({
    batched: (text: string) => activeEmit?.({ type: 'stderr', text }),
  });
  return {
    async runCode(code, emit) {
      activeEmit = emit;
      try {
        const value: unknown = await pyodide.runPythonAsync(code);
        return value === undefined || value === null
          ? null
          : { 'text/plain': stringifyResult(value) };
      } finally {
        activeEmit = null;
      }
    },
    interrupt() {
      // Main-thread Pyodide has no cancellation primitive in 0.27.x; Wave 3
      // worker-isolated host will implement SharedArrayBuffer interrupt.
    },
    shutdown() {
      // Single-host adapter has no per-session teardown surface in 0.27.x.
      return Promise.resolve();
    },
  };
}
