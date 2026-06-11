import { theme } from '../theme/tokens';
import { useShell } from '../shell/Shell';

export function WelcomePane() {
  const { me } = useShell();
  return (
    <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: theme.mutedColor }}>
        <div style={{ fontSize: '40px', marginBottom: '8px' }}>¶</div>
        <p style={{ fontSize: '14px', margin: 0 }}>
          {me
            ? 'Select a notepage from the sidebar, or create a new one.'
            : 'Select a published notepage from the sidebar to read it.'}
        </p>
      </div>
    </div>
  );
}
