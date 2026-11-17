import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Loading, Notice, fmtDate } from '../ui.jsx';

export default function UnlockModal({ isOpen, onClose, onSuccess, user, chapterId }) {
  const [orderIntent, setOrderIntent] = useState(null);
  const [loadingIntent, setLoadingIntent] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [method, setMethod] = useState('upi');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [completedOrder, setCompletedOrder] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setLoadingIntent(true);
      setError('');
      setCompletedOrder(null);
      setName(user?.name || '');
      setEmail(user?.email || '');

      api
        .post('/payment/create-order', { chapterId })
        .then((data) => {
          setOrderIntent(data);
          setLoadingIntent(false);
        })
        .catch((err) => {
          setError(err?.message || 'Unable to initialize checkout. Please try again.');
          setLoadingIntent(false);
        });
    }
  }, [isOpen, chapterId, user]);

  if (!isOpen) return null;

  const handlePay = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please provide your email address for the receipt.');
      return;
    }
    setSubmitting(true);
    setError('');

    try {
      const paymentId = `sim_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const res = await api.post('/payment/verify', {
        orderId: orderIntent.orderId,
        paymentId,
        customerName: name.trim() || 'Reader',
        customerEmail: email.trim().toLowerCase(),
      });

      if (res.success && res.order) {
        setCompletedOrder(res.order);
        if (onSuccess) {
          onSuccess(res.order);
        }
      } else {
        setError('Payment verification failed. Please try again.');
      }
    } catch (err) {
      setError(err?.message || 'Payment simulation failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="unlock-title">
      <div className="modal-sheet unlock-modal" onClick={(e) => e.stopPropagation()}>
        {completedOrder ? (
          /* ================= SUCCESS STATE ================= */
          <div className="unlock-success-content">
            <div className="success-badge-icon">🎉</div>
            <h2 id="unlock-title" className="unlock-success-title">
              Payment Complete & Novel Unlocked!
            </h2>
            <p className="muted" style={{ lineHeight: 1.6, marginBottom: '1.5rem' }}>
              Your lifetime digital reading pass for <strong>Is It Me or You as Well?</strong> is now active.
              Official Tax Receipt <strong>REC-{completedOrder.id?.toString().padStart(6, '0')}</strong> has been generated.
            </p>

            <div className="order-summary-box">
              <div className="summary-row">
                <span className="muted">Amount Paid</span>
                <span className="strong total-price">₹{completedOrder.amountInr}.00</span>
              </div>
              <div className="summary-row">
                <span className="muted">Reader</span>
                <span>{completedOrder.customerName} ({completedOrder.customerEmail})</span>
              </div>
              <div className="summary-row">
                <span className="muted">Edition</span>
                <span className="chip chip-good">{completedOrder.edition}</span>
              </div>
            </div>

            <div className="modal-action-row" style={{ marginTop: '1.8rem', display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1, padding: '0.8rem' }}
                onClick={() => {
                  onClose();
                }}
              >
                📖 Start Reading Chapter Now
              </button>
              <Link
                to={`/receipt/${completedOrder.orderId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline"
                style={{ padding: '0.8rem 1.2rem' }}
              >
                🧾 View & Print Receipt
              </Link>
            </div>
          </div>
        ) : (
          /* ================= CHECKOUT STATE ================= */
          <div>
            <div className="modal-head">
              <div>
                <span className="chip chip-accent" style={{ marginBottom: '0.4rem', display: 'inline-block' }}>
                  Digital Edition · ₹30
                </span>
                <h2 id="unlock-title" style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.5rem' }}>
                  Unlock Full Novel
                </h2>
              </div>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Close">
                ✕
              </button>
            </div>

            <p className="muted small" style={{ margin: '0.8rem 0 1.2rem', lineHeight: 1.5 }}>
              One-time unlock for <strong>Is It Me or You as Well?</strong> by H.M. Abhilash.
              Includes unlimited reading on all devices, customizable bookmarks, and instant tax receipt.
            </p>

            {loadingIntent ? (
              <Loading />
            ) : (
              <form onSubmit={handlePay} className="stack">
                <div className="order-summary-box">
                  <div className="summary-row">
                    <span>Novel Reading Pass (Lifetime)</span>
                    <span className="strong">₹30.00</span>
                  </div>
                  <div className="summary-row">
                    <span className="muted small">Taxes & Platform Fees</span>
                    <span className="muted small">₹0.00 (Included)</span>
                  </div>
                  <div className="summary-row total-divider">
                    <span className="strong">Total Amount</span>
                    <span className="strong total-price">₹30.00</span>
                  </div>
                </div>

                <div className="stack" style={{ gap: '0.6rem' }}>
                  <label htmlFor="checkout-name" className="small strong">
                    Your Name
                  </label>
                  <input
                    id="checkout-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    required
                  />
                </div>

                <div className="stack" style={{ gap: '0.6rem' }}>
                  <label htmlFor="checkout-email" className="small strong">
                    Email Address (for receipt & login pass)
                  </label>
                  <input
                    id="checkout-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. rahul@example.com"
                    required
                  />
                </div>

                <div className="stack" style={{ gap: '0.6rem', marginTop: '0.4rem' }}>
                  <span className="small strong">Payment Method</span>
                  <div className="payment-method-selector" role="radiogroup">
                    <label className={`payment-method-card ${method === 'upi' ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name="pay-method"
                        value="upi"
                        checked={method === 'upi'}
                        onChange={() => setMethod('upi')}
                        style={{ display: 'none' }}
                      />
                      <span className="method-icon">⚡</span>
                      <div>
                        <div className="strong small">UPI / QR Simulation</div>
                        <div className="muted smaller">Instant 1-Click Sandbox Test</div>
                      </div>
                    </label>

                    <label className={`payment-method-card ${method === 'card' ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name="pay-method"
                        value="card"
                        checked={method === 'card'}
                        onChange={() => setMethod('card')}
                        style={{ display: 'none' }}
                      />
                      <span className="method-icon">💳</span>
                      <div>
                        <div className="strong small">Card / NetBanking Simulator</div>
                        <div className="muted smaller">Test Debit / Credit / NetBanking</div>
                      </div>
                    </label>
                  </div>
                </div>

                <Notice kind="error">{error}</Notice>

                <div className="modal-actions" style={{ marginTop: '1rem' }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={submitting || !email.trim()}
                    style={{ width: '100%', padding: '0.85rem' }}
                  >
                    {submitting ? 'Processing Payment…' : 'Complete Payment · ₹30'}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
