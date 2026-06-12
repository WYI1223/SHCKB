/**
 * Chrome overlay primitives (MVP-8 M8-D1) — ONE panel anatomy, three
 * mechanisms: modal dialog (confirm/prompt/alert, Promise API replacing
 * window.*), anchored/cursor menu (popover + context menu are the same
 * machine with two anchor modes), and a generic Modal for larger panels
 * (settings). All of it is author-side instrumentation, so it lives in
 * the bench voice and never follows the content theme; readers never
 * see an overlay [mvp8-scope-2026-06-13]. Destructive confirms carry
 * registration red — "needs the author's hand".
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { BENCH, benchButtonStyle, labelStyle, pressButtonStyle } from './bench';

/** Stacking: modals under menus (a menu may open over a settings panel). */
const Z_MODAL = 1000;
const Z_MENU = 1100;

const SCRIM = 'rgba(35, 33, 28, 0.32)';

/** The shared panel anatomy — every overlay surface is this paper. */
export function overlayPanelStyle(extra?: CSSProperties): CSSProperties {
  return {
    background: BENCH.paperRaised,
    border: `1px solid ${BENCH.hairlineDark}`,
    borderRadius: '2px',
    boxShadow: '0 10px 30px rgba(35, 33, 28, 0.22), 0 2px 6px rgba(35, 33, 28, 0.12)',
    color: BENCH.ink,
    fontFamily: BENCH.fontUi,
    ...extra,
  };
}

// ---------------------------------------------------------------- menu

export type MenuItem =
  | {
      kind?: 'item';
      label: string;
      onSelect: () => void;
      danger?: boolean;
      disabled?: boolean;
      /** tree-ish lists (move-to folders) indent without nesting menus */
      indent?: number;
    }
  | { kind: 'separator' }
  | { kind: 'label'; label: string };

/** Cursor point (context menu) or element (popover under its trigger). */
export type MenuAnchor = { x: number; y: number } | HTMLElement;

type MenuState = {
  x: number;
  y: number;
  /** element anchors align the panel's right edge to the trigger's */
  align: 'left' | 'right';
  items: MenuItem[];
  header?: string;
  restoreFocus: Element | null;
};

// -------------------------------------------------------------- dialogs

export type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  /** registration red treatment for destructive confirms */
  danger?: boolean;
};

export type PromptOptions = {
  title?: string;
  message?: string;
  initial?: string;
  placeholder?: string;
  confirmLabel?: string;
};

export type AlertOptions = { title?: string; message: string };

type DialogState =
  | { mode: 'confirm'; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | { mode: 'prompt'; opts: PromptOptions; resolve: (v: string | null) => void }
  | { mode: 'alert'; opts: AlertOptions; resolve: () => void };

// -------------------------------------------------------------- context

export type OverlaysApi = {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  prompt: (opts: PromptOptions) => Promise<string | null>;
  alert: (opts: AlertOptions) => Promise<void>;
  menu: (anchor: MenuAnchor, items: MenuItem[], opts?: { header?: string }) => void;
};

const OverlaysContext = createContext<OverlaysApi | null>(null);

export function useOverlays(): OverlaysApi {
  const ctx = useContext(OverlaysContext);
  if (!ctx) throw new Error('useOverlays outside OverlayProvider');
  return ctx;
}

export function OverlayProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [menuState, setMenuState] = useState<MenuState | null>(null);

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setDialog({ mode: 'confirm', opts, resolve })),
    [],
  );
  const prompt = useCallback(
    (opts: PromptOptions) =>
      new Promise<string | null>((resolve) => setDialog({ mode: 'prompt', opts, resolve })),
    [],
  );
  const alert = useCallback(
    (opts: AlertOptions) => new Promise<void>((resolve) => setDialog({ mode: 'alert', opts, resolve })),
    [],
  );
  const menu = useCallback((anchor: MenuAnchor, items: MenuItem[], opts?: { header?: string }) => {
    const restoreFocus = document.activeElement;
    if (anchor instanceof HTMLElement) {
      const rect = anchor.getBoundingClientRect();
      setMenuState({ x: rect.right, y: rect.bottom + 2, align: 'right', items, header: opts?.header, restoreFocus });
    } else {
      setMenuState({ x: anchor.x, y: anchor.y, align: 'left', items, header: opts?.header, restoreFocus });
    }
  }, []);

  const api = useMemo<OverlaysApi>(() => ({ confirm, prompt, alert, menu }), [confirm, prompt, alert, menu]);

  return (
    <OverlaysContext.Provider value={api}>
      {children}
      {dialog && <DialogPanel dialog={dialog} close={() => setDialog(null)} />}
      {menuState && <MenuPanel state={menuState} close={() => setMenuState(null)} />}
    </OverlaysContext.Provider>
  );
}

