/**
 * Active-block editing surface, Notion-style (M9-D2): no fixed chrome
 * on the block — a floating bubble bar rises over the text selection
 * (marks, turn-into, links) and a "/" slash menu offers block types at
 * the caret. All floating panels are MODULE-OWNED portals (plugin
 * posture: host overlays are unreachable, a plugin ships its own
 * editing chrome). Host reach stays HostServices-only: promptText for
 * the URL dialog, listPages for the page picker; absent capability =
 * hidden affordance.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@skb/theme';
import { UiTextInput } from '@skb/ui-kit';
import { useHost } from '../types';
import type { EditorHandle, ToolbarCommand } from './editor';
import type { BlockViewProps } from '../types';
import { coerceContent, type RichtextContent } from './richtext';

type Anchor = { x: number; top: number; bottom: number };

type Overlay =
  | { kind: 'slash'; pos: number; highlight: number }
  | { kind: 'pagepicker'; anchor: Anchor }
  | null;

type SlashItem = { label: string; hint: string; run: 'pagepicker' | ToolbarCommand };

const SLASH_ITEMS: SlashItem[] = [
  { label: 'Heading 1', hint: '#', run: 'h1' },
  { label: 'Heading 2', hint: '##', run: 'h2' },
  { label: 'Heading 3', hint: '###', run: 'h3' },
  { label: 'Bullet list', hint: '-', run: 'bullet_list' },
  { label: 'Numbered list', hint: '1.', run: 'ordered_list' },
  { label: 'Quote', hint: '>', run: 'blockquote' },
  { label: 'Link to page', hint: '⛓', run: 'pagepicker' },
];

export function RichtextEditView({ content, onChange }: BlockViewProps<RichtextContent>) {
  const theme = useTheme();
  const host = useHost();
  const mountRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<EditorHandle | null>(null);
  const [, setTick] = useState(0);
  const tick = useCallback(() => setTick((t) => t + 1), []);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const overlayRef = useRef<Overlay>(null);
  overlayRef.current = overlay;

  // Initial content only: while mounted, this editor owns the doc.
  const initialDoc = useRef(coerceContent(content).doc);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let dead = false;
    let handle: EditorHandle | null = null;
    void import('./editor').then(({ mountEditor }) => {
      if (dead || !mountRef.current) return;
      handle = mountEditor({
        place: mountRef.current,
        doc: initialDoc.current,
        onDocChanged: (docJson) => onChangeRef.current({ doc: docJson } as RichtextContent),
        onTick: tick,
        onSlash: (pos) => setOverlay({ kind: 'slash', pos, highlight: 0 }),
      });
      handleRef.current = handle;
      handle.focus();
      tick();
    });
    return () => {
      dead = true;
      handle?.destroy();
      handleRef.current = null;
    };
  }, [tick]);

  // Floating anchors live in viewport coords — follow scroll/resize/focus.
  useEffect(() => {
    const opts = { capture: true, passive: true } as const;
    window.addEventListener('scroll', tick, opts);
    window.addEventListener('resize', tick);
    document.addEventListener('focusin', tick);
    return () => {
      window.removeEventListener('scroll', tick, opts);
      window.removeEventListener('resize', tick);
      document.removeEventListener('focusin', tick);
    };
  }, [tick]);

  // Slash-menu keyboard: capture-phase so PM never sees the navigation.
  useEffect(() => {
    if (overlay?.kind !== 'slash') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setOverlay(null);
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        const delta = e.key === 'ArrowDown' ? 1 : -1;
        setOverlay((o) =>
          o?.kind === 'slash' ? { ...o, highlight: (o.highlight + delta + SLASH_ITEMS.length) % SLASH_ITEMS.length } : o,
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        const o = overlayRef.current;
        if (o?.kind === 'slash') runSlashItem(SLASH_ITEMS[o.highlight]!, o.pos);
      } else if (e.key.length === 1 || e.key === 'Backspace') {
        // typing continues in the doc — a moved caret invalidates the menu
        setOverlay(null);
      }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlay?.kind]);

  const h = handleRef.current;
  const active = h?.active();

  function runSlashItem(item: SlashItem, slashPos: number) {
    const handle = handleRef.current;
    if (!handle) return;
    handle.deleteRange(slashPos, slashPos + 1); // remove the typed "/"
    if (item.run === 'pagepicker') {
      const anchor = handle.posCoords(slashPos) ?? { x: 100, top: 100, bottom: 120 };
      setOverlay({ kind: 'pagepicker', anchor });
    } else {
      setOverlay(null);
      handle.exec(item.run);
    }
  }

  async function editLink() {
    if (!h || !host.promptText || h.selectionEmpty()) return;
    const href = await host.promptText({
      title: 'link',
      message: 'URL (empty clears the link)',
      initial: '',
    });
    if (href === null) return;
    h.setLink(href.trim() === '' ? null : href.trim());
  }

  // Bubble: selection present, PM (or a module panel) focused, no other overlay.
  const selCoords = h && !h.selectionEmpty() ? h.selectionCoords() : null;
  const bubbleVisible = !!selCoords && overlay === null && (h?.hasFocus() ?? false);

  return (
    <div className="skb-rt-edit" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <style>{`
        .skb-rt-edit .ProseMirror { outline: none; white-space: pre-wrap; word-wrap: break-word; min-height: 60px; }
        .skb-rt-edit .ProseMirror > :first-child { margin-top: 0; }
        .skb-rt-edit .ProseMirror > :last-child { margin-bottom: 0; }
        .skb-rt-edit .ProseMirror h1, .skb-rt-edit .ProseMirror h2, .skb-rt-edit .ProseMirror h3 { line-height: 1.25; }
        .skb-rt-edit .ProseMirror code { background: ${theme.surfaceInsetBg}; padding: 1px 4px; border-radius: 3px; font-size: 0.9em; }
        .skb-rt-edit .ProseMirror blockquote { margin: 0.5em 0; padding-left: 10px; border-left: 3px solid ${theme.hairline}; color: ${theme.quoteColor}; }
        .skb-rt-edit .ProseMirror a { color: ${theme.accent}; }
        .skb-rt-edit .ProseMirror > p:only-child:has(> br.ProseMirror-trailingBreak:only-child)::before {
          content: 'Write — or "/" for blocks, "##" for headings…';
          color: ${theme.mutedColor};
          position: absolute;
          pointer-events: none;
        }
      `}</style>

      <div
        ref={mountRef}
        style={{ flex: 1, minHeight: 0, overflow: 'auto', fontSize: '14px', lineHeight: 1.55, color: theme.textColor }}
      />

      {bubbleVisible && selCoords && (
        <FloatingPanel anchor={selCoords} place="above">
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '3px 4px' }}>
            <TbButton label="B" title="Bold (Ctrl-B)" bold active={active?.strong} onClick={() => h?.exec('strong')} />
            <TbButton label="I" title="Italic (Ctrl-I)" italic active={active?.em} onClick={() => h?.exec('em')} />
            <TbButton label="‹›" title="Inline code (Ctrl-`)" active={active?.code} onClick={() => h?.exec('code')} />
            <TbDivider />
            {(['h1', 'h2', 'h3'] as const).map((cmd) => (
              <TbButton key={cmd} label={cmd.toUpperCase()} title={`Heading ${cmd[1]}`} active={active?.[cmd]} onClick={() => h?.exec(cmd)} />
            ))}
            <TbButton label="•" title="Bullet list" active={active?.bullet_list} onClick={() => h?.exec('bullet_list')} />
            <TbButton label="1." title="Numbered list" active={active?.ordered_list} onClick={() => h?.exec('ordered_list')} />
            <TbButton label="❝" title="Quote" active={active?.blockquote} onClick={() => h?.exec('blockquote')} />
            {(host.promptText || host.listPages) && <TbDivider />}
            {host.promptText && (
              <TbButton label="link" title="Link selection to a URL" active={active?.link} onClick={() => void editLink()} />
            )}
            {host.listPages && (
              <TbButton
                label="⛓"
                title="Link selection to a page (never breaks on rename)"
                active={active?.pagelink}
                onClick={() => {
                  const anchor = h?.selectionCoords();
                  if (anchor) setOverlay({ kind: 'pagepicker', anchor });
                }}
              />
            )}
          </div>
        </FloatingPanel>
      )}

      {overlay?.kind === 'slash' && h && (
        <FloatingPanel anchor={h.posCoords(overlay.pos + 1) ?? { x: 100, top: 100, bottom: 120 }} place="below">
          <div style={{ display: 'flex', flexDirection: 'column', padding: '4px', minWidth: '180px' }}>
            {SLASH_ITEMS.filter((it) => it.run !== 'pagepicker' || host.listPages).map((item, i) => (
              <button
                key={item.label}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => runSlashItem(item, overlay.pos)}
                onMouseEnter={() => setOverlay((o) => (o?.kind === 'slash' ? { ...o, highlight: i } : o))}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '14px',
                  alignItems: 'center',
                  textAlign: 'left',
                  background: overlay.highlight === i ? theme.surfaceInsetBg : 'transparent',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '12.5px',
                  fontFamily: 'inherit',
                  color: theme.textColor,
                  padding: '5px 8px',
                }}
              >
                <span>{item.label}</span>
                <span style={{ color: theme.mutedColor, fontSize: '10px' }}>{item.hint}</span>
              </button>
            ))}
          </div>
        </FloatingPanel>
      )}

      {overlay?.kind === 'pagepicker' && host.listPages && (
        <FloatingPanel anchor={overlay.anchor} place="below">
          <PagePicker
            listPages={host.listPages}
            onPick={(p) => {
              setOverlay(null);
              handleRef.current?.insertPageLink(p.id, p.title);
            }}
            onClose={() => {
              setOverlay(null);
              handleRef.current?.focus();
            }}
          />
        </FloatingPanel>
      )}
    </div>
  );
}

/**
 * Module-owned floating panel (the plugin's own chrome): portal to
 * body, viewport-fixed, measured-then-clamped like any decent popover.
 * Content-theme voiced — this floats over the themed sheet.
 */
