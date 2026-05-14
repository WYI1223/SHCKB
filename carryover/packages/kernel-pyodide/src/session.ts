import type { KernelEvent, KernelSession } from '@skb/kernel-adapter';
import {
  KernelError,
  KernelInterruptError,
  KernelShutdownError,
} from '@skb/kernel-adapter';
import type { PyodideHost } from './host';

export class PyodideSession implements KernelSession {
  #host: PyodideHost;
  #shutdown = false;

  constructor(host: PyodideHost) {
    this.#host = host;
  }

  execute(code: string): AsyncIterable<KernelEvent> {
    if (this.#shutdown) {
      throw new KernelShutdownError('execute() called on shutdown session');
    }
    return this.#run(code);
  }

  async interrupt(): Promise<void> {
    if (this.#shutdown) {
      throw new KernelInterruptError('interrupt() called on shutdown session');
    }
    try {
      await this.#host.interrupt();
    } catch (cause) {
      if (cause instanceof KernelError) throw cause;
      throw new KernelInterruptError('PyodideSession.interrupt failed', { cause });
    }
  }

  async shutdown(): Promise<void> {
    if (this.#shutdown) {
      throw new KernelShutdownError('shutdown() called twice');
    }
    this.#shutdown = true;
    try {
      await this.#host.shutdown();
    } catch (cause) {
      if (cause instanceof KernelError) throw cause;
      throw new KernelShutdownError('PyodideSession.shutdown failed', { cause });
    }
  }

  async *#run(code: string): AsyncIterable<KernelEvent> {
    const queue: KernelEvent[] = [];
    let waiter: (() => void) | null = null;
    const emit = (event: KernelEvent): void => {
      queue.push(event);
      waiter?.();
      waiter = null;
    };

    yield { type: 'status', state: 'busy' };

    let runError: unknown;
    let hasRunError = false;
    let result: Record<string, unknown> | null = null;
    const done = this.#host
      .runCode(code, emit)
      .then((value) => {
        result = value;
      })
      .catch((err: unknown) => {
        runError = err;
        hasRunError = true;
      });

    let settled = false;
    void done.finally(() => {
      settled = true;
      waiter?.();
      waiter = null;
    });

    while (true) {
      if (queue.length > 0) {
        yield queue.shift()!;
        continue;
      }
      if (settled) break;
      await new Promise<void>((resolve) => {
        waiter = resolve;
      });
    }

    if (hasRunError) {
      yield toErrorEvent(runError);
    } else if (result !== null) {
      yield { type: 'execute_result', data: result };
    }
    yield { type: 'status', state: 'idle' };
  }
}

function toErrorEvent(err: unknown): KernelEvent {
  if (err instanceof Error) {
    const stack = err.stack ? err.stack.split('\n') : [err.message];
    return { type: 'error', ename: err.name, evalue: err.message, traceback: stack };
  }
  const evalue = stringifyNonError(err);
  return { type: 'error', ename: 'Error', evalue, traceback: [evalue] };
}

function stringifyNonError(err: unknown): string {
  if (err === undefined) return 'undefined';
  if (err === null) return 'null';
  if (typeof err === 'string') return err;
  if (typeof err === 'number' || typeof err === 'boolean' || typeof err === 'bigint') {
    return String(err);
  }
  try {
    return JSON.stringify(err) ?? Object.prototype.toString.call(err);
  } catch {
    return Object.prototype.toString.call(err);
  }
}