// ---------------------------------------------------------------- Modal

/**
 * Generic modal panel on the shared anatomy — the settings panel and any
 * future large chrome surface. Owns scrim, Esc, focus trap + restore.
 */
export function Modal({
  title,
  onClose,
  width = 420,
  children,
}: {
  title: string;
  onClose: () => void;
  width?: number;
  children: ReactNode;
}) {
  const panelRef = useFocusTrap<HTMLDivElement>();
  return createPortal(
    <div
      className="pu-chrome"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={scrimStyle(Z_MODAL)}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal
        aria-label={title}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            onClose();
          }
        }}
        className="pu-scroll"
        style={overlayPanelStyle({
          width: `${width}px`,
          maxWidth: 'calc(100vw - 48px)',
          maxHeight: '82vh',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
        })}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '10px 14px 8px',
            borderBottom: `1px solid ${BENCH.hairline}`,
            flexShrink: 0,
          }}
        >
          <span style={{ ...labelStyle(), flex: 1 }}>{title}</span>
          <button
            onClick={onClose}
            aria-label="Close"
            title="Close"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: BENCH.inkFaint,
              fontSize: '13px',
              lineHeight: 1,
              padding: '2px 4px',
            }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: '12px 14px 14px' }}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}

// -------------------------------------------------------- dialog panel

