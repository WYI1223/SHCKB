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
  applyGravity,
  deleteBlock as engineDelete,
  inferDropIntent,
  insertBlock,
  moveBlock,
  pushResize,
  transformBlock,
} from '@skb/grid-engine';
import { captureLayoutSnapshot } from './captureLayoutSnapshot';

export type ResizeAxis = 'right' | 'bottom' | 'corner' | 'left' | 'top' | 'top-left';

const DRAG_MIME = 'application/x-skb-grid-drag';

export type DragPayload =
  | {
      kind: 'move';
      sourceId: string;
      /** Pixel offset of the grab point inside the block — converted to
       * cells at dragover/drop so the block lands relative to where the
       * user grabbed it, not with its top-left snapped to the cursor. */
      grabPxX: number;
      grabPxY: number;
    }
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
  /** Content fit at gesture start — clamps the ghost for autofit blocks. */
  currentFit: number;
};

export type GridOps = {
  move: (id: string, col: number, row: number) => void;
  transform: (
    id: string,
    changes: { col?: number; row?: number; colSpan?: number; rowSpan?: number },
  ) => void;
  remove: (id: string) => void;
  /** Pointer-free insert (context menu, M8-D3) — same clamp/reject path
   * as a palette drop at that cell. */
  insertAt: (col: number, row: number, kind: string) => void;
  /** Autofit reconcile (spec §4.4 C5): pushResize(base, id, target) with
   * gravity SUSPENDED — re-derived from the gesture BASE every time. */
  reconcileTo: (base: GridState, id: string, targetRowSpan: number) => void;
  /** COMMIT RULE (PROBE-2 invariant): on gesture commit, if net rowSpan
   * delta != 0 && gravity is ON, run applyGravity ONCE; gravity-off
   * commits the pushed layout as-is. */
  commitGesture: (id: string, baseRowSpan: number) => void;
};

export type Interaction = {
  state: GridState;
  ops: GridOps;
  drag: DragState;
  resize: ResizeState;
  gravityEnabled: boolean;
  setGravityEnabled: (v: boolean) => void;
  /** BLOCK METADATA (web-owned): autofit mode per block id. null/'off' =
   * off; MVP writes/reads only 'grow'. */
  autofit: Record<string, string | null>;
  setAutofit: (id: string, mode: string | null) => void;
  /** Author floor per block id; null = off/legacy. */
  minRowSpan: Record<string, number | null>;
  setMinRowSpan: (id: string, floor: number | null) => void;
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
  beginResize: (
    e: React.PointerEvent,
    block: Block,
    axis: ResizeAxis,
    slotSize: number,
    autofitCtx?: { autofit: boolean; currentFit: number },
  ) => void;
};

export type GridInteractionConfig = {
  initialBlocks: Block[];
  initialGravity: boolean;
  defaultSizeFor: (kind: string) => BlockSize;
  /** Notepage host hook: create content for a block born via palette drop. */
  onBlockInserted: (block: Block) => void;
  /** Seed block metadata from the server detail (web/server-owned). */
  initialAutofit?: Record<string, string | null>;
  initialMinRowSpan?: Record<string, number | null>;
};

let insertSeq = 0;
function newBlockId(): string {
  insertSeq += 1;
  return `b_${Date.now().toString(36)}_${insertSeq}`;
}

/**
 * Anchor for a move: cursor cell minus the grab offset, clamped into
 * bounds. Preview (dragover) and drop MUST share this — what the ghost
 * shows is what lands (preview honesty). Pure and exported for tests
 * (T4, mvp7 review).
 */
/**
 * Floor-resize ghost honesty (spec §7): a vertical drag on an autofit
 * block sets the FLOOR, but the block never falls below its current
 * content fit — so the preview clamps to max(currentFit, draggedH).
 * Shared by the ghost and the commit. Pure, exported for tests.
 */
export function clampFloorPreview(draggedH: number, currentFit: number): number {
  return Math.max(1, currentFit, draggedH);
}

