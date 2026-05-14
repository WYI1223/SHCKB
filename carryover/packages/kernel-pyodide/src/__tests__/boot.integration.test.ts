import { describe, it, expect } from 'vitest';
import { PyodideAdapter } from '../adapter';
import type { KernelEvent } from '@skb/kernel-adapter';

/**
 * Q14 absorbtion (per Wave 4 C-1 plan-challenger): real-Pyodide boot smoke.
 * CI-skipped (the env-flag inversion of matplotlib.test.ts). Locally invoked:
 *   LOCAL_RUN_PYODIDE_INTEGRATION=1 pnpm --filter @skb/kernel-pyodide test boot.integration
 * Defends against:
 *   (a) indexURL string drift vs Pyodide version range in package.json,
 *   (b) CDN-base resolution breakage for loadPackage default libs.
 */
describe.skipIf(!process.env.LOCAL_RUN_PYODIDE_INTEGRATION)(
  'PyodideAdapter real-CDN boot integration',
  () => {
    it('boots Pyodide from jsdelivr CDN and runs 1+1 → 2', async () => {
      const adapter = new PyodideAdapter({
        boot: {
          indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/',
          libraries: [],
        },
      });
      const session = await adapter.startSession('integration-smoke');
      const events: KernelEvent[] = [];
      for await (const e of session.execute('1 + 1')) {
        events.push(e);
      }
      const result = events.find((e) => e.type === 'execute_result');
      expect(result).toBeDefined();
      if (result?.type !== 'execute_result') throw new Error('expected execute_result event');
      const text = result.data?.['text/plain'];
      expect(text).toBe('2');
      await session.shutdown();
    }, 60_000);
  },
);
