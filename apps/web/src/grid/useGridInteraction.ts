/**
 * Grid interaction hook — lifted from carryover/_reference/prototype
 * (the validated drag/resize state machine), adapted for the MVP:
 * initial state injected from the server, kind default sizes supplied
 * by the block registry (engine is kind-opaque), insert callback so the
 * notepage host can create block content.
 *
 * Drag model: HTML5 native DnD for cross-element dragging (block move +
 * palette insert). Resize: pointer events on edge handles. Mouse-first;
 * touch is a later responsive pass (notepage-responsive PRD).
 */
import { useEffect, useRef, useState } from 'react';
import {
  type Block,
  type BlockSize,
  type DropIntent,
  type GridState,
  TOTAL_COLS,
  deleteBlock as engineDelete,
  inferDropIntent,
  insertBlock,
  moveBlock,
  transformBlock,
} from '@skb/grid-engine';

export type ResizeAxis = 'right' | 'bottom' | 'corner' | 'left' | 'top' | 'top-left';

const DRAG_MIME = 'application/x-skb-grid-drag';

export type DragPayload =
  | { kind: 'move'; sourceId: string }
  | { kind: 'insert'; blockKind: string };

export type DragState = {
  active: boolean;
  payload: DragPayload | null;
  cursorCell: { col: number; row: number } | null;
  intent: DropIntent | null;
};

export type ResizeState = {
  active: boolean;
  blockId: string | null;
  axis: ResizeAxis | null;
  previewCol: number;
  previewRow: number;
  previewW: number;
  previewH: number;
};

export type GridOps = {
  move: (id: string, col: number, row: number) => void;
  transform: (
    id: string,
    changes: { col?: number; row?: number; colSpan?: number; rowSpan?: number },
  ) => void;
  remove: (id: string) => void;
};

export type Interaction = {
  state: GridState;
  ops: GridOps;
  drag: DragState;
  resize: ResizeState;
  gravityEnabled: boolean;
  setGravityEnabled: (v: boolean) => void;
  blockDragProps: (block: Block) => {
    draggable: boolean;
    onDragStart: (e: React.DragEvent) => void;
    onDragEnd: () => void;
  };
  paletteDragProps: (kind: string) => {
    draggable: boolean;
    onDragStart: (e: React.DragEvent) => void;
    onDragEnd: () => void;
  };
  canvasDropProps: (slotSize: number) => {
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: () => void;
    onDrop: (e: React.DragEvent) => void;
  };
  beginResize: (e: React.PointerEvent, block: Block, axis: ResizeAxis, slotSize: number) => void;
};

export type GridInteractionConfig = {
  initialBlocks: Block[];
  initialGravity: boolean;
  defaultSizeFor: (kind: string) => BlockSize;
  /** Notepage host hook: create content for a block born via palette drop. */
  onBlockInserted: (block: Block) => void;
};

let insertSeq = 0;
function newBlockId(): string {
  insertSeq += 1;
  return `b_${Date.now().toString(36)}_${insertSeq}`;
}

