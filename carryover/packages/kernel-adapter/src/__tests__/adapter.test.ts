import { describe, it, expectTypeOf } from 'vitest';
import type { KernelAdapter, KernelEvent, KernelSession } from '../index';

describe('KernelAdapter type contract', () => {
  it('KernelEvent locks the full 6-variant discriminated union shape (any field add/remove/rename fails)', () => {
    expectTypeOf<KernelEvent>().toEqualTypeOf<
      | { type: 'stdout'; text: string }
      | { type: 'stderr'; text: string }
      | { type: 'display_data'; data: Record<string, unknown> }
      | { type: 'execute_result'; data: Record<string, unknown> }
      | { type: 'error'; ename: string; evalue: string; traceback: string[] }
      | { type: 'status'; state: 'idle' | 'busy' }
    >();
  });

  it('KernelSession.execute takes a code string and returns AsyncIterable<KernelEvent>', () => {
    expectTypeOf<KernelSession['execute']>().parameter(0).toBeString();
    expectTypeOf<KernelSession['execute']>()
      .returns.toExtend<AsyncIterable<KernelEvent>>();
  });

  it('KernelSession.interrupt and .shutdown return Promise<void>', () => {
    expectTypeOf<KernelSession['interrupt']>().returns.resolves.toBeVoid();
    expectTypeOf<KernelSession['shutdown']>().returns.resolves.toBeVoid();
  });

  it('KernelAdapter.startSession returns Promise<KernelSession>', () => {
    expectTypeOf<KernelAdapter['startSession']>().parameter(0).toBeString();
    expectTypeOf<KernelAdapter['startSession']>()
      .returns.resolves.toExtend<KernelSession>();
  });

  it('KernelAdapter exposes readonly id + capabilities', () => {
    expectTypeOf<KernelAdapter['id']>().toBeString();
    expectTypeOf<KernelAdapter['capabilities']>().toExtend<{
      readonly libraries: readonly string[];
      readonly gpu: boolean;
      readonly persistentState: boolean;
    }>();
  });
});
