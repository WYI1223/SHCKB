/**
 * Sidebar forest (owner decision 2026-06-12): folders + pages as a
 * tree. Author side gets full CRUD affordances; anonymous side renders
 * the pruned public projection. Tree assembly happens client-side from
 * the flat lists.
 */
import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { api, type TreeFolder } from '../api/client';
import { theme } from '../theme/tokens';
import { useShell } from './Shell';

const SIDEBAR_W = 260;
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

export function Sidebar() {
  const { me, tree, publicTree, refresh } = useShell();
  const navigate = useNavigate();
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [moveMenuFor, setMoveMenuFor] = useState<string | null>(null);

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

  function renderFolder(f: TreeFolder, depth: number): React.JSX.Element {
    const isCollapsed = collapsedFolders.has(f.id);
    return (
      <div key={f.id}>
        <div
          className="skb-row"
          style={{ ...rowStyle(false), paddingLeft: `${8 + depth * INDENT}px`, cursor: 'pointer' }}
          onClick={() => toggleFolder(f.id)}
        >
          <span style={{ fontSize: '9px', width: '12px', color: theme.mutedColor }}>
            {isCollapsed ? '▸' : '▾'}
          </span>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
            {f.name}
          </span>
          {me && (
            <span className="skb-actions" style={{ display: 'flex', gap: '2px' }}>
              <RowAction label={`New page in ${f.name}`} onClick={() => void createPage(f.id)}>＋</RowAction>
              <RowAction label={`New folder in ${f.name}`} onClick={() => void createFolder(f.id)}>📁</RowAction>
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
          className="skb-row"
          style={({ isActive }) => ({ ...rowStyle(isActive), paddingLeft: `${8 + depth * INDENT + 12}px` })}
        >
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {p.title}
          </span>
          {p.badge === 'public' && (
            <span title="public" style={{ fontSize: '10px', color: 'oklch(60% 0.12 145)' }}>●</span>
          )}
          {p.badge === 'private' && (
            <span title="private" style={{ fontSize: '10px', color: theme.mutedColor }}>○</span>
          )}
          {me && (
            <span className="skb-actions" style={{ display: 'flex', gap: '2px' }}>
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
      style={{
        width: `${SIDEBAR_W}px`,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRight: theme.blockBorder,
        background: 'oklch(96.5% 0.005 80)',
        padding: '10px 6px',
        overflow: 'auto',
      }}
    >
      <style>{`
        .skb-row .skb-actions { visibility: hidden; }
        .skb-row:hover .skb-actions { visibility: visible; }
      `}</style>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 6px 10px' }}>
        <Link to="/" style={{ fontWeight: 700, fontSize: '15px', color: theme.textColor, textDecoration: 'none' }}>
          SHCKB
        </Link>
        {me ? (
          <button
            onClick={() => void api.signOut().then(() => (window.location.href = '/'))}
            title={`Signed in as ${me.email}`}
            style={sideButton()}
          >
            Sign out
          </button>
        ) : me === null ? (
          <Link to="/login" style={{ ...sideButton(), textDecoration: 'none', color: theme.accent }}>
            Sign in
          </Link>
        ) : null}
      </div>

      {me && (
        <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
          <button onClick={() => void createPage(null)} style={{ ...newButton(), flex: 1 }}>
            + Page
          </button>
          <button onClick={() => void createFolder(null)} style={{ ...newButton(), flex: 1 }}>
            + Folder
          </button>
        </div>
      )}

      <nav aria-label="Notepages">
        {childFolders(null).map((f) => renderFolder(f, 0))}
        {childPages(null).map((p) => renderPage(p, 0))}
        {me && tree && tree.folders.length === 0 && tree.notepages.length === 0 && (
          <Empty text="No notepages yet." />
        )}
        {me === null && publicTree && publicTree.notepages.length === 0 && (
          <Empty text="Nothing published yet." />
        )}
      </nav>
    </aside>
  );
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
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: `4px 8px 4px ${8 + depth * 12}px`,
        border: 'none',
        background: 'transparent',
        fontSize: '12px',
        color: disabled ? theme.mutedColor : theme.textColor,
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
        background: 'white',
        border: theme.blockBorder,
        borderRadius: '8px',
        boxShadow: '0 4px 16px oklch(0% 0 0 / 15%)',
        padding: '4px 0',
        minWidth: '160px',
        maxHeight: '240px',
        overflow: 'auto',
      }}
    >
      <div style={{ padding: '2px 8px', fontSize: '10px', color: theme.mutedColor, textTransform: 'uppercase' }}>
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
        color: danger ? theme.danger : theme.mutedColor,
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
    padding: '5px 6px',
    borderRadius: '6px',
    fontSize: '13px',
    color: theme.textColor,
    textDecoration: 'none',
    background: active ? 'oklch(92% 0.01 80)' : 'transparent',
    fontWeight: active ? 600 : 400,
  };
}

function sideButton(): React.CSSProperties {
  return {
    background: 'transparent',
    color: theme.mutedColor,
    border: 'none',
    borderRadius: '6px',
    fontSize: '12px',
    cursor: 'pointer',
    padding: '4px 8px',
  };
}

function newButton(): React.CSSProperties {
  return {
    background: 'transparent',
    color: theme.mutedColor,
    border: `1px dashed ${theme.mutedColor}`,
    borderRadius: '6px',
    fontSize: '12px',
    cursor: 'pointer',
    padding: '6px 8px',
  };
}

function Empty({ text }: { text: string }) {
  return <p style={{ color: theme.mutedColor, fontSize: '12px', padding: '4px 10px' }}>{text}</p>;
}