export function useGridInteraction(config: GridInteractionConfig): Interaction {
  const [state, setState] = useState<GridState>(() => ({
    blocks: config.initialBlocks,
    totalCols: TOTAL_COLS,
  }));
  const [drag, setDrag] = useState<DragState>({
    active: false,
    payload: null,
    cursorCell: null,
    intent: null,
  });
  const [resize, setResize] = useState<ResizeState>({
    active: false,
    blockId: null,
    axis: null,
    previewCol: 0,
    previewRow: 0,
    previewW: 0,
    previewH: 0,
  });
  const [gravityEnabled, setGravityEnabled] = useState(config.initialGravity);

  const stateRef = useRef(state);
  const dragRef = useRef(drag);
  const gravityRef = useRef(gravityEnabled);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    dragRef.current = drag;
  }, [drag]);
  useEffect(() => {
    gravityRef.current = gravityEnabled;
  }, [gravityEnabled]);

  const opts = (): { gravity: boolean } => ({ gravity: gravityRef.current });

  function insertAt(col: number, row: number, kind: string): void {
    const intent = inferDropIntent(stateRef.current, col, row, config.defaultSizeFor(kind));
    if (intent.intent !== 'place') return;
    const block: Block = {
      id: newBlockId(),
      col: intent.col,
      row: intent.row,
      colSpan: intent.colSpan,
      rowSpan: intent.rowSpan,
      kind,
    };
    const r = insertBlock(stateRef.current, block, opts());
    if (r.ok) {
      setState(r.state);
      config.onBlockInserted(block);
    }
  }

  function move(id: string, col: number, row: number): void {
    const r = moveBlock(stateRef.current, id, col, row, opts());
    if (r.ok) setState(r.state);
  }

  function transform(
    id: string,
    changes: { col?: number; row?: number; colSpan?: number; rowSpan?: number },
  ): void {
    const r = transformBlock(stateRef.current, id, changes, opts());
    if (r.ok) setState(r.state);
  }

  function remove(id: string): void {
    setState(engineDelete(stateRef.current, id, opts()));
  }

  const ops: GridOps = { move, transform, remove };

  function blockDragProps(block: Block) {
    return {
      draggable: true,
      onDragStart: (e: React.DragEvent) => {
        const payload: DragPayload = { kind: 'move', sourceId: block.id };
        e.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload));
        e.dataTransfer.effectAllowed = 'move';
        setDrag({ active: true, payload, cursorCell: null, intent: null });
      },
      onDragEnd: () => {
        setDrag({ active: false, payload: null, cursorCell: null, intent: null });
      },
    };
  }

  function paletteDragProps(kind: string) {
    return {
      draggable: true,
      onDragStart: (e: React.DragEvent) => {
        const payload: DragPayload = { kind: 'insert', blockKind: kind };
        e.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload));
        e.dataTransfer.effectAllowed = 'copy';
        setDrag({ active: true, payload, cursorCell: null, intent: null });
      },
      onDragEnd: () => {
        setDrag({ active: false, payload: null, cursorCell: null, intent: null });
      },
    };
  }

  function canvasDropProps(slotSize: number) {
    return {
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault();
        const payload = dragRef.current.payload;
        if (!payload) return;
        e.dataTransfer.dropEffect = payload.kind === 'insert' ? 'copy' : 'move';
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const col = Math.floor((e.clientX - rect.left) / slotSize);
        const row = Math.floor((e.clientY - rect.top) / slotSize);
        let intent: DropIntent;
        if (payload.kind === 'move') {
          const sourceBlock = stateRef.current.blocks.find((b) => b.id === payload.sourceId);
          if (!sourceBlock) return;
          // Probe the target area without the source block at its current pos.
          const withoutSource: GridState = {
            ...stateRef.current,
            blocks: stateRef.current.blocks.filter((b) => b.id !== sourceBlock.id),
          };
          const probeIntent = inferDropIntent(withoutSource, col, row, {
            colSpan: sourceBlock.colSpan,
            rowSpan: sourceBlock.rowSpan,
          });
          // Move preserves size regardless of hole-fill clamp.
          intent = { ...probeIntent, colSpan: sourceBlock.colSpan, rowSpan: sourceBlock.rowSpan };
        } else {
          intent = inferDropIntent(stateRef.current, col, row, config.defaultSizeFor(payload.blockKind));
        }
        setDrag((d) => ({ ...d, cursorCell: { col, row }, intent }));
      },
      onDragLeave: () => {
        setDrag((d) => ({ ...d, cursorCell: null, intent: null }));
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        const raw = e.dataTransfer.getData(DRAG_MIME);
        if (!raw) return;
        const payload = JSON.parse(raw) as DragPayload;
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const col = Math.floor((e.clientX - rect.left) / slotSize);
        const row = Math.floor((e.clientY - rect.top) / slotSize);
        if (payload.kind === 'move') {
          move(payload.sourceId, col, row);
        } else {
          insertAt(col, row, payload.blockKind);
        }
        setDrag({ active: false, payload: null, cursorCell: null, intent: null });
      },
    };
  }

  function beginResize(
    e: React.PointerEvent,
    block: Block,
    axis: ResizeAxis,
    slotSize: number,
  ): void {
    e.stopPropagation();
    e.preventDefault();
    const blockEl = (e.currentTarget as HTMLElement).closest('[data-block-id]');
    if (!(blockEl instanceof HTMLElement)) return;
    const rect = blockEl.getBoundingClientRect();
    setResize({
      active: true,
      blockId: block.id,
      axis,
      previewCol: block.col,
      previewRow: block.row,
      previewW: block.colSpan,
      previewH: block.rowSpan,
    });

    const onMove = (ev: PointerEvent) => {
      let previewCol = block.col;
      let previewRow = block.row;
      let previewW = block.colSpan;
      let previewH = block.rowSpan;

      if (axis === 'right' || axis === 'corner') {
        previewW = Math.max(
          1,
          Math.min(TOTAL_COLS - block.col, Math.round((ev.clientX - rect.left) / slotSize)),
        );
      } else if (axis === 'left' || axis === 'top-left') {
        const newColRaw = Math.round((ev.clientX - rect.left + block.col * slotSize) / slotSize);
        const newCol = Math.max(0, Math.min(block.col + block.colSpan - 1, newColRaw));
        previewCol = newCol;
        previewW = block.col + block.colSpan - newCol;
      }
      if (axis === 'bottom' || axis === 'corner') {
        previewH = Math.max(1, Math.round((ev.clientY - rect.top) / slotSize));
      } else if (axis === 'top' || axis === 'top-left') {
        const newRowRaw = Math.round((ev.clientY - rect.top + block.row * slotSize) / slotSize);
        const newRow = Math.max(0, Math.min(block.row + block.rowSpan - 1, newRowRaw));
        previewRow = newRow;
        previewH = block.row + block.rowSpan - newRow;
      }

      setResize((r) => ({ ...r, previewCol, previewRow, previewW, previewH }));
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setResize((r) => {
        if (r.blockId !== null) {
          transform(r.blockId, {
            col: r.previewCol,
            row: r.previewRow,
            colSpan: r.previewW,
            rowSpan: r.previewH,
          });
        }
        return {
          active: false,
          blockId: null,
          axis: null,
          previewCol: 0,
          previewRow: 0,
          previewW: 0,
          previewH: 0,
        };
      });
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  return {
    state,
    ops,
    drag,
    resize,
    gravityEnabled,
    setGravityEnabled,
    blockDragProps,
    paletteDragProps,
    canvasDropProps,
    beginResize,
  };
}