function FloatingPanel({ anchor, place, children }: { anchor: Anchor; place: 'above' | 'below'; children: React.ReactNode }) {
  const theme = useTheme();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    let left = place === 'above' ? anchor.x - width / 2 : anchor.x;
    let top = place === 'above' ? anchor.top - height - 8 : anchor.bottom + 6;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    if (top < 8) top = anchor.bottom + 6; // no room above → flip below
    top = Math.max(8, Math.min(top, window.innerHeight - height - 8));
    setPos({ left, top });
  }, [anchor.x, anchor.top, anchor.bottom, place]);

  return createPortal(
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: `${pos?.left ?? anchor.x}px`,
        top: `${pos?.top ?? anchor.top}px`,
        visibility: pos ? 'visible' : 'hidden',
        zIndex: 600, // under host modals/menus (1000+), over the sheet
        background: theme.blockBg,
        border: `1px solid ${theme.hairline}`,
        borderRadius: '6px',
        boxShadow: '0 6px 24px rgba(0, 0, 0, 0.14), 0 1px 4px rgba(0, 0, 0, 0.10)',
        fontFamily: theme.fontFamily,
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

/** Page-link picker body — filter + first matches. */
function PagePicker({
  listPages,
  onPick,
  onClose,
}: {
  listPages: NonNullable<ReturnType<typeof useHost>['listPages']>;
  onPick: (p: { id: string; title: string }) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const [pages, setPages] = useState<Array<{ id: string; title: string }> | null>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    let dead = false;
    void listPages().then((p) => {
      if (!dead) setPages(p);
    });
    return () => {
      dead = true;
    };
  }, [listPages]);

  const shown = (pages ?? []).filter((p) => p.title.toLowerCase().includes(filter.toLowerCase())).slice(0, 8);

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '6px', width: '220px' }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <UiTextInput value={filter} onChange={setFilter} placeholder="Filter pages…" title="Type to filter" />
      {pages === null && <span style={{ fontSize: '11px', color: theme.mutedColor }}>Loading…</span>}
      {pages !== null && shown.length === 0 && <span style={{ fontSize: '11px', color: theme.mutedColor }}>No matching page.</span>}
      {shown.map((p) => (
        <button
          key={p.id}
          onClick={() => onPick(p)}
          style={{
            textAlign: 'left',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: '12px',
            fontFamily: 'inherit',
            color: theme.textColor,
            padding: '3px 4px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {p.title}
        </button>
      ))}
    </div>
  );
}

function TbButton({
  label,
  title,
  onClick,
  active,
  bold,
  italic,
}: {
  label: string;
  title: string;
  onClick: () => void;
  active?: boolean;
  bold?: boolean;
  italic?: boolean;
}) {
  const theme = useTheme();
  return (
    <button
      title={title}
      // preserve the PM selection: the bubble must not steal focus
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      style={{
        fontSize: '11px',
        fontWeight: bold ? 700 : 500,
        fontStyle: italic ? 'italic' : 'normal',
        fontFamily: 'inherit',
        color: active ? theme.accent : theme.mutedColor,
        background: active ? theme.surfaceInsetBg : 'transparent',
        border: 'none',
        borderRadius: '3px',
        padding: '3px 7px',
        cursor: 'pointer',
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}

function TbDivider() {
  const theme = useTheme();
  return <span aria-hidden style={{ width: '1px', height: '14px', background: theme.hairline, margin: '0 2px', flexShrink: 0 }} />;
}