export function moveAnchor(
  point: { clientX: number; clientY: number },
  canvasRect: { left: number; top: number },
  slotSize: number,
  grab: { grabPxX: number; grabPxY: number },
  block: { colSpan: number },
): { col: number; row: number } {
  const col = Math.round((point.clientX - canvasRect.left - grab.grabPxX) / slotSize);
  const row = Math.round((point.clientY - canvasRect.top - grab.grabPxY) / slotSize);
  return {
    col: Math.max(0, Math.min(TOTAL_COLS - block.colSpan, col)),
    row: Math.max(0, row),
  };
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
    currentFit: 0,
  });
  const [gravityEnabled, setGravityEnabled] = useState(config.initialGravity);
  const [autofit, setAutofitState] = useState<Record<string, string | null>>(
    () => config.initialAutofit ?? {},
  );
  const [minRowSpan, setMinRowSpanState] = useState<Record<string, number | null>>(
    () => config.initialMinRowSpan ?? {},
  );
  const setAutofit = (id: string, mode: string | null) =>
    setAutofitState((m) => ({ ...m, [id]: mode }));
  const setMinRowSpan = (id: string, floor: number | null) =>
    setMinRowSpanState((m) => ({ ...m, [id]: floor }));

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

  function reconcileTo(base: GridState, id: string, targetRowSpan: number): void {
    // C5: ALWAYS re-derive from the immutable gesture base (no journal,
    // no clamp). pushResize never calls gravity — gravity stays suspended
    // within the edit gesture (spec §4.4 atomicity).
    const r = pushResize(base, id, targetRowSpan);
    if (r.ok) setState(r.state);
  }

  function commitGesture(id: string, baseRowSpan: number): void {
    setState((s) => {
      const block = s.blocks.find((b) => b.id === id);
      const netDelta = block ? block.rowSpan - baseRowSpan : 0;
      // COMMIT RULE / PROBE-2: only compact when the block truly changed
      // height AND the page runs gravity. gravity-off commits as-is.
      if (netDelta !== 0 && gravityRef.current) return applyGravity(s).state;
      return s;
    });
  }

  const ops: GridOps = { move, transform, remove, insertAt, reconcileTo, commitGesture };

  function blockDragProps(block: Block) {
    return {
      draggable: true,
      onDragStart: (e: React.DragEvent) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const payload: DragPayload = {
          kind: 'move',
          sourceId: block.id,
          grabPxX: e.clientX - rect.left,
          grabPxY: e.clientY - rect.top,
        };
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
          // Probe the REAL op (pure function): the ghost shows exactly
          // where the block ends up, gravity settling included.
          const anchor = moveAnchor(e, rect, slotSize, payload, sourceBlock);
          const probe = moveBlock(stateRef.current, sourceBlock.id, anchor.col, anchor.row, opts());
          if (probe.ok) {
            const landed = probe.state.blocks.find((b) => b.id === sourceBlock.id)!;
            intent = {
              intent: 'place',
              col: landed.col,
              row: landed.row,
              colSpan: landed.colSpan,
              rowSpan: landed.rowSpan,
            };
          } else {
            intent = {
              intent: 'reject',
              col: anchor.col,
              row: anchor.row,
              colSpan: sourceBlock.colSpan,
              rowSpan: sourceBlock.rowSpan,
              reason: probe.error,
            };
          }
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
        if (payload.kind === 'move') {
          const sourceBlock = stateRef.current.blocks.find((b) => b.id === payload.sourceId);
          if (sourceBlock) {
            // Same anchor math as the dragover preview — what the ghost
            // showed is what lands.
            const anchor = moveAnchor(e, rect, slotSize, payload, sourceBlock);
            move(payload.sourceId, anchor.col, anchor.row);
          }
        } else {
          const col = Math.floor((e.clientX - rect.left) / slotSize);
          const row = Math.floor((e.clientY - rect.top) / slotSize);
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
    autofitCtx?: { autofit: boolean; currentFit: number },
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
      currentFit: autofitCtx?.currentFit ?? 0,
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
        if (autofitCtx?.autofit) {
          previewH = clampFloorPreview(previewH, autofitCtx.currentFit);
        }
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
      // TODO(autofit): move commit setters out of the resize updater (StrictMode-safety)
      setResize((r) => {
        if (r.blockId !== null) {
          const verticalOnly = r.axis === 'bottom' || r.axis === 'top';
          if (autofitCtx?.autofit && verticalOnly) {
            // Spec §7: vertical handle SETS THE FLOOR; effective rowSpan
            // is then max(floor, fit). Record the floor; the autofit
            // gesture controller reconciles via §5.1 "floor-resize" trigger.
            setMinRowSpan(r.blockId, r.previewH);
            const base = captureLayoutSnapshot(stateRef.current);
            reconcileTo(base, r.blockId, Math.max(r.previewH, r.currentFit));
            commitGesture(r.blockId, base.blocks.find((b) => b.id === r.blockId)?.rowSpan ?? 1);
          } else {
            transform(r.blockId, {
              col: r.previewCol,
              row: r.previewRow,
              colSpan: r.previewW,
              rowSpan: r.previewH,
            });
          }
        }
        return {
          active: false,
          blockId: null,
          axis: null,
          previewCol: 0,
          previewRow: 0,
          previewW: 0,
          previewH: 0,
          currentFit: 0,
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
    autofit,
    setAutofit,
    minRowSpan,
    setMinRowSpan,
    blockDragProps,
    paletteDragProps,
    canvasDropProps,
    beginResize,
  };
}
