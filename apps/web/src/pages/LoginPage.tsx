import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { useTheme } from '@skb/theme';

export function LoginPage() {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.signIn(email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? 'Wrong email or password.' : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  }

  const field: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    border: theme.blockBorder,
    borderRadius: '8px',
    fontSize: '14px',
    color: theme.textColor,
    background: 'white',
  };

  return (
    <div style={{ maxWidth: '360px', margin: '12vh auto 0', padding: '0 20px', color: theme.textColor }}>
      <h1 style={{ fontSize: '22px', marginBottom: '4px' }}>SHCKB</h1>
      <p style={{ color: theme.mutedColor, fontSize: '13px', marginTop: 0 }}>Sign in to your instance</p>
      <form onSubmit={(e) => void submit(e)} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <input
          type="email"
          required
          placeholder="Email"
          aria-label="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={field}
        />
        <input
          type="password"
          required
          placeholder="Password"
          aria-label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={field}
        />
        {error && <p style={{ color: theme.danger, fontSize: '13px', margin: 0 }}>{error}</p>}
        <button
          type="submit"
          disabled={busy}
          style={{
            background: theme.accent,
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 16px',
            fontSize: '14px',
            cursor: busy ? 'wait' : 'pointer',
          }}
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
