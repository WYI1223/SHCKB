/**
 * The rack — folder tree + page list in the bench voice (Paste-Up).
 * Author side gets full CRUD affordances (hover-revealed, hairline
 * popovers); the anonymous side renders the pruned public projection
 * with zero instrumentation. Tree assembly happens client-side from
 * the flat lists. The admin back office (instance theme, studio,
 * export/import, blob GC) docks at the rack's foot.
 */
import { useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { THEMES } from '@skb/theme';
import { ApiError, api, importBundle, type TreeFolder } from '../api/client';
import {
  BENCH,
  SectionLabel,
  benchButtonStyle,
  benchSelectStyle,
  labelStyle,
} from '../chrome/bench';
import { useShell } from './Shell';
import { ThemeStudio } from './ThemeStudio';

const SIDEBAR_W = 248;
const INDENT = 14;

type PageItem = {
  key: string;
  to: string;
  title: string;
  folderId: string | null;
  sortKey: number;
  badge?: 'public' | 'private';
  id?: string; // author side only
};

export function Sidebar({ onCollapse }: { onCollapse: () => void }) {
  const { me, tree, publicTree, instanceTheme, customizations, refresh } = useShell();
  const navigate = useNavigate();
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [moveMenuFor, setMoveMenuFor] = useState<string | null>(null);
  const importInput = useRef<HTMLInputElement>(null);

  const folders: TreeFolder[] = (me ? tree?.folders : publicTree?.folders) ?? [];
  const pages: PageItem[] = me
    ? (tree?.notepages ?? []).map((p) => ({
        key: p.id,
        id: p.id,
        to: `/edit/${p.id}`,
        title: p.title,
        folderId: p.folderId,
        sortKey: p.sortKey,
        badge: p.visibility === 'public' && p.hasPublished ? 'public' : 'private',
      }))
    : (publicTree?.notepages ?? []).map((p) => ({
        key: p.slug,
        to: `/read/${p.slug}`,
        title: p.title,
        folderId: p.folderId,
        sortKey: p.sortKey,
      }));

  const childFolders = (parentId: string | null) =>
    folders.filter((f) => f.parentId === parentId);
  const childPages = (folderId: string | null) => pages.filter((p) => p.folderId === folderId);

  function toggleFolder(id: string) {
    setCollapsedFolders((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function createPage(folderId: string | null) {
    const title = window.prompt('Notepage title', 'Untitled');
    if (title === null) return;
    const { id } = await api.createNotepage(title);
    if (folderId) await api.movePage(id, folderId);
    refresh();
    navigate(`/edit/${id}`);
  }

  async function createFolder(parentId: string | null) {
    const name = window.prompt('Folder name', 'New folder');
    if (name === null || name.trim() === '') return;
    await api.createFolder(name.trim(), parentId ?? undefined);
    refresh();
  }

  async function renameFolder(f: TreeFolder) {
    const name = window.prompt('Rename folder', f.name);
    if (name === null || name.trim() === '' || name === f.name) return;
    await api.renameFolder(f.id, name.trim());
    refresh();
  }

  async function deleteFolder(f: TreeFolder) {
    try {
      await api.deleteFolder(f.id);
      refresh();
    } catch {
      window.alert('Folder is not empty — move its contents out first.');
    }
  }

  async function deletePage(p: PageItem) {
    if (!p.id) return;
    if (!window.confirm(`Delete "${p.title}"?`)) return;
    await api.deleteNotepage(p.id);
    refresh();
    navigate('/');
  }

  async function movePageTo(p: PageItem, folderId: string | null) {
    if (!p.id) return;
    setMoveMenuFor(null);
    await api.movePage(p.id, folderId);
    refresh();
  }

  async function importZip(file: File) {
    try {
      const { counts } = await importBundle(file);
      window.alert(
        `Import complete: ${counts.pages} pages, ${counts.folders} folders, ${counts.blocks} blocks, ${counts.blobs} blobs.`,
      );
      refresh();
    } catch (err) {
      const detail = err instanceof ApiError && err.details ? `\n\n${err.details.join('\n')}` : '';
      window.alert(`Import failed: ${err instanceof Error ? err.message : String(err)}${detail}`);
    } finally {
      if (importInput.current) importInput.current.value = '';
    }
  }

  async function runGc() {
    if (!window.confirm('Sweep unreferenced blobs from the store?')) return;
    const { deleted, freedBytes } = await api.gcBlobs();
    window.alert(`Blob GC: removed ${deleted} blob${deleted === 1 ? '' : 's'}, freed ${formatBytes(freedBytes)}.`);
  }

  function renderFolder(f: TreeFolder, depth: number): React.JSX.Element {
    const isCollapsed = collapsedFolders.has(f.id);
    return (
      <div key={f.id}>
        <div
          className="pu-row"
          style={{ ...rowStyle(false), paddingLeft: `${10 + depth * INDENT}px`, cursor: 'pointer' }}
          onClick={() => toggleFolder(f.id)}
        >
          <span
            aria-hidden
            style={{
              fontFamily: BENCH.fontMono,
              fontSize: '8px',
              width: '12px',
              flexShrink: 0,
              color: BENCH.inkFaint,
            }}
          >
            {isCollapsed ? '▸' : '▾'}
          </span>
          <span
            style={{
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontWeight: 600,
              letterSpacing: '0.01em',
            }}
          >
            {f.name}
          </span>
          {me && (
            <span className="pu-actions" style={{ display: 'flex', gap: '1px' }}>
              <RowAction label={`New page in ${f.name}`} onClick={() => void createPage(f.id)}>＋</RowAction>
              <RowAction label={`New folder in ${f.name}`} onClick={() => void createFolder(f.id)}>⊞</RowAction>
              <RowAction label={`Rename ${f.name}`} onClick={() => void renameFolder(f)}>✎</RowAction>
              <RowAction label={`Delete ${f.name}`} onClick={() => void deleteFolder(f)} danger>×</RowAction>
            </span>
          )}
        </div>
        {!isCollapsed && (
          <div>
            {childFolders(f.id).map((sub) => renderFolder(sub, depth + 1))}
            {childPages(f.id).map((p) => renderPage(p, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  function renderPage(p: PageItem, depth: number): React.JSX.Element {
    return (
      <div key={p.key} style={{ position: 'relative' }}>
        <NavLink
          to={p.to}
          className="pu-row"
          style={({ isActive }) => ({ ...rowStyle(isActive), paddingLeft: `${10 + depth * INDENT + 12}px` })}
        >
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {p.title}
          </span>
          {p.badge === 'public' && (
            <span title="published" aria-label="published" style={badgeStyle(BENCH.ink)}>
              pub
            </span>
          )}
          {p.badge === 'private' && (
            <span title="private" aria-label="private" style={badgeStyle(BENCH.inkFaint, true)}>
              —
            </span>
          )}
          {me && (
            <span className="pu-actions" style={{ display: 'flex', gap: '1px' }}>
              <RowAction
                label={`Move ${p.title}`}
                onClick={(e) => {
                  e.preventDefault();
                  setMoveMenuFor(moveMenuFor === p.key ? null : p.key);
                }}
              >
                →
              </RowAction>
              <RowAction
                label={`Delete ${p.title}`}
                onClick={(e) => {
                  e.preventDefault();
                  void deletePage(p);
                }}
                danger
              >
                ×
              </RowAction>
            </span>
          )}
        </NavLink>
        {moveMenuFor === p.key && (
          <MoveMenu
            folders={folders}
            current={p.folderId}
            onPick={(folderId) => void movePageTo(p, folderId)}
            onClose={() => setMoveMenuFor(null)}
          />
        )}
      </div>
    );
  }

  return (
    <aside
      className="pu-scroll"
      style={{
        width: `${SIDEBAR_W}px`,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRight: `1px solid ${BENCH.hairlineDark}`,
        background: BENCH.paper,
        overflow: 'auto',
      }}
    >
      {/* shop sign */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '12px 10px 10px 12px',
          borderBottom: `1px solid ${BENCH.hairline}`,
        }}
      >
        <Link
          to="/"
          style={{
            fontFamily: BENCH.fontMono,
            fontWeight: 700,
            fontSize: '13px',
            letterSpacing: '0.22em',
            color: BENCH.ink,
            textDecoration: 'none',
            flex: 1,
          }}
        >
          SHCKB
        </Link>
        {me ? (
          <button
            onClick={() => void api.signOut().then(() => (window.location.href = '/'))}
            title={`Signed in as ${me.email}`}
            style={quietButton}
          >
            sign out
          </button>
        ) : me === null ? (
          <Link to="/login" style={{ ...quietButton, textDecoration: 'none', color: BENCH.inkSoft }}>
            sign in
          </Link>
        ) : null}
        <button onClick={onCollapse} aria-label="Collapse sidebar" title="Collapse sidebar" style={quietButton}>
          ⟨
        </button>
      </div>

      {me && (
        <div style={{ display: 'flex', gap: '6px', padding: '10px 12px' }}>
          <button onClick={() => void createPage(null)} className="pu-hoverable" style={{ ...benchButtonStyle(), flex: 1 }}>
            + page
          </button>
          <button onClick={() => void createFolder(null)} className="pu-hoverable" style={{ ...benchButtonStyle(), flex: 1 }}>
            + folder
          </button>
        </div>
      )}
      {!me && (
        <div style={{ padding: '12px 12px 4px' }}>
          <span style={labelStyle()}>Published pages</span>
        </div>
      )}

      <nav aria-label="Notepages" style={{ padding: '4px 6px 12px', flex: 1 }}>
        {childFolders(null).map((f) => renderFolder(f, 0))}
        {childPages(null).map((p) => renderPage(p, 0))}
        {me && tree && tree.folders.length === 0 && tree.notepages.length === 0 && (
          <Empty text="The rack is empty — start a page." />
        )}
        {me === null && publicTree && publicTree.notepages.length === 0 && (
          <Empty text="Nothing published yet." />
        )}
      </nav>

      {me?.role === 'admin' && (
        <div
          style={{
            borderTop: `1px solid ${BENCH.hairlineDark}`,
            padding: '10px 12px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            background: BENCH.paperSunken,
          }}
        >
          <SectionLabel style={{ borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }}>
            Back office
          </SectionLabel>
          <select
            value={instanceTheme}
            onChange={(e) => {
              if (!window.confirm('Switch instance theme? All published pages re-render.')) {
                e.target.value = instanceTheme;
                return;
              }
              void api.setInstanceTheme(e.target.value).then(() => refresh());
            }}
            aria-label="Instance theme"
            style={benchSelectStyle()}
          >
            {Object.values(THEMES).map((t) => (
              <option key={t.id} value={t.id}>
                theme · {t.name}
              </option>
            ))}
          </select>
          <ThemeStudio themeId={instanceTheme} customizations={customizations} refresh={refresh} />
          <div style={{ display: 'flex', gap: '5px' }}>
            <a
              href="/api/admin/export"
              download="shckb-export.zip"
              title="Download a full logical export (git-friendly zip)"
              className="pu-hoverable"
              style={{ ...benchButtonStyle(), flex: 1, textAlign: 'center', textDecoration: 'none' }}
            >
              export
            </a>
            <button
              onClick={() => importInput.current?.click()}
              title="Restore a full export into this instance (empty instance only)"
              className="pu-hoverable"
              style={{ ...benchButtonStyle(), flex: 1 }}
            >
              import
            </button>
            <button
              onClick={() => void runGc()}
              title="Delete blobs no page references any more"
              className="pu-hoverable"
              style={{ ...benchButtonStyle(), flex: 1 }}
            >
              blob gc
            </button>
          </div>
          <input
            ref={importInput}
            type="file"
            accept=".zip,application/zip"
            aria-label="Import bundle file"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importZip(file);
            }}
          />
        </div>
      )}
    </aside>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function MoveMenu({
  folders,
  current,
  onPick,
  onClose,
}: {
  folders: TreeFolder[];
  current: string | null;
  onPick: (folderId: string | null) => void;
  onClose: () => void;
}) {
  // flatten with depth for indented listing
  const flat: Array<{ f: TreeFolder; depth: number }> = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const f of folders.filter((x) => x.parentId === parentId)) {
      flat.push({ f, depth });
      walk(f.id, depth + 1);
    }
  };
  walk(null, 0);

  const item = (label: string, value: string | null, depth: number, disabled: boolean) => (
    <button
      key={value ?? '__top'}
      disabled={disabled}
      onClick={() => onPick(value)}
      className={disabled ? undefined : 'pu-row'}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: `4px 10px 4px ${10 + depth * 12}px`,
        border: 'none',
        background: 'transparent',
        fontSize: '12px',
        fontFamily: BENCH.fontUi,
        color: disabled ? BENCH.inkFaint : BENCH.ink,
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      onMouseLeave={onClose}
      style={{
        position: 'absolute',
        right: '4px',
        top: '24px',
        zIndex: 70,
        background: BENCH.paperRaised,
        border: `1px solid ${BENCH.hairlineDark}`,
        borderRadius: '2px',
        padding: '4px 0',
        minWidth: '170px',
        maxHeight: '240px',
        overflow: 'auto',
      }}
    >
      <div style={{ ...labelStyle(), padding: '3px 10px 5px', borderBottom: `1px solid ${BENCH.hairline}` }}>
        Move to
      </div>
      {item('(Top level)', null, 0, current === null)}
      {flat.map(({ f, depth }) => item(f.name, f.id, depth, current === f.id))}
    </div>
  );
}

function RowAction({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: (e: React.MouseEvent) => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      style={{
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        fontSize: '11px',
        padding: '0 3px',
        color: danger ? BENCH.red : BENCH.inkSoft,
        lineHeight: 1.4,
      }}
    >
      {children}
    </button>
  );
}

function rowStyle(active: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 6px',
    borderRadius: '2px',
    fontSize: '13px',
    color: BENCH.ink,
    textDecoration: 'none',
    background: active ? 'rgba(35, 33, 28, 0.08)' : 'transparent',
    fontWeight: active ? 600 : 400,
  };
}

function badgeStyle(color: string, hollow = false): React.CSSProperties {
  return {
    fontFamily: BENCH.fontMono,
    fontSize: '8px',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color,
    border: `1px solid ${hollow ? 'transparent' : color}`,
    borderRadius: '2px',
    padding: '0 3px',
    lineHeight: '12px',
    flexShrink: 0,
  };
}

const quietButton: React.CSSProperties = {
  background: 'transparent',
  color: BENCH.inkFaint,
  border: 'none',
  fontFamily: BENCH.fontMono,
  fontSize: '10px',
  letterSpacing: '0.06em',
  cursor: 'pointer',
  padding: '2px 4px',
};

function Empty({ text }: { text: string }) {
  return <p style={{ color: BENCH.inkFaint, fontSize: '12px', padding: '6px 10px', fontStyle: 'italic' }}>{text}</p>;
}
