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
      .get('/book')
      .then((b) => setBookTitle(b.title))
      .catch(() => {});
  }, []);

  const signOut = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <div className="site-header-inner">
          <Link to="/" className="brand">
            {bookTitle || 'The Novel'}
          </Link>
          <nav aria-label="Main">
            <NavLink to="/chapters">Chapters</NavLink>
            <NavLink to="/book">About the book</NavLink>
            <NavLink to="/feedback">My feedback</NavLink>
            {isAuthor && <NavLink to="/author">Author</NavLink>}
          </nav>
          <div className="who">
            <span className="muted who-name">{user?.name || user?.email}</span>
            <button className="btn btn-ghost btn-small" onClick={signOut}>
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main id="main" className="container">
        <Outlet />
      </main>
      <footer className="site-footer">
        <p className="muted">A private manuscript. Please do not share or copy it.</p>
      </footer>
    </>
  );
}

export function AuthorLayout() {
  return (
    <>
      <nav className="subnav" aria-label="Author">
        <NavLink to="/author" end>
          Chapters
        </NavLink>
        <NavLink to="/author/feedback">Feedback inbox</NavLink>
        <NavLink to="/author/reviewers">Reviewers</NavLink>
        <NavLink to="/author/book">Book details</NavLink>
      </nav>
      <Outlet />
    </>
  );
}
