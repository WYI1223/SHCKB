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
import {
  api,
  type Me,
  type PublicTreePage,
  type TreeFolder,
  type TreePage,
} from '../api/client';
import {
  THEMES,
  ThemeProvider,
  applyCustomization,
  graphPaper,
  type ThemeCustomization,
} from '@skb/theme';
import { Sidebar } from './Sidebar';

type ShellState = {
  me: Me | null | undefined; // undefined = loading
  /** author forest (authenticated) */
  tree: { folders: TreeFolder[]; notepages: TreePage[] } | null;
  /** public projection (anonymous) */
  publicTree: { folders: TreeFolder[]; notepages: PublicTreePage[] } | null;
  /** active instance theme id (content surfaces resolve effective theme from it) */
  instanceTheme: string;
  /** operator theme customization, keyed by themeId (M5-D3); authors
   * get the full map, anonymous visitors only the instance theme's */
  customizations: Record<string, ThemeCustomization>;
  /** Re-fetch the directory (call after create/delete/rename/publish/move). */
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
  const [tree, setTree] = useState<ShellState['tree']>(null);
  const [publicTree, setPublicTree] = useState<ShellState['publicTree']>(null);
  const [instanceTheme, setInstanceTheme] = useState('graph-paper');
  const [customizations, setCustomizations] = useState<Record<string, ThemeCustomization>>({});
  const [collapsed, setCollapsed] = useState(false);

  const refresh = useCallback(() => {
    api
      .getPublicInstance()
      .then(({ theme, customization }) => {
        setInstanceTheme(theme);
        if (customization) setCustomizations((c) => ({ ...c, [theme]: customization }));
      })
      .catch(() => undefined);
    api
      .me()
      .then(({ user }) => {
        setMe(user);
        if (user) {
          // authors see all themes in pickers — fetch the full map
          api.getSettings().then(({ customizations: all }) => setCustomizations(all)).catch(() => undefined);
          return api.getTree().then(setTree);
        }
        return api.getPublicTree().then(setPublicTree);
      })
      .catch(() => setMe(null));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Chrome follows the INSTANCE theme's tokens (owner decision
  // 2026-06-12, revising M4-D6); content surfaces re-provide the
  // page's effective theme inside. Operator customization composes
  // here too — chrome and content read the same effective tokens.
  const instTheme = applyCustomization(THEMES[instanceTheme] ?? graphPaper, customizations[instanceTheme]);

  return (
    <ShellContext.Provider value={{ me, tree, publicTree, instanceTheme, customizations, refresh }}>
      <ThemeProvider theme={instTheme}>
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: instTheme.fontFamily }}>
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
              color: instTheme.mutedColor,
              cursor: 'pointer',
              fontSize: '14px',
              lineHeight: 1,
            }}
          >
            {collapsed ? '☰' : '⟨'}
          </button>
          <main style={{ flex: 1, minWidth: 0, overflow: 'auto', background: instTheme.canvasBg }}>
            <Outlet />
          </main>
        </div>
      </ThemeProvider>
    </ShellContext.Provider>
  );
}
