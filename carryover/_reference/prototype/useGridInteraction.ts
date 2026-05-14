/**
 * THROWAWAY — shared interaction hook for the grid-prototype themes.
 *
 * Owns the GridState + drag/resize state. Returns the state, ops, and
 * event handlers each variant needs to wire up its DOM. Variant
 * components stay focused on theme-specific rendering.
 *
 * Drag model: HTML5 native DnD for cross-element dragging (handles
 * both block-to-block move + palette-to-canvas insert). Resize: pointer
 * events on edge handles (more precise control than HTML5 DnD).
 *
 * Per docs/design/grid-redesign-2026-05-11.md.
 */
import { useEffect, useRef, useState } from 'react';
import {
  type Block,
  type BlockKind,
  type DropIntent,
  type GridState,
  deleteBlock as engineDelete,
  inferDropIntent,
  insertBlock,
  moveBlock,
  resizeBlock,
  transformBlock,
} from '@skb/grid-engine';
import { SAMPLE_BLOCKS } from './sample-data';

export type ResizeAxis = 'right' | 'bottom' | 'corner' | 'left' | 'top' | 'top-left';

const DRAG_MIME = 'application/x-skb-grid-prototype-drag';
const TOTAL_COLS = 12;

export type DragPayload =
  | { kind: 'move'; sourceId: string }
  | { kind: 'insert'; blockKind: BlockKind };

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
  /** Preview top-left + size during drag. Lets left/top axes preview position change too. */
  previewCol: number;
  previewRow: number;
  previewW: number;
  previewH: number;
};

export type GridOps = {
  insertAt: (col: number, row: number, kind: BlockKind) => void;
  move: (id: string, col: number, row: number) => void;
  resize: (id: string, colSpan: number, rowSpan: number) => void;
  transform: (
    id: string,
    changes: { col?: number; row?: number; colSpan?: number; rowSpan?: number },
  ) => void;
  remove: (id: string) => void;
  reset: () => void;
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
  paletteDragProps: (kind: BlockKind) => {
    draggable: boolean;
    onDragStart: (e: React.DragEvent) => void;
    onDragEnd: () => void;
  };
  canvasDropProps: (slotSize: number) => {
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: () => void;
    onDrop: (e: React.DragEvent) => void;
  };
  beginResize: (
    e: React.PointerEvent,
    block: Block,
    axis: ResizeAxis,
    slotSize: number,
  ) => void;
};

export function useGridInteraction(): Interaction {
  const [state, setState] = useState<GridState>(() => ({
    blocks: [...SAMPLE_BLOCKS],
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
  const [gravityEnabled, setGravityEnabled] = useState(true);

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

  function insertAt(col: number, row: number, kind: BlockKind): void {
    const intent = inferDropIntent(stateRef.current, col, row, kind);
    if (intent.intent !== 'place') return;
    const id = `b${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
    const r = insertBlock(
      stateRef.current,
      {
        id,
        col: intent.col,
        row: intent.row,
        colSpan: intent.colSpan,
        rowSpan: intent.rowSpan,
        kind,
      },
      opts(),
    );
    if (r.ok) setState(r.state);
  }
  function move(id: string, col: number, row: number): void {
    const r = moveBlock(stateRef.current, id, col, row, opts());
    if (r.ok) setState(r.state);
  }
  function doResize(id: string, colSpan: number, rowSpan: number): void {
    const r = resizeBlock(stateRef.current, id, colSpan, rowSpan, opts());
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
  function reset(): void {
    setState({ blocks: [...SAMPLE_BLOCKS], totalCols: TOTAL_COLS });
  }

  const ops: GridOps = { insertAt, move, resize: doResize, transform, remove, reset };

  function blockDragProps(block: Block) {
    return {
      draggable: true,
      onDragStart: (e: React.DragEvent) => {
        const payload: DragPayload = { kind: 'move', sourceId: block.id };
        e.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload));
        e.dataTransfer.effectAllowed = 'move';
        setDrag({
          active: true,
          payload,
          cursorCell: null,
          intent: null,
        });
      },
      onDragEnd: () => {
        setDrag({ active: false, payload: null, cursorCell: null, intent: null });
      },
    };
  }

  function paletteDragProps(kind: BlockKind) {
    return {
      draggable: true,
      onDragStart: (e: React.DragEvent) => {
        const payload: DragPayload = { kind: 'insert', blockKind: kind };
        e.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload));
        e.dataTransfer.effectAllowed = 'copy';
        setDrag({
          active: true,
          payload,
          cursorCell: null,
          intent: null,
        });
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
          // Move-intent: check the target area without the source block at its current pos
          const withoutSource: GridState = {
            ...stateRef.current,
            blocks: stateRef.current.blocks.filter((b) => b.id !== sourceBlock.id),
          };
          const probeIntent = inferDropIntent(
            withoutSource,
            col,
            row,
            sourceBlock.kind,
          );
          // Override size to source's actual size (move preserves size)
          intent = {
            ...probeIntent,
            colSpan: sourceBlock.colSpan,
            rowSpan: sourceBlock.rowSpan,
          };
          // Refine: if probeIntent rejected, the move is rejected
        } else {
          intent = inferDropIntent(stateRef.current, col, row, payload.blockKind);
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
    // Right edge fixed in screen coords (for left-axis); ditto bottom.
    const rightX = rect.right;
    const bottomY = rect.bottom;
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

      // Width axes: right / corner / top-left → grow from right edge of block toward cursor;
      //             left / top-left → shrink from left edge.
      if (axis === 'right' || axis === 'corner') {
        const w = Math.max(
          1,
          Math.min(
            TOTAL_COLS - block.col,
            Math.round((ev.clientX - rect.left) / slotSize),
          ),
        );
        previewW = w;
      } else if (axis === 'left' || axis === 'top-left') {
        // The right edge stays fixed; new left = pointer (snapped to slot)
        const newColRaw = Math.round((ev.clientX - rect.left + block.col * slotSize) / slotSize);
        // Constrain so newCol ≥ 0 and newCol < block.col + block.colSpan
        const newCol = Math.max(0, Math.min(block.col + block.colSpan - 1, newColRaw));
        previewCol = newCol;
        previewW = block.col + block.colSpan - newCol;
      }
      // Height axes
      if (axis === 'bottom' || axis === 'corner') {
        const h = Math.max(1, Math.round((ev.clientY - rect.top) / slotSize));
        previewH = h;
      } else if (axis === 'top' || axis === 'top-left') {
        const newRowRaw = Math.round((ev.clientY - rect.top + block.row * slotSize) / slotSize);
        const newRow = Math.max(0, Math.min(block.row + block.rowSpan - 1, newRowRaw));
        previewRow = newRow;
        previewH = block.row + block.rowSpan - newRow;
      }
      // Silence unused-var warnings
      void rightX;
      void bottomY;

      setResize((r) => ({
        ...r,
        previewCol,
        previewRow,
        previewW,
        previewH,
      }));
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setResize((r) => {
        if (r.blockId !== null) {
          // Use transformBlock so left/top axes can change col/row + span atomically
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
