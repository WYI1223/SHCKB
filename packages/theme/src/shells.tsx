/**
 * Generic shell frames any token-only theme can curate (M6-D3). A
 * theme opts in by listing them in its `shells` map — declaration is
 * implementation, there is no second branch to keep in sync.
 */
import { useTheme } from './context';
import { blockOverflow, type BlockFrameProps } from './themes';

/** 'flat': no card chrome — content sits directly on the canvas. */
export function FlatShellFrame({ kind, shell, autofit, children }: BlockFrameProps) {
  const theme = useTheme();
  return (
    <div
      className="skb-block"
      data-kind={kind}
      data-shell={shell ?? undefined}
      style={{
        padding: '8px 10px',
        width: '100%',
        height: '100%',
        overflow: blockOverflow(autofit),
        fontSize: '14px',
        lineHeight: 1.55,
        color: theme.textColor,
      }}
    >
      {children}
    </div>
  );
}
