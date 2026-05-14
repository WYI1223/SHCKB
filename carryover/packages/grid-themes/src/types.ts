/**
 * @skb/grid-themes — Theme interface + render props types.
 *
 * Per ADR-0020 D7. Closed v1 ThemeKey union with extensible registry API
 * shape — future v2 may open the union (string) without breaking the
 * `Theme` interface contract.
 */
import type { Block } from '@skb/grid-engine';

/** v1 closed union — must be a literal type for type-narrowing in switches. */
export type ThemeKey = 'graph-paper' | 'lego-studs' | 'bento-canvas';

export type ResizeAxis =
  | 'right'
  | 'left'
  | 'top'
  | 'bottom'
  | 'corner'
  | 'top-left';

export interface BaseplateProps {
  totalCols: number;
  totalRows: number;
  /** Whether a drag or resize is in progress — themes can use this to
   * show/hide grid lines (e.g., Bento canvas hides baseplate by default
   * + shows during drag). */
  dragInProgress: boolean;
  /** Slot pixel size — themes are free to ignore but typically use this
   * to set background-size for grid-line rendering. */
  slotSize: number;
}

export interface BlockRenderProps {
  block: Block;
  isDragging: boolean;
  isResizing: boolean;
  isFocused: boolean;
  /** The actual content (markdown rendered HTML, image, etc.). Themes
   * provide the chrome (border, header, glyph) and slot in children. */
  children: React.ReactNode;
}

export interface DropPreviewProps {
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
  /** Green ghost when true, red rejection ghost when false. */
  isValid: boolean;
  /** Slot pixel size, used to translate (col, row, spans) → CSS box. */
  slotSize: number;
}

export interface ResizeHandleProps {
  edge: ResizeAxis;
  active: boolean;
}

export interface GridTheme {
  /** Stable kebab-case identifier; used as storage key + URL param. */
  key: ThemeKey;
  /** Human-readable name (English). */
  displayName: string;
  /** Optional one-liner description. */
  description?: string;
  /** Slot pixel size — uniform square per ADR-0020 D1 (LEGO baseplate). */
  slotSize: number;
  /** CSS variables to inject at the editor root. Theme implementation
   * may use these to drive its own component styles + downstream
   * consumers (cf-19 block chrome, etc.). */
  cssVars: Record<string, string>;
  /** Render the baseplate (grid lines / studs / blank — theme decides). */
  renderBaseplate: (props: BaseplateProps) => React.ReactNode;
  /** Render a single block's themed chrome around `children`. */
  renderBlock: (props: BlockRenderProps) => React.ReactNode;
  /** Render the drop ghost / preview during drag. */
  renderDropPreview: (props: DropPreviewProps) => React.ReactNode;
  /** Optional theme-specific resize handle. Falls back to shared default
   * if not provided. */
  renderResizeHandle?: (props: ResizeHandleProps) => React.ReactNode;
}
