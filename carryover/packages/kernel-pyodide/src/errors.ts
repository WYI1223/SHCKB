import { KernelError } from '@skb/kernel-adapter';

/**
 * Pyodide-specific subclass for `micropip.install` / package import failures.
 *
 * Allowed by `@skb/kernel-adapter` CONTRACT.md: "Adapters MAY define their
 * own subclasses (e.g. RemoteAuthError extends KernelError); adding new
 * subclasses is non-breaking." Caller `instanceof KernelError` still catches.
 */
export class KernelImportError extends KernelError {
  readonly kind = 'import' as const;
}
