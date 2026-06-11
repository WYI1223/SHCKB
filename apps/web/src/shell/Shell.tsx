/**
 * Workspace shell (owner decision 2026-06-12): persistent sidebar
 * directory + main pane, Notion-like. UI form factor only — route-class
 * behavior and the standalone public share page are unchanged.
 *
 * Auth-aware: authors see the full directory and open the editor in the
 * pane; anonymous visitors see the public directory and read published
 * pages in the pane.
 */
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { api, type Me, type NotepageSummary } from '../api/client';
import { theme } from '../theme/tokens';
import { Sidebar } from './Sidebar';

export type PublicNote = { slug: string; title: string; publishedAt: number };

type ShellState = {
  me: Me | null | undefined; // undefined = loading
  pages: NotepageSummary[] | null;
  publicNotes: PublicNote[] | null;
  /** Re-fetch the directory (call after create/delete/rename/publish). */
  refresh: () => void;
};

const ShellContext = createContext<ShellState | null>(null);

export function useShell(): ShellState {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error('useShell outside Shell');
  return ctx;
}

export function Shell() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [pages, setPages] = useState<NotepageSummary[] | null>(null);
  const [publicNotes, setPublicNotes] = useState<PublicNote[] | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const refresh = useCallback(() => {
    api
      .me()
      .then(({ user }) => {
        setMe(user);
        return user
          ? api.listNotepages().then((r) => setPages(r.notepages))
          : api.listPublicNotes().then((r) => setPublicNotes(r.notes));
      })
      .catch(() => setMe(null));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <ShellContext.Provider value={{ me, pages, publicNotes, refresh }}>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        {!collapsed && <Sidebar />}
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Open sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Open sidebar' : 'Collapse sidebar'}
          style={{
            position: 'fixed',
            left: collapsed ? '8px' : '266px',
            top: '10px',
            zIndex: 60,
            width: '24px',
            height: '24px',
            border: 'none',
            borderRadius: '6px',
            background: 'transparent',
            color: theme.mutedColor,
            cursor: 'pointer',
            fontSize: '14px',
            lineHeight: 1,
          }}
        >
          {collapsed ? '☰' : '⟨'}
        </button>
        <main style={{ flex: 1, minWidth: 0, overflow: 'auto', background: theme.canvasBg }}>
          <Outlet />
        </main>
      </div>
    </ShellContext.Provider>
  );
}
