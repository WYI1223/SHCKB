import { createContext, useContext, type ReactNode } from 'react';
import { graphPaper, type Theme } from './themes';

/** Content surfaces read the active theme from here; the default keeps
 * un-providered trees (and app chrome) on graph-paper. */
export const ThemeContext = createContext<Theme>(graphPaper);

export function ThemeProvider({ theme, children }: { theme: Theme; children: ReactNode }) {
  return (
    <ThemeContext.Provider value={theme}>
      {theme.globalCss ? <style>{theme.globalCss}</style> : null}
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
