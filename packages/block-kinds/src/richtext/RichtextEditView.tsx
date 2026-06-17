/**
 * Active-block editing surface (M9-D2/D3). All in-content menus wear
 * the HOST's universal panel face via HostServices.menu (owner ruling:
 * vertical, unified with the context menus — a plugin describes items,
 * the host draws the panel):
 *   - drag-select mouseup / right-click on a selection → format menu
 *     (marks with ✓, turn-into pills, color swatches, spacing pills,
 *     link + page link);
 *   - "/" at the caret → insert menu (block types, page link).
 * The only module-owned float left is the page picker (it needs a
 * filter input, which the menu face deliberately doesn't host).
 * Degradation rule: absent host capability = hidden affordance.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@skb/theme';
import { UiTextInput } from '@skb/ui-kit';
import { useHost } from '../types';
import type { HostMenuItem } from '../types';
import type { EditorHandle, ToolbarCommand } from './editor';
import type { BlockViewProps } from '../types';
import { COLOR_PALETTE, SPACING_LINE_HEIGHT, coerceContent, type PmNode, type RichtextContent, type RichtextSpacing } from './richtext';

type Anchor = { x: number; top: number; bottom: number };

const TURN_INTO: Array<{ id: ToolbarCommand; name: string }> = [
  { id: 'h1', name: 'H1' },
  { id: 'h2', name: 'H2' },
  { id: 'h3', name: 'H3' },
  { id: 'bullet_list', name: '• list' },
  { id: 'ordered_list', name: '1. list' },
  { id: 'blockquote', name: '❝ quote' },
];

const SLASH_ITEMS: Array<{ label: string; run: ToolbarCommand | 'pagepicker' }> = [
  { label: 'Heading 1', run: 'h1' },
  { label: 'Heading 2', run: 'h2' },
  { label: 'Heading 3', run: 'h3' },
  { label: 'Bullet list', run: 'bullet_list' },
  { label: 'Numbered list', run: 'ordered_list' },
  { label: 'Quote', run: 'blockquote' },
  { label: 'Link to page…', run: 'pagepicker' },
];

export function RichtextEditView({ content, onChange }: BlockViewProps<RichtextContent>) {
  const theme = useTheme();
  const host = useHost();
  const mountRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<EditorHandle | null>(null);
  const [, setTick] = useState(0);
  const tick = useCallback(() => setTick((t) => t + 1), []);
  const [picker, setPicker] = useState<Anchor | null>(null);

  // While mounted, this editor owns the content. Doc lives in PM;
  // spacing is block-level module state — both rejoin on every change.
  const initial = useRef(coerceContent(content));
  const lastDoc = useRef<PmNode>(initial.current.doc);
  const [spacing, setSpacingState] = useState<RichtextSpacing>(initial.current.spacing ?? 'normal');
  const spacingRef = useRef(spacing);
  spacingRef.current = spacing;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const emit = useCallback(() => {
    onChangeRef.current({
      doc: lastDoc.current,
      ...(spacingRef.current !== 'normal' ? { spacing: spacingRef.current } : {}),
    });
  }, []);

  function setSpacing(s: RichtextSpacing) {
    setSpacingState(s);
    spacingRef.current = s;
    emit();
  }

  useEffect(() => {
    let dead = false;
    let handle: EditorHandle | null = null;
    void import('./editor').then(({ mountEditor }) => {
      if (dead || !mountRef.current) return;
      handle = mountEditor({
        place: mountRef.current,
        doc: initial.current.doc,
        onDocChanged: (docJson) => {
          lastDoc.current = docJson as PmNode;
          emit();
        },
        onTick: tick,
        onSlash: (pos) => openSlashMenu(pos),
        onSelectionMenu: (point) => openFormatMenu(point),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, emit]);

  function openSlashMenu(slashPos: number) {
    const h = handleRef.current;
    if (!h || !host.menu) return;
    const at = h.posCoords(slashPos + 1);
    if (!at) return;
    host.menu(
      { x: at.x, y: at.bottom + 4 },
      SLASH_ITEMS.filter((it) => it.run !== 'pagepicker' || host.listPages).map<HostMenuItem>((item) => ({
        label: item.label,
        onSelect: () => {
          const handle = handleRef.current;
          if (!handle) return;
          handle.deleteRange(slashPos, slashPos + 1); // remove the typed "/"
          if (item.run === 'pagepicker') {
            const anchor = handle.posCoords(slashPos);
            setPicker(anchor ?? { x: at.x, top: at.top, bottom: at.bottom });
          } else {
            handle.exec(item.run);
          }
        },
      })),
      { header: 'insert' },
    );
  }

  function openFormatMenu(point: { x: number; y: number }) {
    const h = handleRef.current;
    if (!h || !host.menu || h.selectionEmpty()) return;
    const active = h.active();
    const currentColor = h.activeColor();

    const items: HostMenuItem[] = [
      { label: 'Bold', checked: active.strong, onSelect: () => h.exec('strong') },
      { label: 'Italic', checked: active.em, onSelect: () => h.exec('em') },
      { label: 'Inline code', checked: active.code, onSelect: () => h.exec('code') },
      { kind: 'separator' },
      {
        kind: 'choices',
        label: 'turn into',
        options: TURN_INTO.map((t) => ({ id: t.id, name: t.name, selected: active[t.id] })),
        onPick: (id) => h.exec(id as ToolbarCommand),
      },
      {
        kind: 'choices',
        label: 'color',
        options: [
          { id: '__default', name: 'Default', swatch: theme.textColor, selected: currentColor === null },
          ...COLOR_PALETTE.map((c) => ({ id: c.id, name: c.name, swatch: c.css, selected: currentColor === c.css })),
        ],
        onPick: (id) => {
          if (id === '__default') h.setColor(null);
          else {
            const c = COLOR_PALETTE.find((p) => p.id === id);
            if (c) h.setColor(c.css);
          }
        },
      },
      {
        kind: 'choices',
        label: 'spacing',
        options: (['compact', 'normal', 'relaxed'] as const).map((s) => ({
          id: s,
          name: s,
          selected: spacingRef.current === s,
        })),
        onPick: (id) => setSpacing(id as RichtextSpacing),
      },
    ];

    const tail: HostMenuItem[] = [];
    if (host.promptText) {
      tail.push({
        label: active.link ? 'Edit link…' : 'Link…',
        onSelect: () => void editLink(),
      });
    }
    if (host.listPages) {
      tail.push({
        label: 'Link to page…',
        checked: active.pagelink,
        onSelect: () => {
          const sel = h.selectionCoords();
          if (sel) setPicker(sel);
        },
      });
    }
    if (tail.length > 0) items.push({ kind: 'separator' }, ...tail);

    host.menu(point, items, { header: 'text' });
  }

  async function editLink() {
    const h = handleRef.current;
    if (!h || !host.promptText || h.selectionEmpty()) return;
    const href = await host.promptText({
      title: 'link',
      message: 'URL (empty clears the link)',
      initial: '',
    });
    if (href === null) return;
    h.setLink(href.trim() === '' ? null : href.trim());
  }

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
          content: 'Write — or "/" for blocks, select text to format…';
          color: ${theme.mutedColor};
          position: absolute;
          pointer-events: none;
        }
      `}</style>

      <div
        ref={mountRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          fontSize: '14px',
          lineHeight: SPACING_LINE_HEIGHT[spacing],
          color: theme.textColor,
        }}
      />

      {picker && host.listPages && (
        <FloatingPanel anchor={picker} place="below">
          <PagePicker
            listPages={host.listPages}
            onPick={(p) => {
              setPicker(null);
              handleRef.current?.insertPageLink(p.id, p.title);
            }}
            onClose={() => {
              setPicker(null);
              handleRef.current?.focus();
            }}
          />
        </FloatingPanel>
      )}
    </div>
  );
}

/**
 * Module-owned floating panel — ONLY for the page picker (it hosts an
 * input, which the universal menu face deliberately doesn't). Portal to
 * body, viewport-fixed, measured-then-clamped.
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
