/**
 * Workspace shell — the paste-up room (ui-fork/free). Three-zone bench:
 * the rack (directory) on the left, the light table (main pane) center;
 * the editor adds its own spec sheet rail. Chrome holds ONE fixed
 * bone/graphite palette regardless of the content theme — the themed
 * canvas is a sheet on the bench, never the room itself.
 *
 * Auth-aware: authors see the full directory and open the editor in the
 * pane; anonymous visitors see the public directory (zero
 * instrumentation — no blue where a reader stands).
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
import { ThemeProvider, type ThemeCustomization } from '@skb/theme';
import { BENCH, BenchStyle, benchTheme } from '../chrome/bench';
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

  return (
    <ShellContext.Provider value={{ me, tree, publicTree, instanceTheme, customizations, refresh }}>
      {/* the bench is the ambient theme: ui-kit primitives and any
          un-provided surface render in the chrome voice; content
          surfaces (editor canvas, read pane) re-provide the page's
          effective theme inside. */}
      <ThemeProvider theme={benchTheme}>
        <div
          className="pu-chrome"
          style={{
            display: 'flex',
            height: '100vh',
            overflow: 'hidden',
            fontFamily: BENCH.fontUi,
            background: BENCH.paper,
            color: BENCH.ink,
          }}
        >
          <BenchStyle />
          {collapsed ? (
            <div
              style={{
                width: '30px',
                flexShrink: 0,
                borderRight: `1px solid ${BENCH.hairlineDark}`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                paddingTop: '10px',
              }}
            >
              <button
                onClick={() => setCollapsed(false)}
                aria-label="Open sidebar"
                title="Open sidebar"
                style={railToggleStyle}
              >
                ⟩
              </button>
            </div>
          ) : (
            <Sidebar onCollapse={() => setCollapsed(true)} />
          )}
          <main style={{ flex: 1, minWidth: 0, overflow: 'auto', background: BENCH.paper }} className="pu-scroll">
            <Outlet />
          </main>
        </div>
      </ThemeProvider>
    </ShellContext.Provider>
  );
}

const railToggleStyle: React.CSSProperties = {
  width: '20px',
  height: '20px',
  border: 'none',
  background: 'transparent',
  color: BENCH.inkFaint,
  cursor: 'pointer',
  fontSize: '12px',
  lineHeight: 1,
  padding: 0,
};
