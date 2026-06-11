/**
 * Legacy shim: app chrome (Sidebar/Shell/Login/...) keeps these
 * static-default imports; content surfaces use @skb/theme's
 * ThemeContext instead (MVP-4 M4-D6 boundary — chrome theming is
 * theme-system future work).
 */
import {
  blockCardStyle as cardStyle,
  canvasBaseplateStyle as baseStyle,
  graphPaper,
  kindHue as hue,
} from '@skb/theme';

export const theme = { ...graphPaper, kindHue: (kind: string) => hue(graphPaper, kind) };
export const blockCardStyle = (kind: string) => cardStyle(graphPaper, kind);
export const canvasBaseplateStyle = () => baseStyle(graphPaper);
export type Theme = typeof theme;
