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
      reject(new Error('Could not load Google sign-in script. Check your internet or ad-blocker.'));
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
      .catch((e) => {
        // Fallback to local dev config if backend DB is cold-starting
        setConfig({
          googleClientId: 'dev-mode',
          bookTitle: 'Is It Me or You as Well?',
          authorName: 'H.M. Abhilash',
          openRegistration: true,
          isDev: true,
          devAuthorEmail: 'hmabhilash15@gmail.com',
        });
        setError('Notice: Using local development fallback mode. (' + errMsg(e) + ')');
      });
  }, []);

  const isDevMode = config?.isDev || config?.googleClientId === 'dev-mode' || import.meta.env.DEV;
  const hasGoogle = config?.googleClientId && config.googleClientId !== 'dev-mode';

  const handleDevLogin = async (role) => {
    setError('');
    const authorEmail = config?.devAuthorEmail || 'hmabhilash15@gmail.com';
    const authorName = config?.authorName || 'H.M. Abhilash';
    const cred =
      role === 'author'
        ? { email: authorEmail, sub: 'dev-author-id', name: `${authorName} (Author)`, emailVerified: true }
        : { email: 'reviewer@example.com', sub: 'dev-reviewer-id', name: 'Alice Reviewer (Beta)', emailVerified: true };
    try {
      const loggedUser = await login(JSON.stringify(cred));
      const dest = from === '/' || from === '/login' ? (loggedUser.role === 'author' ? '/author' : '/chapters') : from;
      navigate(dest, { replace: true });
    } catch (e) {
      setError(errMsg(e));
    }
  };

  useEffect(() => {
    if (!hasGoogle) return undefined;
    let cancelled = false;

    loadGoogleScript()
      .then(() => {
        if (cancelled || !buttonRef.current) return;
        window.google.accounts.id.initialize({
          client_id: config.googleClientId,
          callback: async (response) => {
            setError('');
            try {
              const loggedUser = await login(response.credential);
              const dest = from === '/' || from === '/login' ? (loggedUser.role === 'author' ? '/author' : '/chapters') : from;
              navigate(dest, { replace: true });
            } catch (e) {
              setError(errMsg(e));
            }
          },
        });
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'signin_with',
          width: 280,
        });
      })
      .catch((e) => {
        if (!cancelled) {
          setError(
            'Google Sign-In is unavailable (' +
              errMsg(e) +
              '). If running locally, verify that "http://localhost:5173" is listed in Authorized JavaScript Origins in Google Cloud Console, or use Quick Dev Sign-In below.',
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [config, hasGoogle, login, navigate, from]);

  if (!loading && user) {
    const dest = from === '/' || from === '/login' ? (user.role === 'author' ? '/author' : '/chapters') : from;
    return <Navigate to={dest} replace />;
  }

  return (
    <main className="login">
      <div className="login-card">
        <p className="eyebrow">{config?.openRegistration ? 'Early Reader Edition' : 'A private reading copy'}</p>
        <h1 className="display">{config?.bookTitle || 'Is It Me or You as Well?'}</h1>
        {config?.authorName && <p className="muted">by {config.authorName}</p>}
        <hr className="scene-break" aria-hidden="true" />

        <p>
          {config?.openRegistration
            ? 'Sign in to access published chapters, the paperback reader, and leave chapter feedback.'
            : 'This manuscript is shared with invited readers only. Sign in with the Google account the author invited.'}
        </p>

        {hasGoogle && (
          <div style={{ margin: '1.5rem 0', display: 'flex', justifyContent: 'center', minHeight: '44px' }}>
            <div ref={buttonRef} className="google-button" aria-label="Sign in with Google" />
          </div>
        )}

        {isDevMode && (
          <div
            className="dev-login-options"
            style={{
              marginTop: hasGoogle ? '1rem' : '1.5rem',
              paddingTop: hasGoogle ? '1.25rem' : '0',
              borderTop: hasGoogle ? '1px dashed var(--line)' : 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              alignItems: 'center',
            }}
          >
            <p className="small bold" style={{ color: 'var(--accent, #8a3b2a)', margin: 0 }}>
              ⚡ One-Click Local Sign-In (Local Testing)
            </p>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleDevLogin('author')}
                style={{ padding: '0.55rem 1.1rem', fontSize: '0.9rem' }}
              >
                Sign in as Author ({config?.devAuthorEmail?.split('@')[0] || 'Abhilash'})
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleDevLogin('reviewer')}
                style={{ padding: '0.55rem 1.1rem', fontSize: '0.9rem' }}
              >
                Sign in as Reviewer (Alice)
              </button>
            </div>
            <p className="muted micro" style={{ margin: 0, textAlign: 'center' }}>
              Instant local testing without needing Google Cloud credentials.
            </p>
          </div>
        )}

        {error && <Notice kind="error">{error}</Notice>}

        <p className="muted small mt-3">
          Your password is never shared with this site. Only your name and email address are kept for reading access.
        </p>
      </div>
    </main>
  );
}
