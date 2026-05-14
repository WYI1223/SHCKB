import { describe, it, expect } from 'vitest';
import {
  KernelError,
  KernelStartupError,
  KernelShutdownError,
  KernelInterruptError,
  KernelTimeoutError,
} from '../errors';

describe('KernelError hierarchy', () => {
  it('all subclasses are instanceof KernelError and Error', () => {
    const subclasses = [
      new KernelStartupError('boom'),
      new KernelShutdownError('boom'),
      new KernelInterruptError('boom'),
      new KernelTimeoutError('boom'),
    ];
    for (const e of subclasses) {
      expect(e).toBeInstanceOf(KernelError);
      expect(e).toBeInstanceOf(Error);
    }
  });

  it('kind is a stable literal per subclass', () => {
    expect(new KernelStartupError('x').kind).toBe('startup');
    expect(new KernelShutdownError('x').kind).toBe('shutdown');
    expect(new KernelInterruptError('x').kind).toBe('interrupt');
    expect(new KernelTimeoutError('x').kind).toBe('timeout');
  });

  it('name reflects subclass for stack-trace readability', () => {
    expect(new KernelStartupError('x').name).toBe('KernelStartupError');
    expect(new KernelTimeoutError('x').name).toBe('KernelTimeoutError');
  });

  it('preserves cause when provided', () => {
    const root = new Error('root');
    const wrapped = new KernelStartupError('startup failed', { cause: root });
    expect(wrapped.cause).toBe(root);
  });

  it('subclasses are constructable (runtime sanity)', () => {
    expect(() => new KernelStartupError('ok')).not.toThrow();
    expect(() => new KernelShutdownError('ok')).not.toThrow();
    expect(() => new KernelInterruptError('ok')).not.toThrow();
    expect(() => new KernelTimeoutError('ok')).not.toThrow();
  });

  it('KernelError abstract enforcement (TS-level)', () => {
    // Direct instantiation of an abstract class must be a TS compile error.
    // `tsc -b` in the typecheck script verifies this `@ts-expect-error`
    // fires; if KernelError were ever made non-abstract, tsc would report
    // "Unused '@ts-expect-error' directive" and the typecheck gate breaks.
    // @ts-expect-error - KernelError is abstract; direct instantiation must fail
    void new KernelError('foo');
  });
});
