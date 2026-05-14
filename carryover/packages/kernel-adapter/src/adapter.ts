export type KernelEvent =
  | { type: 'stdout'; text: string }
  | { type: 'stderr'; text: string }
  | { type: 'display_data'; data: Record<string, unknown> }
  | { type: 'execute_result'; data: Record<string, unknown> }
  | { type: 'error'; ename: string; evalue: string; traceback: string[] }
  | { type: 'status'; state: 'idle' | 'busy' };

export interface KernelCapabilities {
  readonly libraries: readonly string[];
  readonly gpu: boolean;
  readonly persistentState: boolean;
  readonly maxMemoryMB?: number;
}

export interface KernelSession {
  execute(code: string): AsyncIterable<KernelEvent>;
  interrupt(): Promise<void>;
  shutdown(): Promise<void>;
}

export interface KernelAdapter {
  readonly id: string;
  readonly capabilities: KernelCapabilities;
  startSession(sessionId: string): Promise<KernelSession>;
}
