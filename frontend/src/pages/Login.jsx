import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Notice, errMsg } from '../ui.jsx';

let gsiPromise;
function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  gsiPromise ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = resolve;
    s.onerror = () => {
      gsiPromise = null;
      reject(new Error('Could not load Google sign-in.'));
    };
    document.head.appendChild(s);
  });
  return gsiPromise;
}

export default function Login() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [config, setConfig] = useState(null);
  const [error, setError] = useState('');
  const buttonRef = useRef(null);
  const from = location.state?.from || '/';

  useEffect(() => {
    api
      .get('/config')
      .then(setConfig)
      .catch((e) => setError(errMsg(e)));
  }, []);

  const isDev = config?.googleClientId === 'dev-mode';

  const handleDevLogin = async (role) => {
    setError('');
    const cred =
      role === 'author'
        ? { email: 'author@example.com', sub: 'dev-author', name: 'The Author (Dev)' }
        : { email: 'reviewer@example.com', sub: 'dev-reviewer', name: 'Alice Reviewer (Dev)' };
    try {
      await login(JSON.stringify(cred));
      navigate(from, { replace: true });
    } catch (e) {
      setError(errMsg(e));
    }
  };

  useEffect(() => {
    if (!config?.googleClientId || config.googleClientId === 'dev-mode') return undefined;
    let cancelled = false;
    loadGoogleScript()
      .then(() => {
        if (cancelled || !buttonRef.current) return;
        window.google.accounts.id.initialize({
          client_id: config.googleClientId,
          callback: async (response) => {
            setError('');
            try {
              await login(response.credential);
              navigate(from, { replace: true });
            } catch (e) {
              setError(errMsg(e));
            }
          },
        });
        window.google.accounts.id.renderButton(buttonRef.current, { theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with', width: 280 });
      })
      .catch((e) => setError(errMsg(e)));
    return () => {
      cancelled = true;
    };
  }, [config, login, navigate, from]);

  if (!loading && user) return <Navigate to={from} replace />;

  return (
    <main className="login">
      <div className="login-card">
        <p className="eyebrow">A private reading copy</p>
        <h1 className="display">{config?.bookTitle || 'The Novel'}</h1>
        {config?.authorName && <p className="muted">by {config.authorName}</p>}
        <hr className="scene-break" aria-hidden="true" />
        <p>This manuscript is shared with invited readers only. Sign in with the Google account the author invited.</p>
        {isDev ? (
          <div className="dev-login-options" style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
            <p className="small bold" style={{ color: 'var(--accent, #6b4423)', margin: 0 }}>
              Development Mode Active (Zero Setup)
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleDevLogin('author')}
                style={{ padding: '0.6rem 1.2rem' }}
              >
                Sign in as Author
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleDevLogin('reviewer')}
                style={{ padding: '0.6rem 1.2rem' }}
              >
                Sign in as Reviewer
              </button>
            </div>
            <p className="muted small" style={{ margin: 0 }}>
              Local PGlite database active. Author & Reviewer accounts are pre-configured.
            </p>
          </div>
        ) : (
          <div ref={buttonRef} className="google-button" aria-label="Sign in with Google" />
        )}
        <Notice kind="error">{error}</Notice>
        <p className="muted small">Your password is never shared with this site. Only your name and email address are kept.</p>
      </div>
    </main>
  );
}
