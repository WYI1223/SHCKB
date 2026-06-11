import { Link, NavLink, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { theme } from '../theme/tokens';
import { useShell } from './Shell';

const SIDEBAR_W = 260;

export function Sidebar() {
  const { me, pages, publicNotes, refresh } = useShell();
  const navigate = useNavigate();

  async function create() {
    const title = window.prompt('Notepage title', 'Untitled');
    if (title === null) return;
    const { id } = await api.createNotepage(title);
    refresh();
    navigate(`/edit/${id}`);
  }

  async function remove(id: string, title: string) {
    if (!window.confirm(`Delete "${title}"?`)) return;
    await api.deleteNotepage(id);
    refresh();
    navigate('/');
  }

  const itemStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 10px',
    borderRadius: '6px',
    fontSize: '13px',
    color: theme.textColor,
    textDecoration: 'none',
    background: active ? 'oklch(92% 0.01 80)' : 'transparent',
    fontWeight: active ? 600 : 400,
  });

  return (
    <aside
      style={{
        width: `${SIDEBAR_W}px`,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRight: theme.blockBorder,
        background: 'oklch(96.5% 0.005 80)',
        padding: '10px',
        gap: '4px',
        overflow: 'auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '2px 6px 10px 6px',
        }}
      >
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
        <button
          onClick={() => void create()}
          style={{
            ...sideButton(),
            border: `1px dashed ${theme.mutedColor}`,
            padding: '7px 10px',
            textAlign: 'left',
            marginBottom: '6px',
          }}
        >
          + New notepage
        </button>
      )}

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }} aria-label="Notepages">
        {/* author directory */}
        {me &&
          pages?.map((p) => (
            <NavLink key={p.id} to={`/edit/${p.id}`} style={({ isActive }) => itemStyle(isActive)}>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.title}
              </span>
              {p.visibility === 'public' && p.hasPublished && (
                <span title="public" style={{ fontSize: '10px', color: 'oklch(60% 0.12 145)' }}>
                  ●
                </span>
              )}
              {p.visibility === 'private' && (
                <span title="private" style={{ fontSize: '10px', color: theme.mutedColor }}>
                  ○
                </span>
              )}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  void remove(p.id, p.title);
                }}
                aria-label={`Delete ${p.title}`}
                style={{ ...sideButton(), padding: '0 4px', color: theme.danger, border: 'none' }}
              >
                ×
              </button>
            </NavLink>
          ))}
        {me && pages?.length === 0 && <Empty text="No notepages yet." />}

        {/* anonymous public directory */}
        {me === null &&
          publicNotes?.map((n) => (
            <NavLink key={n.slug} to={`/read/${n.slug}`} style={({ isActive }) => itemStyle(isActive)}>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {n.title}
              </span>
            </NavLink>
          ))}
        {me === null && publicNotes?.length === 0 && <Empty text="Nothing published yet." />}
      </nav>
    </aside>
  );
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

function Empty({ text }: { text: string }) {
  return <p style={{ color: theme.mutedColor, fontSize: '12px', padding: '4px 10px' }}>{text}</p>;
}
