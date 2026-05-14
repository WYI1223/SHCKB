import { describe, it, expect } from 'vitest';
import type { KernelEvent } from '@skb/kernel-adapter';
import { KernelInterruptError, KernelShutdownError } from '@skb/kernel-adapter';
import { PyodideSession } from '../session';
import type { PyodideHost } from '../host';

function makeHost(
  runCode: PyodideHost['runCode'],
  hooks: Partial<PyodideHost> = {},
): PyodideHost {
  return {
    runCode,
    interrupt: hooks.interrupt ?? (() => {}),
    shutdown: hooks.shutdown ?? (() => Promise.resolve()),
  };
}

async function collect(iter: AsyncIterable<KernelEvent>): Promise<KernelEvent[]> {
  const out: KernelEvent[] = [];
  for await (const e of iter) out.push(e);
  return out;
}

describe('PyodideSession.execute event stream', () => {
  it('emits status:busy → execute_result → status:idle for value-producing code', async () => {
    const host = makeHost(() => Promise.resolve({ 'text/plain': '2' }));
    const session = new PyodideSession(host);
    const events = await collect(session.execute('1+1'));
    expect(events).toEqual([
      { type: 'status', state: 'busy' },
      { type: 'execute_result', data: { 'text/plain': '2' } },
      { type: 'status', state: 'idle' },
    ]);
  });

  it('emits status:busy → status:idle for void code (no execute_result)', async () => {
    const host = makeHost(() => Promise.resolve(null));
    const session = new PyodideSession(host);
    const events = await collect(session.execute('x = 1'));
    expect(events).toEqual([
      { type: 'status', state: 'busy' },
      { type: 'status', state: 'idle' },
    ]);
  });

  it('passes stdout / stderr emitted by host through in arrival order', async () => {
    const host = makeHost((_code, emit) => {
      emit({ type: 'stdout', text: 'hello\n' });
      emit({ type: 'stderr', text: 'warn\n' });
      emit({ type: 'stdout', text: 'world\n' });
      return Promise.resolve(null);
    });
    const session = new PyodideSession(host);
    const events = await collect(session.execute('print("hi")'));
    expect(events).toEqual([
      { type: 'status', state: 'busy' },
      { type: 'stdout', text: 'hello\n' },
      { type: 'stderr', text: 'warn\n' },
      { type: 'stdout', text: 'world\n' },
      { type: 'status', state: 'idle' },
    ]);
  });

  it('converts host-thrown Python error into a single error KernelEvent then status:idle', async () => {
    const boom = new Error('NameError: name "x" is not defined');
    boom.name = 'PythonError';
    const host = makeHost(() => Promise.reject(boom));
    const session = new PyodideSession(host);
    const events = await collect(session.execute('x'));
    expect(events[0]).toEqual({ type: 'status', state: 'busy' });
    const errEvent = events[1];
    expect(errEvent?.type).toBe('error');
    if (errEvent?.type !== 'error') throw new Error('expected error event');
    expect(errEvent.ename).toBe('PythonError');
    expect(errEvent.evalue).toBe('NameError: name "x" is not defined');
    expect(Array.isArray(errEvent.traceback)).toBe(true);
    expect(events.at(-1)).toEqual({ type: 'status', state: 'idle' });
  });

  it('emits error event when host rejects with undefined (sentinel-soundness regression)', async () => {
    // Promise.reject(undefined) is legal JS — using `runError !== undefined`
    // as a presence sentinel would silently drop the error. F R2 BLOCKING B2.
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- intentionally exercising the bad-actor rejection path
    const host = makeHost(() => Promise.reject(undefined));
    const session = new PyodideSession(host);
    const events = await collect(session.execute('boom'));
    expect(events[0]).toEqual({ type: 'status', state: 'busy' });
    const errEvent = events[1];
    expect(errEvent?.type).toBe('error');
    if (errEvent?.type !== 'error') throw new Error('expected error event');
    expect(errEvent.ename).toBe('Error');
    expect(errEvent.evalue).toBe('undefined');
    expect(errEvent.traceback).toEqual(['undefined']);
    expect(events.at(-1)).toEqual({ type: 'status', state: 'idle' });
  });

  it('interrupt() delegates to host.interrupt()', async () => {
    let called = 0;
    const host = makeHost(
      () => Promise.resolve(null),
      { interrupt: () => void called++ },
    );
    const session = new PyodideSession(host);
    await session.interrupt();
    expect(called).toBe(1);
  });

  it('shutdown() delegates to host.shutdown() and blocks subsequent execute()', async () => {
    let shutdownCalled = 0;
    const host = makeHost(() => Promise.resolve(null), {
      shutdown: () => {
        shutdownCalled++;
        return Promise.resolve();
      },
    });
    const session = new PyodideSession(host);
    await session.shutdown();
    expect(shutdownCalled).toBe(1);
    expect(() => session.execute('x')).toThrow(KernelShutdownError);
  });

  it('shutdown() called twice throws KernelShutdownError', async () => {
    const session = new PyodideSession(makeHost(() => Promise.resolve(null)));
    await session.shutdown();
    await expect(session.shutdown()).rejects.toBeInstanceOf(KernelShutdownError);
  });

  it('interrupt() on shutdown session throws KernelInterruptError', async () => {
    const session = new PyodideSession(makeHost(() => Promise.resolve(null)));
    await session.shutdown();
    await expect(session.interrupt()).rejects.toBeInstanceOf(KernelInterruptError);
  });

  it('wraps host interrupt failure as KernelInterruptError (F R2 BLOCKING B3)', async () => {
    const host = makeHost(() => Promise.resolve(null), {
      interrupt: () => {
        throw new Error('host interrupt failed');
      },
    });
    const session = new PyodideSession(host);
    await expect(session.interrupt()).rejects.toBeInstanceOf(KernelInterruptError);
  });

  it('wraps host shutdown failure as KernelShutdownError (F R2 BLOCKING B3)', async () => {
    const host = makeHost(() => Promise.resolve(null), {
      shutdown: () => Promise.reject(new Error('host shutdown failed')),
    });
    const session = new PyodideSession(host);
    await expect(session.shutdown()).rejects.toBeInstanceOf(KernelShutdownError);
  });

  it('preserves KernelError subclass thrown by host.interrupt() (B3 cause-preservation)', async () => {
    const customBoom = new KernelInterruptError('custom interrupt boom');
    const host = makeHost(() => Promise.resolve(null), {
      interrupt: () => {
        throw customBoom;
      },
    });
    const session = new PyodideSession(host);
    await expect(session.interrupt()).rejects.toBe(customBoom);
  });

  it('preserves KernelError subclass thrown by host.shutdown() (B3 cause-preservation)', async () => {
    const customBoom = new KernelShutdownError('custom shutdown boom');
    const host = makeHost(() => Promise.resolve(null), {
      shutdown: () => Promise.reject(customBoom),
    });
    const session = new PyodideSession(host);
    await expect(session.shutdown()).rejects.toBe(customBoom);
  });
});
