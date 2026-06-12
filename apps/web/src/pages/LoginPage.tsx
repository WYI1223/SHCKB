/**
 * The shop door — sign-in on bone paper. Registration is presented as
 * a fact of the trade (single-author press), not an apology. Standalone
 * route: carries the bench voice itself (no shell around it).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { BENCH, BenchStyle, labelStyle, pressButtonStyle } from '../chrome/bench';

export function LoginPage() {
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
    padding: '9px 11px',
    border: `1px solid ${BENCH.hairlineDark}`,
    borderRadius: '2px',
    fontSize: '13px',
    fontFamily: BENCH.fontUi,
    color: BENCH.ink,
    background: BENCH.paperRaised,
    outline: 'none',
  };

  return (
    <div
      className="pu-chrome"
      style={{
        minHeight: '100vh',
        background: BENCH.paper,
        color: BENCH.ink,
        fontFamily: BENCH.fontUi,
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <BenchStyle />
      <div style={{ width: '320px', margin: '18vh 20px 0' }}>
        {/* shop sign */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ borderTop: `1px solid ${BENCH.ink}`, borderBottom: `1px solid ${BENCH.hairlineDark}`, padding: '14px 0 12px', borderWidth: '2px 0 1px' }}>
            <span
              style={{
                fontFamily: BENCH.fontMono,
                fontSize: '20px',
                fontWeight: 700,
                letterSpacing: '0.35em',
                marginRight: '-0.35em',
              }}
            >
              SHCKB
            </span>
          </div>
          <p style={{ ...labelStyle({ fontSize: '9px' }), marginTop: '10px' }}>
            self-hosted canvas knowledge base
          </p>
        </div>

        <form onSubmit={(e) => void submit(e)} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={labelStyle({ fontSize: '8px' })}>email</span>
            <input
              type="email"
              required
              aria-label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={field}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={labelStyle({ fontSize: '8px' })}>password</span>
            <input
              type="password"
              required
              aria-label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={field}
            />
          </label>
          {error && (
            <p style={{ color: BENCH.red, fontSize: '12px', fontFamily: BENCH.fontMono, margin: 0 }}>{error}</p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="pu-press"
            style={{ ...pressButtonStyle(), padding: '10px 14px', cursor: busy ? 'wait' : 'pointer', marginTop: '4px' }}
          >
            {busy ? 'signing in…' : 'sign in'}
          </button>
        </form>

        <p
          style={{
            marginTop: '28px',
            textAlign: 'center',
            fontSize: '11px',
            color: BENCH.inkFaint,
            fontStyle: 'italic',
          }}
        >
          A single-author press — there is no registration.
        </p>
      </div>
    </div>
  );
}
