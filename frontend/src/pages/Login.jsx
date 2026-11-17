import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
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
      reject(new Error('Could not load Google sign-in script.'));
    };
    document.head.appendChild(s);
  });
  return gsiPromise;
}

export default function Login() {
  const { user, loading, loginWithGoogle, loginWithPassword, registerWithPassword, requestPasswordReset } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [config, setConfig] = useState(null);
  const [tab, setTab] = useState('login'); // 'login' | 'register' | 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const buttonRef = useRef(null);
  const from = location.state?.from || '/';

  useEffect(() => {
    api
      .get('/config')
      .then(setConfig)
      .catch(() => {
        setConfig({
          googleClientId: '',
          bookTitle: 'Is It Me or You as Well?',
          authorName: 'H.M. Abhilash',
          openRegistration: true,
        });
      });
  }, []);

  const hasGoogle = config?.googleClientId && config.googleClientId !== 'dev-mode';

  const handleAuthSuccess = (loggedUser) => {
    const defaultDest = loggedUser.role === 'author' ? '/author' : '/chapters';
    const dest = from === '/' || from === '/login' ? defaultDest : from;
    navigate(dest, { replace: true });
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (tab === 'register') {
      const cleanName = name.trim();
      if (!agreeTerms) {
        setError('Please agree to the Terms of Service and Privacy Policy before creating an account.');
        return;
      }
      if (cleanName.length < 2 || /^(.)\1+$|^(abcd|asdf|test|qwerty|1234)$/i.test(cleanName)) {
        setError('Please enter a valid reader name.');
        return;
      }
      if (/^(abcd|test|asdf|dummy)@/i.test(email.trim())) {
        setError('Please enter a valid personal email address.');
        return;
      }
    }
    setSubmitting(true);
    try {
      if (tab === 'register') {
        const loggedUser = await registerWithPassword(name, email, password);
        handleAuthSuccess(loggedUser);
      } else {
        const loggedUser = await loginWithPassword(email, password);
        handleAuthSuccess(loggedUser);
      }
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setForgotSent(false);
    setSubmitting(true);
    try {
      await requestPasswordReset(email);
      setForgotSent(true);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSubmitting(false);
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
              const loggedUser = await loginWithGoogle(response.credential);
              handleAuthSuccess(loggedUser);
            } catch (err) {
              setError(errMsg(err));
            }
          },
        });
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'signin_with',
          width: 300,
        });
      })
      .catch(() => {
        /* Google sign-in script blocked or unavailable */
      });

    return () => {
      cancelled = true;
    };
  }, [config, hasGoogle, loginWithGoogle]);

  if (!loading && user) {
    const dest = from === '/' || from === '/login' ? (user.role === 'author' ? '/author' : '/chapters') : from;
    return <Navigate to={dest} replace />;
  }

  return (
    <main className="login">
      <div className="login-card" style={{ maxWidth: '440px', margin: '2rem auto', padding: '2.5rem' }}>
        <p className="eyebrow">Reader & Reviewer Portal</p>
        <h1 className="display" style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>
          {config?.bookTitle || 'Is It Me or You as Well?'}
        </h1>
        {config?.authorName && <p className="muted small" style={{ marginBottom: '1.5rem' }}>by {config.authorName}</p>}

        {/* Tab switch between Sign In & Register */}
        {tab !== 'forgot' ? (
          <div
            className="auth-tabs"
            style={{
              display: 'flex',
              borderBottom: '1px solid var(--line)',
              marginBottom: '1.5rem',
              gap: '1rem',
            }}
          >
            <button
              type="button"
              className={`auth-tab-btn ${tab === 'login' ? 'active' : ''}`}
              onClick={() => {
                setTab('login');
                setError('');
              }}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: tab === 'login' ? '2px solid var(--accent)' : '2px solid transparent',
                color: tab === 'login' ? 'var(--text)' : 'var(--muted)',
                fontWeight: 600,
                fontSize: '1rem',
                padding: '0.5rem 0.5rem 0.75rem',
                cursor: 'pointer',
                flex: 1,
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`auth-tab-btn ${tab === 'register' ? 'active' : ''}`}
              onClick={() => {
                setTab('register');
                setError('');
              }}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: tab === 'register' ? '2px solid var(--accent)' : '2px solid transparent',
                color: tab === 'register' ? 'var(--text)' : 'var(--muted)',
                fontWeight: 600,
                fontSize: '1rem',
                padding: '0.5rem 0.5rem 0.75rem',
                cursor: 'pointer',
                flex: 1,
              }}
            >
              Create Account
            </button>
          </div>
        ) : (
          <div style={{ marginBottom: '1.25rem', textAlign: 'left' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '0.35rem' }}>Reset Password</h2>
            <p className="muted small" style={{ margin: 0 }}>
              Enter your email address and we'll send you an automated link to change your password.
            </p>
          </div>
        )}

        {error && <Notice kind="error">{error}</Notice>}

        {tab === 'forgot' ? (
          forgotSent ? (
            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <Notice kind="success">
                If an account exists for <strong>{email}</strong>, an automated password reset link has been dispatched. Please check your inbox (or spam folder).
              </Notice>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setTab('login');
                  setError('');
                  setForgotSent(false);
                }}
                style={{ width: '100%', marginTop: '1.5rem', padding: '0.75rem' }}
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgotSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group" style={{ textAlign: 'left' }}>
                <label htmlFor="auth-forgot-email" style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Your Account Email
                </label>
                <input
                  id="auth-forgot-email"
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text)', font: 'inherit' }}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
                style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', marginTop: '0.5rem', fontWeight: 600 }}
              >
                {submitting ? 'Sending Link…' : 'Send Reset Link'}
              </button>

              <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setTab('login');
                    setError('');
                  }}
                  style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.88rem' }}
                >
                  ← Back to Sign In
                </button>
              </div>
            </form>
          )
        ) : (
          /* Email & Password Form */
          <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {tab === 'register' && config?.openRegistration === false && (
              <div
                style={{
                  fontSize: '0.82rem',
                  lineHeight: 1.4,
                  background: 'rgba(217, 119, 6, 0.1)',
                  color: 'var(--text)',
                  border: '1px solid rgba(217, 119, 6, 0.25)',
                  borderRadius: '6px',
                  padding: '0.65rem 0.85rem',
                  textAlign: 'left',
                }}
              >
                🔒 <strong>Invitation-only access:</strong> Please use the exact email address invited by the author to create your account.
              </div>
            )}

            {tab === 'register' && (
              <div className="form-group" style={{ textAlign: 'left' }}>
                <label htmlFor="auth-name" style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Your Name
                </label>
                <input
                  id="auth-name"
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text)', font: 'inherit' }}
                />
              </div>
            )}

            <div className="form-group" style={{ textAlign: 'left' }}>
              <label htmlFor="auth-email" style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                Email Address
              </label>
              <input
                id="auth-email"
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: '100%', padding: '0.65rem 0.85rem', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text)', font: 'inherit' }}
              />
            </div>

            <div className="form-group" style={{ textAlign: 'left' }}>
              <label htmlFor="auth-password" style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                Password
              </label>
              <input
                id="auth-password"
                type="password"
                required
                minLength={6}
                placeholder={tab === 'register' ? 'At least 6 characters' : 'Enter your password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: '100%', padding: '0.65rem 0.85rem', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text)', font: 'inherit' }}
              />
            </div>

            {tab === 'login' && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-0.4rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setTab('forgot');
                    setError('');
                    setForgotSent(false);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent)',
                    cursor: 'pointer',
                    fontSize: '0.84rem',
                    padding: 0,
                    textDecoration: 'underline',
                  }}
                >
                  Forgot password?
                </button>
              </div>
            )}

            {tab === 'register' && (
              <div className="form-group" style={{ textAlign: 'left', marginTop: '-0.2rem' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text)' }}>
                  <input
                    type="checkbox"
                    required
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    style={{ marginTop: '0.2rem', accentColor: 'var(--accent)', cursor: 'pointer' }}
                  />
                  <span>
                    I agree to the{' '}
                    <Link to="/terms" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
                      Terms of Service
                    </Link>{' '}
                    and{' '}
                    <Link to="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
                      Privacy Policy
                    </Link>
                    .
                  </span>
                </label>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || (tab === 'register' && !agreeTerms)}
              style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', marginTop: '0.5rem', fontWeight: 600 }}
            >
              {submitting ? 'Please wait…' : tab === 'register' ? 'Create Account & Read' : 'Sign In'}
            </button>
          </form>
        )}

        {/* Alternative Google Sign-in */}
        {hasGoogle && (
          <div style={{ marginTop: '1.75rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                margin: '1rem 0',
                color: 'var(--muted)',
                fontSize: '0.8rem',
              }}
            >
              <div style={{ flex: 1, height: '1px', background: 'var(--line)' }} />
              <span style={{ padding: '0 0.8rem' }}>or continue with Google</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--line)' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', minHeight: '44px' }}>
              <div ref={buttonRef} className="google-button" aria-label="Sign in with Google" />
            </div>
          </div>
        )}

        <p className="muted micro" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          Your reading progress and feedback are safely synced to your account.
        </p>
      </div>
    </main>
  );
}
