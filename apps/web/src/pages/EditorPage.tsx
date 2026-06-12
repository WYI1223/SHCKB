/**
 * Authoring surface (notepage-editing.md): hosts the grid interaction +
 * block content as author working state, autosaves it (debounced), and
 * exposes the explicit update-public action that promotes the working
 * state to the public snapshot. Block content changes never touch
 * GridState geometry — they live in a separate contents map joined at
 * save time.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useParams } from 'react-router-dom';
import type { Block } from '@skb/grid-engine';
import { api, ApiError, uploadBlob, type NotepageDetail, type WorkingBlock } from '../api/client';
import { blockModule, defaultSizeFor, HostContext } from '@skb/block-kinds';
import { THEMES, ThemeProvider, applyCustomization, graphPaper, useTheme, type PageBackground } from '@skb/theme';
import { GridCanvas } from '../grid/GridCanvas';
import { Palette } from '../grid/Palette';
import { Properties, type Selection } from '../grid/Properties';
import { useGridInteraction } from '../grid/useGridInteraction';
import { useShell } from '../shell/Shell';

const AUTOSAVE_MS = 800;

type SaveStatus = { kind: 'saved' | 'saving' | 'dirty' } | { kind: 'error'; message: string; details?: string[] };

export function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<NotepageDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api
      .getNotepage(id)
      .then(setDetail)
      .catch((e: Error) => setError(e.message));
  }, [id]);

  if (error) return <PageMessage text={error} danger />;
  if (!detail) return <PageMessage text="Loading…" />;
  return <Editor key={detail.page.id} detail={detail} />;
}

function Editor({ detail }: { detail: NotepageDetail }) {
  const pageId = detail.page.id;
  const shell = useShell();
  const [title, setTitle] = useState(detail.page.title);
  const [themeId, setThemeId] = useState(detail.page.themeId);
  const [visibility, setVisibility] = useState(detail.page.visibility);
  const [hasPublished, setHasPublished] = useState(detail.page.hasPublished);
  const [slug, setSlug] = useState(detail.page.slug);
  const [linkCopied, setLinkCopied] = useState(false);
  // Selection model (M6-D1): page is the default selection; activating
  // a block selects it. The Properties inspector keys off this.
  const [selection, setSelection] = useState<Selection>({ type: 'page' });
  const activeId = selection.type === 'block' ? selection.blockId : null;
  const [status, setStatus] = useState<SaveStatus>({ kind: 'saved' });
  const [contents, setContents] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(detail.blocks.map((b) => [b.id, b.content])),
  );
  const [shells, setShells] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(detail.blocks.map((b) => [b.id, b.shell ?? null])),
  );
  const [background, setBackground] = useState<PageBackground | null>(detail.page.background);
  const contentsRef = useRef(contents);
  contentsRef.current = contents;
  const shellsRef = useRef(shells);
  shellsRef.current = shells;

  const setActiveId = useCallback(
    (id: string | null) => setSelection(id ? { type: 'block', blockId: id } : { type: 'page' }),
    [],
  );

  const interaction = useGridInteraction({
    initialBlocks: useMemo(() => detail.blocks.map(({ content: _c, ...geom }) => geom), [detail.blocks]),
    initialGravity: detail.page.gravityEnabled,
    defaultSizeFor,
    onBlockInserted: (block: Block) => {
      const mod = blockModule(block.kind);
      setContents((c) => ({ ...c, [block.id]: mod ? mod.createContent() : null }));
    },
  });

  // ----- autosave (debounced) -----
  const firstRun = useRef(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(async () => {
    setStatus({ kind: 'saving' });
    const blocks: WorkingBlock[] = interaction.state.blocks.map((b) => ({
      ...b,
      shell: shellsRef.current[b.id] ?? null,
      content: contentsRef.current[b.id] ?? null,
    }));
    try {
      await api.saveWorkingState(pageId, {
        title,
        gravityEnabled: interaction.gravityEnabled,
        blocks,
      });
      setStatus({ kind: 'saved' });
      shell.refresh(); // keep sidebar titles/badges current
    } catch (e) {
      if (e instanceof ApiError) {
        setStatus({ kind: 'error', message: e.message, details: e.details });
      } else {
        setStatus({ kind: 'error', message: 'network error — changes not saved' });
      }
    }
  }, [pageId, title, interaction.state, interaction.gravityEnabled]);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    setStatus((s) => (s.kind === 'error' ? s : { kind: 'dirty' }));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void save(), AUTOSAVE_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [save, contents, shells]);

  // Escape deactivates the active block (focus-leave → preview).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setActiveId]);

  // Properties dock anchor (Sidebar renders it; collapse re-creates it).
  const [propsAnchor, setPropsAnchor] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const find = () => setPropsAnchor(document.querySelector<HTMLElement>('[data-skb-properties-slot]'));
    find();
    const mo = new MutationObserver(find);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);

  async function changeBackground(bg: PageBackground | null) {
    await api.setPageBackground(pageId, bg);
    setBackground(bg);
  }

  async function publish() {
    await save();
    const res = await api.publish(pageId);
    setSlug(res.slug);
    setHasPublished(true);
    shell.refresh();
  }

  async function copyLink() {
    await navigator.clipboard.writeText(`${window.location.origin}/notes/${slug}`);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 1500);
  }

  async function toggleVisibility() {
    const next = visibility === 'public' ? 'private' : 'public';
    await api.setVisibility(pageId, next);
    setVisibility(next);
    shell.refresh();
  }

  async function pinTheme(next: string | null) {
    await api.setPageTheme(pageId, next);
    setThemeId(next);
  }

  // pin wins; else instance; unknown ids degrade to graph-paper.
  // Operator customization composes on top (same applyCustomization
  // the server uses at publish time — edit preview matches public).
  const effectiveId = themeId ?? shell.instanceTheme;
  const effective = applyCustomization(
    THEMES[effectiveId] ?? graphPaper,
    shell.customizations[effectiveId],
  );

  return (
    <ThemeProvider theme={effective}>
    <div>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '10px 20px 10px 44px',
          background: effective.chromeBg,
          color: 'white',
        }}
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Notepage title"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid oklch(40% 0.02 80)',
            color: 'white',
            fontSize: '16px',
            fontWeight: 600,
            padding: '4px 2px',
            outline: 'none',
          }}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={interaction.gravityEnabled}
            onChange={(e) => interaction.setGravityEnabled(e.target.checked)}
            style={{ accentColor: effective.accent }}
          />
          Gravity
        </label>
        <select
          value={themeId ?? ''}
          onChange={(e) => void pinTheme(e.target.value === '' ? null : e.target.value)}
          title="Page theme (instance = follow the instance theme)"
          aria-label="Page theme"
          style={{
            background: 'transparent',
            color: 'oklch(70% 0.02 80)',
            border: '1px solid oklch(40% 0.02 80)',
            borderRadius: '6px',
            padding: '5px 6px',
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          <option value="">Theme: instance</option>
          {Object.values(THEMES).map((t) => (
            <option key={t.id} value={t.id}>
              Theme: {t.name} 📌
            </option>
          ))}
        </select>
        <button onClick={toggleVisibility} style={chromeButton(visibility === 'public')}>
          {visibility === 'public' ? 'Public' : 'Private'}
        </button>
        <button onClick={() => void publish()} style={{ ...chromeButton(true), background: effective.accent, borderColor: effective.accent }}>
          {hasPublished ? 'Update public page' : 'Publish'}
        </button>
        {visibility === 'public' && hasPublished && (
          <>
            <Link to={`/notes/${slug}`} style={{ color: 'oklch(80% 0.08 240)', fontSize: '12px' }}>
              view public ↗
            </Link>
            <button onClick={() => void copyLink()} style={chromeButton(false)}>
              {linkCopied ? 'Copied!' : 'Copy link'}
            </button>
          </>
        )}
        <SaveIndicator status={status} />
      </header>

      <HostContext.Provider value={{ uploadBlob }}>
        <GridCanvas
          interaction={interaction}
          contents={contents}
          shells={shells}
          background={background}
          activeId={activeId}
          onActivate={setActiveId}
          onContentChange={(blockId, content) => setContents((c) => ({ ...c, [blockId]: content }))}
          onBlockDeleted={(blockId) => {
            setContents((c) => {
              const { [blockId]: _gone, ...rest } = c;
              return rest;
            });
            setShells((s) => {
              const { [blockId]: _gone, ...rest } = s;
              return rest;
            });
            setSelection({ type: 'page' });
          }}
        />
        <Palette interaction={interaction} />
        {/* Properties inspector, docked under the sidebar directory
            (M6-D2) — portal keeps it inside this editor's theme + host
            context while living in the shell's DOM. */}
        {propsAnchor &&
          createPortal(
            <Properties
              selection={selection}
              interaction={interaction}
              contents={contents}
              shells={shells}
              background={background}
              onContentChange={(blockId, content) => setContents((c) => ({ ...c, [blockId]: content }))}
              onShellChange={(blockId, shell) => setShells((s) => ({ ...s, [blockId]: shell }))}
              onBackgroundChange={(bg) => void changeBackground(bg)}
            />,
            propsAnchor,
          )}
      </HostContext.Provider>
    </div>
    </ThemeProvider>
  );
}

function chromeButton(active: boolean): React.CSSProperties {
  return {
    background: 'transparent',
    color: active ? 'white' : 'oklch(70% 0.02 80)',
    border: `1px solid ${active ? 'white' : 'oklch(40% 0.02 80)'}`,
    borderRadius: '6px',
    padding: '5px 12px',
    fontSize: '12px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  let text: string;
  if (status.kind === 'error') {
    text = `⚠ ${status.message}`;
  } else {
    text = status.kind === 'saved' ? 'Saved' : status.kind === 'saving' ? 'Saving…' : '…';
  }
  return (
    <span
      title={status.kind === 'error' ? status.details?.join('\n') : undefined}
      style={{
        fontSize: '12px',
        color: status.kind === 'error' ? 'oklch(75% 0.15 25)' : 'oklch(70% 0.02 80)',
        whiteSpace: 'nowrap',
        maxWidth: '260px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {text}
    </span>
  );
}

function PageMessage({ text, danger }: { text: string; danger?: boolean }) {
  const theme = useTheme();
  return (
    <p style={{ textAlign: 'center', marginTop: '80px', color: danger ? theme.danger : theme.mutedColor }}>{text}</p>
  );
}
