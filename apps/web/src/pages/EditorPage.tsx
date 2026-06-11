/**
 * Authoring surface (notepage-editing.md): hosts the grid interaction +
 * block content as author working state, autosaves it (debounced), and
 * exposes the explicit update-public action that promotes the working
 * state to the public snapshot. Block content changes never touch
 * GridState geometry — they live in a separate contents map joined at
 * save time.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Block } from '@skb/grid-engine';
import { api, ApiError, type NotepageDetail, type WorkingBlock } from '../api/client';
import { blockModule, defaultSizeFor } from '../blocks/registry';
import { GridCanvas } from '../grid/GridCanvas';
import { Palette } from '../grid/Palette';
import { useGridInteraction } from '../grid/useGridInteraction';
import { theme } from '../theme/tokens';

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
  const [title, setTitle] = useState(detail.page.title);
  const [visibility, setVisibility] = useState(detail.page.visibility);
  const [hasPublished, setHasPublished] = useState(detail.page.hasPublished);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [status, setStatus] = useState<SaveStatus>({ kind: 'saved' });
  const [contents, setContents] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(detail.blocks.map((b) => [b.id, b.content])),
  );
  const contentsRef = useRef(contents);
  contentsRef.current = contents;

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
      content: contentsRef.current[b.id] ?? null,
    }));
    try {
      await api.saveWorkingState(pageId, {
        title,
        gravityEnabled: interaction.gravityEnabled,
        blocks,
      });
      setStatus({ kind: 'saved' });
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
  }, [save, contents]);

  // Escape deactivates the active block (focus-leave → preview).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function publish() {
    await save();
    await api.publish(pageId);
    setHasPublished(true);
  }

  async function toggleVisibility() {
    const next = visibility === 'public' ? 'private' : 'public';
    await api.setVisibility(pageId, next);
    setVisibility(next);
  }

  return (
    <div>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '10px 20px',
          background: theme.chromeBg,
          color: 'white',
        }}
      >
        <Link to="/" style={{ color: 'oklch(80% 0.02 80)', textDecoration: 'none', fontSize: '13px' }}>
          ← All notepages
        </Link>
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
            style={{ accentColor: theme.accent }}
          />
          Gravity
        </label>
        <button onClick={toggleVisibility} style={chromeButton(visibility === 'public')}>
          {visibility === 'public' ? 'Public' : 'Private'}
        </button>
        <button onClick={() => void publish()} style={{ ...chromeButton(true), background: theme.accent, borderColor: theme.accent }}>
          {hasPublished ? 'Update public page' : 'Publish'}
        </button>
        {visibility === 'public' && hasPublished && (
          <Link to={`/notes/${detail.page.slug}`} style={{ color: 'oklch(80% 0.08 240)', fontSize: '12px' }}>
            view public ↗
          </Link>
        )}
        <SaveIndicator status={status} />
      </header>

      <GridCanvas
        interaction={interaction}
        contents={contents}
        activeId={activeId}
        onActivate={setActiveId}
        onContentChange={(blockId, content) => setContents((c) => ({ ...c, [blockId]: content }))}
        onBlockDeleted={(blockId) =>
          setContents((c) => {
            const { [blockId]: _gone, ...rest } = c;
            return rest;
          })
        }
      />
      <Palette interaction={interaction} />
    </div>
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
  return (
    <p style={{ textAlign: 'center', marginTop: '80px', color: danger ? theme.danger : theme.mutedColor }}>{text}</p>
  );
}
