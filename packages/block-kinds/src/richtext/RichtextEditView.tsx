/**
 * Active-block editing surface: a module-owned toolbar over a
 * ProseMirror mount. The PM stack arrives via dynamic import (editor.ts)
 * — publish pipeline and reader bundles never load it. Host reach is
 * HostServices only (plugin posture): promptText for the link dialog,
 * listPages for the page-link picker; if the host lacks one, the
 * affordance hides instead of breaking.
 */
import { useEffect, useRef, useState } from 'react';
import { useTheme } from '@skb/theme';
import { UiTextInput } from '@skb/ui-kit';
import { useHost } from '../types';
import type { EditorHandle, ToolbarCommand } from './editor';
import type { BlockViewProps } from '../types';
import { coerceContent, type RichtextContent } from './richtext';

export function RichtextEditView({ content, onChange }: BlockViewProps<RichtextContent>) {
  const theme = useTheme();
  const host = useHost();
  const mountRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<EditorHandle | null>(null);
  const [, setTick] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);

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
        onTick: () => setTick((t) => t + 1),
      });
      handleRef.current = handle;
      handle.focus();
      setTick((t) => t + 1);
    });
    return () => {
      dead = true;
      handle?.destroy();
      handleRef.current = null;
    };
  }, []);

  const h = handleRef.current;
  const active = h?.active();

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
      `}</style>

      {/* module-owned toolbar — a plugin brings its own editing chrome */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '2px',
          paddingBottom: '6px',
          marginBottom: '6px',
          borderBottom: `1px solid ${theme.hairline}`,
          alignItems: 'center',
        }}
      >
        <TbButton label="B" title="Bold (Ctrl-B)" bold active={active?.strong} onClick={() => h?.exec('strong')} />
        <TbButton label="I" title="Italic (Ctrl-I)" italic active={active?.em} onClick={() => h?.exec('em')} />
        <TbButton label="‹›" title="Inline code (Ctrl-`)" active={active?.code} onClick={() => h?.exec('code')} />
        <TbDivider />
        {(['h1', 'h2', 'h3'] as const).map((cmd) => (
          <TbButton key={cmd} label={cmd.toUpperCase()} title={`Heading ${cmd[1]}`} active={active?.[cmd]} onClick={() => h?.exec(cmd)} />
        ))}
        <TbDivider />
        <TbButton label="•" title="Bullet list" active={active?.bullet_list} onClick={() => h?.exec('bullet_list')} />
        <TbButton label="1." title="Ordered list" active={active?.ordered_list} onClick={() => h?.exec('ordered_list')} />
        <TbButton label="❝" title="Blockquote" active={active?.blockquote} onClick={() => h?.exec('blockquote')} />
        {host.promptText && (
          <>
            <TbDivider />
            <TbButton label="link" title="Link selection to a URL" active={active?.link} onClick={() => void editLink()} />
          </>
        )}
        {host.listPages && (
          <TbButton
            label="⛓ page"
            title="Link to another page (never breaks on rename)"
            active={active?.pagelink || pickerOpen}
            onClick={() => setPickerOpen((v) => !v)}
          />
        )}
      </div>

      {pickerOpen && host.listPages && (
        <PagePicker
          listPages={host.listPages}
          onPick={(p) => {
            setPickerOpen(false);
            handleRef.current?.insertPageLink(p.id, p.title);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}

      <div ref={mountRef} style={{ flex: 1, minHeight: 0, overflow: 'auto', fontSize: '14px', lineHeight: 1.55, color: theme.textColor }} />
    </div>
  );
}

/** Inline page-link picker — module-owned panel (no host chrome). */
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
      style={{
        border: `1px solid ${theme.hairline}`,
        borderRadius: '3px',
        background: theme.surfaceInsetBg,
        padding: '6px',
        marginBottom: '6px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
      }}
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
      // preserve the PM selection: the toolbar must not steal focus
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      style={{
        fontSize: '11px',
        fontWeight: bold ? 700 : 500,
        fontStyle: italic ? 'italic' : 'normal',
        fontFamily: 'inherit',
        color: active ? theme.accent : theme.mutedColor,
        background: active ? theme.surfaceInsetBg : 'transparent',
        border: `1px solid ${active ? theme.accent : 'transparent'}`,
        borderRadius: '3px',
        padding: '2px 6px',
        cursor: 'pointer',
        lineHeight: 1.4,
      }}
    >
      {label}
    </button>
  );
}

function TbDivider() {
  const theme = useTheme();
  return <span aria-hidden style={{ width: '1px', height: '14px', background: theme.hairline, margin: '0 3px' }} />;
}
