import type { KernelAdapter, KernelCapabilities, KernelSession } from '@skb/kernel-adapter';
import { KernelError, KernelStartupError } from '@skb/kernel-adapter';
import { createDefaultHostFactory, DEFAULT_LIBS, type PyodideBootOptions } from './boot';
import type { PyodideHostFactory } from './host';
import { PyodideSession } from './session';

/**
 * Library list exposed via `capabilities.libraries`. Aliased to
 * `DEFAULT_LIBS` (boot.ts) to make adapter ↔ boot drift structurally
 * impossible — `capabilities.libraries` and the runtime `loadPackage`
 * call site share a single authority (ADR-0006 item #5).
 */
export const PYODIDE_LIBRARIES = DEFAULT_LIBS;

export interface PyodideAdapterOptions {
  /** Override factory used by `startSession`. Pass a mock for tests. */
  hostFactory?: PyodideHostFactory;
  /** Forwarded to the default factory when `hostFactory` is not provided. */
  boot?: PyodideBootOptions;
}

export class PyodideAdapter implements KernelAdapter {
  readonly id = 'pyodide';
  readonly capabilities: KernelCapabilities = {
    libraries: PYODIDE_LIBRARIES,
    gpu: false,
    persistentState: true,
  };

  #factory: PyodideHostFactory;

  constructor(options: PyodideAdapterOptions = {}) {
    this.#factory = options.hostFactory ?? createDefaultHostFactory(options.boot);
  }

  async startSession(sessionId: string): Promise<KernelSession> {
    void sessionId;
    let host;
    try {
      host = await this.#factory.create();
    } catch (cause) {
      if (cause instanceof KernelError) throw cause;
      throw new KernelStartupError('PyodideAdapter.startSession failed', { cause });
    }
    return new PyodideSession(host);
  }
}
