import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { Notice, errMsg } from '../ui.jsx';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const { resetPasswordWithToken } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setSubmitting(true);
    try {
      const loggedUser = await resetPasswordWithToken(token, password);
      setSuccess(true);
      setTimeout(() => {
        const dest = loggedUser.role === 'author' ? '/author' : '/chapters';
        navigate(dest, { replace: true });
      }, 1500);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login">
      <div className="login-card" style={{ maxWidth: '440px', margin: '3rem auto', padding: '2.5rem' }}>
        <p className="eyebrow">Account Recovery</p>
        <h1 className="display" style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>
          Reset Your Password
        </h1>

        {!token ? (
          <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            <Notice kind="error">
              Invalid or missing password reset link. Please use the exact link sent to your email.
            </Notice>
            <Link to="/login" className="btn btn-primary" style={{ display: 'inline-block', marginTop: '1.5rem' }}>
              Back to Sign In
            </Link>
          </div>
        ) : success ? (
          <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            <Notice kind="success">
              Your password has been reset successfully! Signing you in…
            </Notice>
          </div>
        ) : (
          <>
            <p className="muted small" style={{ marginBottom: '1.5rem' }}>
              Choose a new, secure password for your account.
            </p>

            {error && <Notice kind="error">{error}</Notice>}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <div className="form-group" style={{ textAlign: 'left' }}>
                <label htmlFor="new-password" style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  New Password
                </label>
                <input
                  id="new-password"
                  type="password"
                  required
                  minLength={6}
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text)', font: 'inherit' }}
                />
              </div>

              <div className="form-group" style={{ textAlign: 'left' }}>
                <label htmlFor="confirm-password" style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Confirm New Password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  required
                  minLength={6}
                  placeholder="Re-enter your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: '6px', color: 'var(--text)', font: 'inherit' }}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
                style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', marginTop: '0.5rem', fontWeight: 600 }}
              >
                {submitting ? 'Updating Password…' : 'Save New Password & Sign In'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
              <Link to="/login" style={{ fontSize: '0.88rem', color: 'var(--muted)', textDecoration: 'none' }}>
                ← Cancel and return to Sign In
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