function DialogPanel({ dialog, close }: { dialog: DialogState; close: () => void }) {
  const panelRef = useFocusTrap<HTMLDivElement>();
  const [value, setValue] = useState(dialog.mode === 'prompt' ? (dialog.opts.initial ?? '') : '');

  const cancel = () => {
    if (dialog.mode === 'confirm') dialog.resolve(false);
    else if (dialog.mode === 'prompt') dialog.resolve(null);
    else dialog.resolve();
    close();
  };
  const accept = () => {
    if (dialog.mode === 'confirm') dialog.resolve(true);
    else if (dialog.mode === 'prompt') dialog.resolve(value);
    else dialog.resolve();
    close();
  };

  const danger = dialog.mode === 'confirm' && dialog.opts.danger;
  const title = dialog.opts.title ?? dialog.mode;
  const confirmLabel =
    dialog.mode === 'alert' ? 'ok' : (dialog.opts.confirmLabel ?? (dialog.mode === 'prompt' ? 'ok' : 'confirm'));
  const message = dialog.mode === 'prompt' ? dialog.opts.message : dialog.opts.message;

  return createPortal(
    <div
      className="pu-chrome"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) cancel();
      }}
      style={scrimStyle(Z_MODAL)}
    >
      <div
        ref={panelRef}
        role={dialog.mode === 'alert' ? 'alertdialog' : 'dialog'}
        aria-modal
        aria-label={title}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            cancel();
          }
        }}
        style={overlayPanelStyle({ width: '340px', maxWidth: 'calc(100vw - 48px)' })}
      >
        <div
          style={{
            ...labelStyle(danger ? { color: BENCH.red } : undefined),
            padding: '10px 14px 8px',
            borderBottom: `1px solid ${BENCH.hairline}`,
          }}
        >
          {title}
        </div>
        <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {message && (
            <p style={{ margin: 0, fontSize: '12.5px', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{message}</p>
          )}
          {dialog.mode === 'prompt' && (
            <input
              data-overlay-autofocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={dialog.opts.placeholder}
              aria-label={title}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  // preventDefault, or the key's default action fires on
                  // whatever receives focus after close (the opener
                  // button) and re-triggers the dialog.
                  e.preventDefault();
                  accept();
                }
              }}
              onFocus={(e) => e.currentTarget.select()}
              style={{
                background: BENCH.paper,
                border: `1px solid ${BENCH.hairlineDark}`,
                borderRadius: '2px',
                color: BENCH.ink,
                fontFamily: BENCH.fontUi,
                fontSize: '13px',
                padding: '6px 8px',
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box',
              }}
            />
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
            {dialog.mode !== 'alert' && (
              <button
                onClick={cancel}
                className="pu-hoverable"
                // danger confirms park focus on the safe exit
                data-overlay-autofocus={danger || undefined}
                style={benchButtonStyle()}
              >
                cancel
              </button>
            )}
            <button
              onClick={accept}
              className="pu-press"
              data-overlay-autofocus={(dialog.mode === 'confirm' && !danger) || dialog.mode === 'alert' || undefined}
              style={{
                ...pressButtonStyle(),
                ...(danger ? { background: BENCH.red, borderColor: BENCH.red } : {}),
              }}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------- menu panel

function MenuPanel({ state, close }: { state: MenuState; close: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  // Measure, clamp into the viewport, then reveal.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    let left = state.align === 'right' ? state.x - width : state.x;
    let top = state.y;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - height - 8));
    setPos({ left, top });
  }, [state]);

  // Focus the first enabled item so arrows work immediately — only
  // after positioning: while the panel is visibility-hidden (pre-clamp),
  // focus() silently fails in real browsers.
  useEffect(() => {
    if (!pos) return;
    const first = ref.current?.querySelector<HTMLButtonElement>('button[data-menu-item]:not(:disabled)');
    first?.focus();
  }, [pos, state]);

  const dismiss = useCallback(() => {
    close();
    if (state.restoreFocus instanceof HTMLElement) state.restoreFocus.focus();
  }, [close, state.restoreFocus]);

  function moveFocus(delta: 1 | -1 | 'home' | 'end') {
    const el = ref.current;
    if (!el) return;
    const items = Array.from(el.querySelectorAll<HTMLButtonElement>('button[data-menu-item]:not(:disabled)'));
    if (items.length === 0) return;
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      delta === 'home' ? 0
      : delta === 'end' ? items.length - 1
      : at === -1 ? 0
      : (at + delta + items.length) % items.length;
    items[next]?.focus();
  }

  return createPortal(
    <div
      className="pu-chrome"
      // transparent backdrop: any press outside the panel dismisses
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
      onContextMenu={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
          dismiss();
        }
      }}
      style={{ position: 'fixed', inset: 0, zIndex: Z_MENU }}
    >
      <div
        ref={ref}
        role="menu"
        aria-label={state.header ?? 'menu'}
        onKeyDown={(e) => {
          if (e.key === 'Escape' || e.key === 'Tab') {
            e.preventDefault();
            e.stopPropagation();
            dismiss();
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            moveFocus(1);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            moveFocus(-1);
          } else if (e.key === 'Home') {
            e.preventDefault();
            moveFocus('home');
          } else if (e.key === 'End') {
            e.preventDefault();
            moveFocus('end');
          }
        }}
        className="pu-scroll"
        style={overlayPanelStyle({
          position: 'fixed',
          left: `${pos?.left ?? state.x}px`,
          top: `${pos?.top ?? state.y}px`,
          visibility: pos ? 'visible' : 'hidden',
          minWidth: '168px',
          maxWidth: '280px',
          maxHeight: '60vh',
          overflow: 'auto',
          padding: '4px 0',
        })}
      >
        {state.header && (
          <div style={{ ...labelStyle(), padding: '3px 12px 6px', borderBottom: `1px solid ${BENCH.hairline}`, marginBottom: '3px' }}>
            {state.header}
          </div>
        )}
        {state.items.map((item, i) => {
          if (item.kind === 'separator') {
            return <div key={i} aria-hidden style={{ borderTop: `1px solid ${BENCH.hairline}`, margin: '4px 0' }} />;
          }
          if (item.kind === 'label') {
            return (
              <div key={i} style={{ ...labelStyle(), padding: '5px 12px 3px' }}>
                {item.label}
              </div>
            );
          }
          return (
            <button
              key={i}
              data-menu-item
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                close(); // close first so onSelect may open a follow-up menu
                if (state.restoreFocus instanceof HTMLElement) state.restoreFocus.focus();
                item.onSelect();
              }}
              className={item.disabled ? undefined : 'pu-menu-item'}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: `5px 12px 5px ${12 + (item.indent ?? 0) * 12}px`,
                border: 'none',
                background: 'transparent',
                fontSize: '12.5px',
                fontFamily: BENCH.fontUi,
                color: item.disabled ? BENCH.inkFaint : item.danger ? BENCH.red : BENCH.ink,
                cursor: item.disabled ? 'default' : 'pointer',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}

// -------------------------------------------------------------- shared

function scrimStyle(z: number): CSSProperties {
  return {
    position: 'fixed',
    inset: 0,
    zIndex: z,
    background: SCRIM,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
}

/**
 * Focus trap for modal panels: park focus on [data-overlay-autofocus]
 * (or the panel), cycle Tab inside, restore the opener's focus on
 * unmount.
 */
function useFocusTrap<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const panel = ref.current;
    if (!panel) return;
    const prior = document.activeElement;
    const preferred = panel.querySelector<HTMLElement>('[data-overlay-autofocus]');
    (preferred ?? panel).focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    panel.addEventListener('keydown', onKeyDown);
    return () => {
      panel.removeEventListener('keydown', onKeyDown);
      if (prior instanceof HTMLElement) prior.focus();
    };
  }, []);
  return ref;
}
