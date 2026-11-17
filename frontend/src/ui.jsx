import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { api } from './api.js';

// ---------- helpers ----------
export const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
export const fmtDateTime = (iso) =>
  iso
    ? new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '';
export const readingMinutes = (words) => Math.max(1, Math.round((words || 0) / 230));
export const errMsg = (e) => (e && e.message) || 'Something went wrong.';

/** Loads data when the component appears (or deps change). */
export function useAsync(fn, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const run = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fnRef.current();
      return setState({ data, error: null, loading: false });
    } catch (error) {
      return setState({ data: null, error, loading: false });
    }
  }, []);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fnRef.current();
        if (!cancelled) setState({ data, error: null, loading: false });
      } catch (error) {
        if (!cancelled) setState({ data: null, error, loading: false });
      }
    })();
    setState((s) => ({ ...s, loading: true }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  const setData = useCallback((updater) => setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater })), []);
  return { ...state, reload: run, setData };
}

/** A setting remembered in the browser (for example reading size). */
export function usePref(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      return localStorage.getItem(key) ?? initial;
    } catch {
      return initial;
    }
  });
  const set = useCallback(
    (v) => {
      setValue(v);
      try {
        localStorage.setItem(key, v);
      } catch {
        /* ignore */
      }
    },
    [key],
  );
  return [value, set];
}

// ---------- small components ----------
export function Notice({ kind = 'info', children }) {
  if (!children) return null;
  return (
    <div className={`notice notice-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

export const Loading = ({ label = 'Loading…' }) => (
  <p className="muted loading" role="status">
    {label}
  </p>
);

export function LoadError({ error }) {
  return <Notice kind="error">{errMsg(error)}</Notice>;
}

export const Chip = ({ tone = 'neutral', children }) => <span className={`chip chip-${tone}`}>{children}</span>;

export function StatusChip({ status }) {
  const map = { published: ['good', 'Published'], draft: ['neutral', 'Draft'], unpublished: ['warn', 'Unpublished'] };
  const [tone, label] = map[status] || ['neutral', status];
  return <Chip tone={tone}>{label}</Chip>;
}

export const CATEGORY_LABELS = { general: 'General', plot: 'Plot', character: 'Character', pacing: 'Pacing', writing: 'Writing' };

export function PageHeader({ title, subtitle, children }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </header>
  );
}

// ---------- layout ----------
export function Layout() {
  const { user, logout, isAuthor } = useAuth();
  const navigate = useNavigate();
  const [bookTitle, setBookTitle] = useState('');

  useEffect(() => {
    api
      .get('/public/book')
      .then((b) => setBookTitle(b.title))
      .catch(() => {});
  }, []);

  const signOut = async () => {
    await logout();
    navigate('/');
  };

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <div className="site-header-inner">
          <Link to={isAuthor ? '/author' : '/'} className="brand">
            {bookTitle || 'Is It Me or You as Well?'}
          </Link>
          <nav aria-label={isAuthor ? 'Author Navigation' : 'Reader Navigation'}>
            {isAuthor ? (
              <>
                <NavLink to="/author" end>
                  Chapters & Editor
                </NavLink>
                <NavLink to="/author/orders">Sales & Orders</NavLink>
                <NavLink to="/author/feedback">Feedback Inbox</NavLink>
                <NavLink to="/author/reviewers">Reviewers</NavLink>
                <NavLink to="/author/book">Book Details</NavLink>
                <NavLink to="/chapters">Preview Reader</NavLink>
              </>
            ) : (
              <>
                <NavLink to="/" end>
                  Store
                </NavLink>
                <NavLink to="/about">About the Novel</NavLink>
                <NavLink to="/chapters">Reader</NavLink>
                {user && <NavLink to="/feedback">My Feedback</NavLink>}
              </>
            )}
          </nav>
          <div className="who">
            {user ? (
              <>
                {isAuthor && <span className="chip chip-accent">Author</span>}
                <span className="muted who-name" title={user?.name || user?.email}>
                  {user?.name || user?.email}
                </span>
                <button className="btn btn-ghost btn-small" onClick={signOut}>
                  Sign out
                </button>
              </>
            ) : (
              <Link to="/login" className="btn btn-small btn-primary">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>
      <main id="main" className="container">
        <Outlet />
      </main>
      {isAuthor ? (
        <footer className="site-footer">
          <p className="muted small">Author Workspace · {bookTitle || 'Is It Me or You as Well?'}</p>
        </footer>
      ) : (
        <footer className="store-footer">
          <div className="store-footer-inner">
            <div className="footer-col brand-col">
              <h3 className="footer-brand">{bookTitle || 'Is It Me or You as Well?'}</h3>
              <p className="footer-desc">
                A candid coming-of-age novel following an ordinary Indian boy navigating dreams, family expectations, and awkward heartbreaks.
              </p>
              <div className="footer-badges">
                <span className="badge-pill">🔒 256-bit Secure Checkout</span>
                <span className="badge-pill">⚡ Instant Digital Access</span>
              </div>
            </div>
            <div className="footer-col">
              <h4>Explore</h4>
              <ul className="plain-list footer-links">
                <li><Link to="/">Book Storefront</Link></li>
                <li><Link to="/about">About the Author & Story</Link></li>
                <li><Link to="/chapters">Online Manuscript Reader</Link></li>
                {user && <li><Link to="/feedback">My Feedback</Link></li>}
              </ul>
            </div>
            <div className="footer-col">
              <h4>Legal & Policies</h4>
              <ul className="plain-list footer-links">
                <li><Link to="/privacy">Privacy Policy</Link></li>
                <li><Link to="/terms">Terms of Service & Refunds</Link></li>
                <li><Link to="/login">Reader Sign-in</Link></li>
                <li><a href="mailto:hmabhilash15@gmail.com">Contact Support</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Monetization & Payments</h4>
              <p className="footer-subtext">Supported Payment Gateways:</p>
              <div className="payment-badges-row">
                <span className="pay-chip">UPI</span>
                <span className="pay-chip">GPay</span>
                <span className="pay-chip">PhonePe</span>
                <span className="pay-chip">Visa</span>
                <span className="pay-chip">Mastercard</span>
                <span className="pay-chip">RuPay</span>
              </div>
              <p className="footer-disclaimer">
                Author contact: <a href="mailto:hmabhilash15@gmail.com">hmabhilash15@gmail.com</a>
              </p>
            </div>
          </div>
          <div className="footer-bottom">
            <p>© {new Date().getFullYear()} {bookTitle || 'Is It Me or You as Well?'}. All rights reserved.</p>
            <p className="footer-fineprint">
              Physical book format: 5.5" × 8.5" Statement Paperback. Private manuscript rights protected under international copyright law.
            </p>
          </div>
        </footer>
      )}
    </>
  );
}

export function AuthorLayout() {
  return <Outlet />;
}
