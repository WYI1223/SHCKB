/**
 * Typed error hierarchy for KernelAdapter implementations.
 *
 * All adapter-thrown errors should extend `KernelError`, so callers can
 * `catch (e) { if (e instanceof KernelError) ... }` without depending on
 * adapter-specific subclasses (PyodideAdapter, RemoteKernelAdapter, ...).
 *
 * Adapters MAY define their own subclasses (e.g. `RemoteAuthError extends
 * KernelError`); adding new subclasses is non-breaking. Renaming or removing
 * any class below is a contract break and requires an ADR.
 */

export abstract class KernelError extends Error {
  abstract readonly kind: string;
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class KernelStartupError extends KernelError {
  readonly kind = 'startup' as const;
}

export class KernelShutdownError extends KernelError {
  readonly kind = 'shutdown' as const;
}

export class KernelInterruptError extends KernelError {
  readonly kind = 'interrupt' as const;
}

export class KernelTimeoutError extends KernelError {
  readonly kind = 'timeout' as const;
}
