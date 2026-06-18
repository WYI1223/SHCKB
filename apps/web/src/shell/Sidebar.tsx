/**
 * The rack — folder tree + page list in the bench voice (Paste-Up).
 * Author-side actions live in row context menus (MVP-8 M8-D3) with one
 * hover affordance kept per row class (new-page on folders); destructive
 * and naming flows go through the chrome overlay dialogs, never
 * window.* (M8-D1). The anonymous side renders the pruned public
 * projection with zero instrumentation — no menus where a reader
 * stands. The admin back office folds into the settings panel (M8-D2);
 * the rack's foot keeps only its entry.
 */
import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { api, type TreeFolder } from '../api/client';
import {
  BENCH,
  benchButtonStyle,
  labelStyle,
} from '../chrome/bench';
import { useOverlays, type MenuItem } from '../chrome/overlays';
import { useShell } from './Shell';
import { SettingsPanel } from './SettingsPanel';

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
  const { me, tree, publicTree, refresh } = useShell();
  const overlays = useOverlays();
  const navigate = useNavigate();
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [settingsOpen, setSettingsOpen] = useState(false);

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
        key: p.id,
        to: `/read/${p.id}`,
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
    const title = await overlays.prompt({ title: 'new page', message: 'Notepage title', initial: 'Untitled' });
    if (title === null) return;
    const { id } = await api.createNotepage(title);
    if (folderId) await api.movePage(id, folderId);
    refresh();
    navigate(`/edit/${id}`);
  }

  async function createFolder(parentId: string | null) {
    const name = await overlays.prompt({ title: 'new folder', message: 'Folder name', initial: 'New folder' });
    if (name === null || name.trim() === '') return;
    await api.createFolder(name.trim(), parentId ?? undefined);
    refresh();
  }

  async function renameFolder(f: TreeFolder) {
    const name = await overlays.prompt({ title: 'rename folder', initial: f.name });
    if (name === null || name.trim() === '' || name === f.name) return;
    await api.renameFolder(f.id, name.trim());
    refresh();
  }

  async function deleteFolder(f: TreeFolder) {
    try {
      await api.deleteFolder(f.id);
      refresh();
    } catch {
      await overlays.alert({
        title: 'cannot delete',
        message: 'Folder is not empty — move its contents out first.',
      });
    }
  }

  async function deletePage(p: PageItem) {
    if (!p.id) return;
    const ok = await overlays.confirm({
      title: 'delete page',
      message: `Delete "${p.title}"?`,
      confirmLabel: 'delete',
      danger: true,
    });
    if (!ok) return;
    await api.deleteNotepage(p.id);
    refresh();
    navigate('/');
  }

  async function movePageTo(p: PageItem, folderId: string | null) {
    if (!p.id) return;
    await api.movePage(p.id, folderId);
    refresh();
  }

  /** Flatten the folder forest with depth — indented move-to listing. */
  function flatFolders(): Array<{ f: TreeFolder; depth: number }> {
    const flat: Array<{ f: TreeFolder; depth: number }> = [];
    const walk = (parentId: string | null, depth: number) => {
      for (const f of folders.filter((x) => x.parentId === parentId)) {
        flat.push({ f, depth });
        walk(f.id, depth + 1);
      }
    };
    walk(null, 0);
    return flat;
  }

  function moveItems(p: PageItem): MenuItem[] {
    return [
      { label: '(top level)', onSelect: () => void movePageTo(p, null), disabled: p.folderId === null },
      ...flatFolders().map(({ f, depth }) => ({
        label: f.name,
        indent: depth,
        disabled: p.folderId === f.id,
        onSelect: () => void movePageTo(p, f.id),
      })),
    ];
  }

  /** Cursor point for real clicks; element anchor for keyboard (0,0). */
  function menuAnchor(e: React.MouseEvent) {
    return e.clientX || e.clientY ? { x: e.clientX, y: e.clientY } : (e.currentTarget as HTMLElement);
  }

  function openFolderMenu(e: React.MouseEvent, f: TreeFolder) {
    e.preventDefault();
    overlays.menu(
      menuAnchor(e),
      [
        { label: 'new page here', onSelect: () => void createPage(f.id) },
        { label: 'new folder here', onSelect: () => void createFolder(f.id) },
        { label: 'rename…', onSelect: () => void renameFolder(f) },
        { kind: 'separator' },
        { label: 'delete', danger: true, onSelect: () => void deleteFolder(f) },
      ],
      { header: f.name },
    );
  }

  function openPageMenu(e: React.MouseEvent, p: PageItem) {
    e.preventDefault();
    const anchor = menuAnchor(e);
    overlays.menu(
      anchor,
      [
        { label: 'move to…', onSelect: () => overlays.menu(anchor, moveItems(p), { header: 'move to' }) },
        { kind: 'separator' },
        { label: 'delete…', danger: true, onSelect: () => void deletePage(p) },
      ],
      { header: p.title },
    );
  }

  function renderFolder(f: TreeFolder, depth: number): React.JSX.Element {
    const isCollapsed = collapsedFolders.has(f.id);
    return (
      <div key={f.id}>
        <div
          className="pu-row"
          style={{ ...rowStyle(false), paddingLeft: `${10 + depth * INDENT}px`, cursor: 'pointer' }}
          onClick={() => toggleFolder(f.id)}
          onContextMenu={me ? (e) => openFolderMenu(e, f) : undefined}
          title={me ? 'Right-click for folder actions' : undefined}
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
              <RowAction label={`Actions for ${f.name}`} onClick={(e) => openFolderMenu(e, f)}>⋯</RowAction>
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
      <NavLink
        key={p.key}
        to={p.to}
        className="pu-row"
        style={({ isActive }) => ({ ...rowStyle(isActive), paddingLeft: `${10 + depth * INDENT + 12}px` })}
        onContextMenu={me ? (e) => openPageMenu(e, p) : undefined}
        title={me ? 'Right-click for page actions' : undefined}
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
              label={`Actions for ${p.title}`}
              onClick={(e) => {
                e.preventDefault();
                openPageMenu(e, p);
              }}
            >
              ⋯
            </RowAction>
          </span>
        )}
      </NavLink>
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
            padding: '8px 12px',
            background: BENCH.paperSunken,
          }}
        >
          <button
            onClick={() => setSettingsOpen(true)}
            className="pu-hoverable"
            title="Instance settings: theme, customization, export/import, blob GC"
            style={{ ...benchButtonStyle(), width: '100%' }}
          >
            settings
          </button>
        </div>
      )}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </aside>
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
