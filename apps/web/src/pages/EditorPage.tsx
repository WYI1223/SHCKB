/**
 * Authoring surface (notepage-editing.md) in the Paste-Up bench: a
 * job-ticket strip on top (title → instruments → state stamps → the
 * press action), the galley tray on the left, the themed sheet on the
 * light table center, and the spec sheet (Properties) rail on the
 * right. Hosts the grid interaction + block content as author working
 * state, autosaves it (debounced), and exposes the explicit
 * update-public action that promotes the working state to the public
 * snapshot. Block content changes never touch GridState geometry —
 * they live in a separate contents map joined at save time.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Block } from '@skb/grid-engine';
import { api, ApiError, uploadBlob, type NotepageDetail, type WorkingBlock } from '../api/client';
import { blockModule, defaultSizeFor, HostContext, type HostServices } from '@skb/block-kinds';
import { THEMES, ThemeProvider, applyCustomization, graphPaper, type PageBackground } from '@skb/theme';
import { BENCH, labelStyle, pressButtonStyle, stampStyle } from '../chrome/bench';
import { useOverlays } from '../chrome/overlays';
import { GridCanvas } from '../grid/GridCanvas';
import { Palette } from '../grid/Palette';
import { Properties, type Selection } from '../grid/Properties';
import { useGridInteraction } from '../grid/useGridInteraction';
import { useAutosave } from '../hooks/useAutosave';
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
  const overlays = useOverlays();

  // Host capability surface for block kinds (plugin seam). listPages +
  // promptText are the M9 stress-test additions — kinds reach the page
  // directory and host dialogs only through here, never via chrome.
  const hostServices = useMemo<HostServices>(
    () => ({
      uploadBlob,
      listPages: async () => {
        const { notepages } = await api.getTree();
        return notepages.filter((p) => p.id !== pageId).map((p) => ({ id: p.id, title: p.title }));
      },
      promptText: (opts) => overlays.prompt(opts),
      // the universal menu face on loan (M9-D3): HostMenuItem mirrors
      // the chrome MenuItem shape, so this is a pass-through
      menu: (anchor, items, opts) => overlays.menu(anchor, items, opts),
    }),
    [pageId, overlays],
  );
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
  // Restraint discipline (M7-D7, ported from Marginalia): low-frequency
  // settings live folded away; the press action keeps its weight.
  const [instrumentsOpen, setInstrumentsOpen] = useState(false);
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
    // Seed the follow/fix mode from the server. The DB is not yet migrated
    // (a later phase), so coerce the legacy enum ROBUSTLY: any growing value
    // → follow; off/null/already-fix → fix (the safe fixed-height fallback).
    initialAutofit: useMemo(() => {
      // `af` is widened to string because the wire value may still be a
      // legacy enum ('grow'/'grow+shrink'/'off') until the DB migration.
      const toMode = (af: string | null | undefined): 'follow' | 'fix' =>
        af === 'grow' || af === 'grow+shrink' || af === 'follow' ? 'follow' : 'fix';
      return Object.fromEntries(detail.blocks.map((b) => [b.id, toMode(b.autofit as string | null | undefined)]));
    }, [detail.blocks]),
    onBlockInserted: (block: Block) => {
      const mod = blockModule(block.kind);
      setContents((c) => ({ ...c, [block.id]: mod ? mod.createContent() : null }));
      const af = mod?.autofit;
      if (af) interaction.setAutofit(block.id, af.default);
    },
  });

  // ----- autosave (debounced) -----
  const save = useCallback(async (): Promise<boolean> => {
    // ATOMICITY / CORRECTNESS (spec §4.4 手势边界): the grown interim is
    // non-gravity-stable (a neighbor was pushed down with gravity suspended),
    // and the server PUT runs validateState({ gravity: true }) which REJECTS
    // a non-stable layout on gravity-on pages (422). So we NEVER PUT the
    // grown interim. While a block is active its autofit gesture owns the
    // layout; the gesture commits on deactivation (Escape/blur) or typing-idle
    // debounce — the controller runs the commit-recompact applyGravity once
    // (gravity-on pages) and ONLY that gravity-stable committed state is PUT.
    // Reversibility is therefore scoped to one active editing session / burst.
    if (activeId !== null) return true; // treat as a no-op success; re-armed on next change
    setStatus({ kind: 'saving' });
    const blocks: WorkingBlock[] = interaction.state.blocks.map((b) => ({
      ...b,
      shell: shellsRef.current[b.id] ?? null,
      // mode string ('follow'|'fix'); every block resolves to a mode, but
      // fall back to 'fix' (the safe fixed-height value) if somehow unseeded.
      autofit: interaction.autofit[b.id] === 'follow' ? 'follow' : 'fix',
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
      return true;
    } catch (e) {
      if (e instanceof ApiError) {
        setStatus({ kind: 'error', message: e.message, details: e.details });
      } else {
        setStatus({ kind: 'error', message: 'network error — changes not saved' });
      }
      return false;
    }
  }, [pageId, title, interaction.state, interaction.gravityEnabled, interaction.autofit, activeId]);

  useAutosave({
    save,
    deps: [contents, shells],
    ms: AUTOSAVE_MS,
    onDirty: () => setStatus((s) => (s.kind === 'error' ? s : { kind: 'dirty' })),
  });

  // Escape deactivates the active block (focus-leave → preview).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setActiveId]);

  // Header/inspector actions surface failures in the save indicator —
  // a failed publish must never read as success (E2, mvp7 review).
  async function runAction(label: string, fn: () => Promise<void>) {
    try {
      await fn();
    } catch (e) {
      const message = e instanceof ApiError ? `${label}: ${e.message}` : `${label} failed — network error`;
      setStatus({ kind: 'error', message, details: e instanceof ApiError ? e.details : undefined });
    }
  }

  async function changeBackground(bg: PageBackground | null) {
    await runAction('background', async () => {
      await api.setPageBackground(pageId, bg);
      setBackground(bg);
    });
  }

  async function publish() {
    if (!(await save())) return; // unsaved working state must not promote stale data
    await runAction('publish', async () => {
      const res = await api.publish(pageId);
      setSlug(res.slug);
      setHasPublished(true);
      shell.refresh();
    });
  }

  async function copyLink() {
    await runAction('copy link', async () => {
      await navigator.clipboard.writeText(`${window.location.origin}/notes/${slug}`);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1500);
    });
  }

  async function toggleVisibility() {
    const next = visibility === 'public' ? 'private' : 'public';
    await runAction('visibility', async () => {
      await api.setVisibility(pageId, next);
      setVisibility(next);
      shell.refresh();
    });
  }

  async function pinTheme(next: string | null) {
    await runAction('theme pin', async () => {
      await api.setPageTheme(pageId, next);
      setThemeId(next);
    });
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
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        {/* ---- job ticket ---- */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '9px 14px',
            background: BENCH.paper,
            borderBottom: `1px solid ${BENCH.hairlineDark}`,
            color: BENCH.ink,
            flexShrink: 0,
            fontFamily: BENCH.fontUi,
          }}
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Notepage title"
            style={{
              flex: 1,
              minWidth: '120px',
              background: 'transparent',
              border: 'none',
              borderBottom: `1px solid transparent`,
              color: BENCH.ink,
              fontSize: '18px',
              fontWeight: 650,
              fontFamily: BENCH.fontUi,
              letterSpacing: '-0.01em',
              padding: '2px 0',
              outline: 'none',
            }}
            onFocus={(e) => (e.currentTarget.style.borderBottom = `1px solid ${BENCH.blueBright}`)}
            onBlur={(e) => (e.currentTarget.style.borderBottom = '1px solid transparent')}
          />

          {/* instruments fold-out toggle — settings stay quiet (M7-D7),
              only the press action carries weight on the strip */}
          <button
            onClick={() => setInstrumentsOpen((v) => !v)}
            aria-expanded={instrumentsOpen}
            title="Page instruments: gravity, theme pin, visibility, links"
            style={{
              ...labelStyle({ color: instrumentsOpen ? BENCH.blueBright : BENCH.blue }),
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '2px 0',
            }}
          >
            {instrumentsOpen ? 'instruments ▾' : 'instruments ▸'}
          </button>

          <span aria-hidden style={{ width: '1px', alignSelf: 'stretch', background: BENCH.hairlineDark }} />

          {/* state stamp + the one heavy action */}
          <SaveStamp status={status} />
          <button
            onClick={() => void publish()}
            className="pu-press"
            title={
              hasPublished
                ? 'Print a new public edition from the current working state'
                : 'Publish this page — readers see only explicitly published editions'
            }
            style={pressButtonStyle()}
          >
            {hasPublished ? 'republish' : 'publish'}
          </button>
        </header>

        {/* ---- instruments drawer (folded by default) ---- */}
        {instrumentsOpen && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '7px 14px',
              background: BENCH.paperSunken,
              borderBottom: `1px solid ${BENCH.hairlineDark}`,
              flexShrink: 0,
              fontFamily: BENCH.fontUi,
            }}
          >
            <label
              title="Blocks float up to fill gaps"
              style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', ...labelStyle({ color: BENCH.blue }) }}
            >
              <input
                type="checkbox"
                checked={interaction.gravityEnabled}
                onChange={(e) => interaction.setGravityEnabled(e.target.checked)}
                style={{ accentColor: BENCH.blue, margin: 0 }}
              />
              gravity
            </label>
            <select
              value={themeId ?? ''}
              onChange={(e) => void pinTheme(e.target.value === '' ? null : e.target.value)}
              title="Page theme (instance = follow the instance theme)"
              aria-label="Page theme"
              style={{
                fontFamily: BENCH.fontMono,
                fontSize: '10px',
                letterSpacing: '0.04em',
                color: BENCH.inkSoft,
                background: 'transparent',
                border: `1px solid ${BENCH.hairlineDark}`,
                borderRadius: '2px',
                padding: '4px 5px',
                cursor: 'pointer',
                maxWidth: '170px',
              }}
            >
              <option value="">theme · instance</option>
              {Object.values(THEMES).map((t) => (
                <option key={t.id} value={t.id}>
                  theme · {t.name} (pinned)
                </option>
              ))}
            </select>
            <button
              onClick={toggleVisibility}
              title={visibility === 'public' ? 'Page is public — click to make private' : 'Page is private — click to make public'}
              style={{ ...stampStyle(visibility === 'public' ? BENCH.ink : BENCH.inkFaint), cursor: 'pointer' }}
            >
              {visibility}
            </button>
            {visibility === 'public' && hasPublished && (
              <>
                <Link
                  to={`/notes/${slug}`}
                  title="Open the published page"
                  style={{ ...labelStyle({ color: BENCH.inkSoft }), textDecoration: 'none' }}
                >
                  view ↗
                </Link>
                <button
                  onClick={() => void copyLink()}
                  title="Copy the public link"
                  style={{ ...labelStyle({ color: linkCopied ? BENCH.ink : BENCH.inkSoft }), background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  {linkCopied ? 'copied ✓' : 'copy link'}
                </button>
              </>
            )}
          </div>
        )}
        {status.kind === 'error' && (
          <div
            role="alert"
            style={{
              flexShrink: 0,
              padding: '5px 14px',
              background: BENCH.redWash,
              borderBottom: `1px solid ${BENCH.red}`,
              color: BENCH.red,
              fontFamily: BENCH.fontMono,
              fontSize: '11px',
            }}
            title={status.details?.join('\n')}
          >
            {status.message}
          </div>
        )}

        {/* ---- bench row: tray · light table · spec sheet ---- */}
        <HostContext.Provider value={hostServices}>
          <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
            <Palette interaction={interaction} />
            <div className="pu-scroll" style={{ flex: 1, minWidth: 0, overflow: 'auto', background: BENCH.paperSunken }}>
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
                onShellChange={(blockId, shell) => setShells((s) => ({ ...s, [blockId]: shell }))}
                onBackgroundChange={(bg) => void changeBackground(bg)}
              />
            </div>
            <Properties
              selection={selection}
              interaction={interaction}
              contents={contents}
              shells={shells}
              background={background}
              onContentChange={(blockId, content) => setContents((c) => ({ ...c, [blockId]: content }))}
              onShellChange={(blockId, shell) => setShells((s) => ({ ...s, [blockId]: shell }))}
              onBackgroundChange={(bg) => void changeBackground(bg)}
            />
          </div>
        </HostContext.Provider>
      </div>
    </ThemeProvider>
  );
}

/** Proofing stamp for the save state — never a toast, never a spinner. */
function SaveStamp({ status }: { status: SaveStatus }) {
  if (status.kind === 'error') {
    return (
      <span title={status.details?.join('\n') ?? status.message} style={stampStyle(BENCH.red)}>
        ⚠ error
      </span>
    );
  }
  const text = status.kind === 'saved' ? 'saved' : status.kind === 'saving' ? 'saving' : 'edited';
  const color = status.kind === 'saved' ? BENCH.inkFaint : BENCH.inkSoft;
  return <span style={stampStyle(color)}>{text}</span>;
}

function PageMessage({ text, danger }: { text: string; danger?: boolean }) {
  return (
    <p
      style={{
        textAlign: 'center',
        marginTop: '80px',
        color: danger ? BENCH.red : BENCH.inkSoft,
        fontFamily: BENCH.fontUi,
        fontSize: '13px',
      }}
    >
      {text}
    </p>
  );
}
