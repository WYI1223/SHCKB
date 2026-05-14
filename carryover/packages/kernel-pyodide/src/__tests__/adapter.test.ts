import { describe, it, expect, expectTypeOf } from 'vitest';
import type { KernelAdapter, KernelEvent, KernelSession } from '@skb/kernel-adapter';
import { KernelStartupError } from '@skb/kernel-adapter';
import { PyodideAdapter, PYODIDE_LIBRARIES } from '../adapter';
import { DEFAULT_LIBS } from '../boot';
import { KernelImportError } from '../errors';
import type { PyodideHost, PyodideHostFactory } from '../host';

const stubHost: PyodideHost = {
  runCode: () => Promise.resolve(null),
  interrupt: () => {},
  shutdown: () => Promise.resolve(),
};

const stubFactory: PyodideHostFactory = {
  create: () => Promise.resolve(stubHost),
};

describe('PyodideAdapter contract', () => {
  it('satisfies KernelAdapter interface (TS-level)', () => {
    expectTypeOf<PyodideAdapter>().toExtend<KernelAdapter>();
  });

  it('startSession resolves to KernelSession', async () => {
    const adapter = new PyodideAdapter({ hostFactory: stubFactory });
    const session = await adapter.startSession('s1');
    expectTypeOf(session).toExtend<KernelSession>();
    expect(typeof session.execute).toBe('function');
    expect(typeof session.interrupt).toBe('function');
    expect(typeof session.shutdown).toBe('function');
  });

  it('exposes id="pyodide" + capabilities including numpy/pandas/matplotlib + gpu=false + persistentState=true', () => {
    const adapter = new PyodideAdapter({ hostFactory: stubFactory });
    expect(adapter.id).toBe('pyodide');
    expect(adapter.capabilities.libraries).toEqual(['numpy', 'pandas', 'matplotlib']);
    expect(adapter.capabilities.gpu).toBe(false);
    expect(adapter.capabilities.persistentState).toBe(true);
  });

  it('execute() returns AsyncIterable<KernelEvent>', async () => {
    const adapter = new PyodideAdapter({ hostFactory: stubFactory });
    const session = await adapter.startSession('s1');
    const iter = session.execute('1 + 1');
    expectTypeOf(iter).toExtend<AsyncIterable<KernelEvent>>();
    const events: KernelEvent[] = [];
    for await (const e of iter) events.push(e);
    expect(events.length).toBeGreaterThan(0);
  });

  it('preserves KernelImportError thrown by factory (does not wrap as KernelStartupError)', async () => {
    // F R2 BLOCKING B1: boot.ts distinguishes Pyodide-binary failure
    // (KernelStartupError) from library-install failure (KernelImportError).
    // PyodideAdapter must preserve any KernelError subclass so consumers
    // (block-jupyter Wave 3) can branch retry logic on the typed throw.
    const importBoom = new KernelImportError('numpy install failed');
    const failingFactory: PyodideHostFactory = {
      create: () => Promise.reject(importBoom),
    };
    const adapter = new PyodideAdapter({ hostFactory: failingFactory });
    await expect(adapter.startSession('s1')).rejects.toBe(importBoom);
  });

  it('preserves KernelStartupError thrown by factory (does not double-wrap)', async () => {
    const startupBoom = new KernelStartupError('Pyodide load failed');
    const failingFactory: PyodideHostFactory = {
      create: () => Promise.reject(startupBoom),
    };
    const adapter = new PyodideAdapter({ hostFactory: failingFactory });
    await expect(adapter.startSession('s1')).rejects.toBe(startupBoom);
  });

  it('PYODIDE_LIBRARIES is alias of DEFAULT_LIBS (cross-file regression — ADR-0006 item #5)', () => {
    // F R2 BLOCKING B4: capabilities.libraries (adapter.ts) and the
    // runtime loadPackage list (boot.ts) MUST stay byte-equivalent.
    // Currently enforced structurally by aliasing (PYODIDE_LIBRARIES
    // = DEFAULT_LIBS); this test catches any future regression that
    // re-introduces a parallel literal.
    expect(PYODIDE_LIBRARIES).toBe(DEFAULT_LIBS);
    expect([...PYODIDE_LIBRARIES]).toEqual(['numpy', 'pandas', 'matplotlib']);
  });

  it('wraps non-KernelError causes as KernelStartupError', async () => {
    const genericBoom = new Error('network down');
    const failingFactory: PyodideHostFactory = {
      create: () => Promise.reject(genericBoom),
    };
    const adapter = new PyodideAdapter({ hostFactory: failingFactory });
    await expect(adapter.startSession('s1')).rejects.toBeInstanceOf(KernelStartupError);
  });
});
