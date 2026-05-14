import { describe, it, expect } from 'vitest';
import type { KernelEvent } from '@skb/kernel-adapter';
import { PyodideSession } from '../session';
import type { PyodideHost } from '../host';

/**
 * mock-based matplotlib smoke test (per plan-challenger NICE 8 revision):
 * verifies the `display_data` KernelEvent schema shape. Real Pyodide CDN
 * boot is intentionally NOT exercised here — that lives in the Wave 4
 * Playwright e2e layer to keep CI deterministic.
 */

const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

function mockMatplotlibHost(): PyodideHost {
  return {
    runCode: (_code, emit) => {
      emit({
        type: 'display_data',
        data: {
          'image/png': PNG_BASE64,
          'text/plain': '<Figure size 640x480 with 1 Axes>',
        },
      });
      return Promise.resolve(null);
    },
    interrupt: () => {},
    shutdown: () => Promise.resolve(),
  };
}

describe('matplotlib display_data event schema (mocked Pyodide)', () => {
  it('emits display_data event with image/png mime + base64 string when figure renders', async () => {
    const session = new PyodideSession(mockMatplotlibHost());
    const events: KernelEvent[] = [];
    for await (const e of session.execute('plt.plot([1,2,3]); plt.show()')) {
      events.push(e);
    }
    const display = events.find((e) => e.type === 'display_data');
    expect(display).toBeDefined();
    if (display?.type !== 'display_data') throw new Error('expected display_data');
    const png = display.data['image/png'];
    const txt = display.data['text/plain'];
    expect(typeof png).toBe('string');
    expect(typeof txt).toBe('string');
    expect((png as string).length).toBeGreaterThan(0);
    // PNG magic bytes 89 50 4e 47 = "\x89PNG" → base64 prefix "iVBORw0KGgo".
    // F R2 CONCERN C2: stricter than length>0 — locks the actual format.
    expect(png as string).toMatch(/^iVBORw0KGgo/);
    expect(display.data['text/plain']).toMatch(/^<Figure /);
  });

  it('display_data data has exactly the expected mime keys (image/png + text/plain)', () => {
    // F R2 CONCERN C2: lock the strict expected key set so a future fixture
    // swap that drops image/png (the load-bearing payload for matplotlib)
    // would fail loud, not silently degrade.
    const session = new PyodideSession(mockMatplotlibHost());
    return (async () => {
      for await (const e of session.execute('plt.show()')) {
        if (e.type === 'display_data') {
          expect(Object.keys(e.data).sort()).toEqual(['image/png', 'text/plain']);
          return;
        }
      }
      throw new Error('no display_data event emitted');
    })();
  });

  it('display_data event sits between status:busy and status:idle bookends', async () => {
    const session = new PyodideSession(mockMatplotlibHost());
    const events: KernelEvent[] = [];
    for await (const e of session.execute('plt.show()')) events.push(e);
    expect(events[0]).toEqual({ type: 'status', state: 'busy' });
    expect(events.at(-1)).toEqual({ type: 'status', state: 'idle' });
    const displayIdx = events.findIndex((e) => e.type === 'display_data');
    expect(displayIdx).toBeGreaterThan(0);
    expect(displayIdx).toBeLessThan(events.length - 1);
  });

  it('display_data.data is Record<string, unknown> (mime → payload map shape)', async () => {
    const session = new PyodideSession(mockMatplotlibHost());
    for await (const e of session.execute('plt.show()')) {
      if (e.type === 'display_data') {
        expect(typeof e.data).toBe('object');
        expect(e.data).not.toBeNull();
        expect(Array.isArray(e.data)).toBe(false);
        for (const key of Object.keys(e.data)) {
          expect(key).toMatch(/^[a-z]+\/[a-z0-9.+-]+$/);
        }
      }
    }
  });
});
