import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api.js';
import { Loading, LoadError, fmtDate } from '../ui.jsx';

export default function Receipt() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get(`/payment/receipt/${orderId}`)
      .then((data) => {
        setOrder(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err);
        setLoading(false);
      });
  }, [orderId]);

  if (loading) return <Loading />;
  if (error) return <LoadError error={error} />;
  if (!order) return <p className="empty">Receipt not found.</p>;

  return (
    <div className="receipt-page-container">
      <div className="receipt-card">
        <div className="receipt-header">
          <div className="receipt-brand">
            <span className="receipt-badge">Official Reading Pass & Invoice</span>
            <h1 className="receipt-title">Is It Me or You as Well?</h1>
            <p className="receipt-author">by H.M. Abhilash</p>
          </div>
          <div className="receipt-status-pill">
            <span className="dot"></span> Paid & Verified
          </div>
        </div>

        <div className="receipt-meta-grid">
          <div className="meta-item">
            <span className="meta-label">Receipt Number</span>
            <span className="meta-val strong">{order.receiptNumber}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Order Reference</span>
            <code className="meta-val code">{order.orderId}</code>
          </div>
          <div className="meta-item">
            <span className="meta-label">Date & Time</span>
            <span className="meta-val">{fmtDate(order.createdAt)}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Payment ID</span>
            <code className="meta-val code">{order.paymentId || 'N/A'}</code>
          </div>
        </div>

        <div className="receipt-customer-box">
          <span className="meta-label">Billed To Reader</span>
          <div className="customer-name">{order.customerName}</div>
          <div className="customer-email">{order.customerEmail}</div>
        </div>

        <table className="receipt-table">
          <thead>
            <tr>
              <th scope="col">Description</th>
              <th scope="col" className="text-right">Edition</th>
              <th scope="col" className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <div className="strong">Digital Lifetime Reading Pass</div>
                <div className="muted small">
                  Unrestricted access to all chapters, paperback 2-page & flip reading modes, customized bookmarks, and all future author revisions.
                </div>
              </td>
              <td className="text-right">Digital Edition</td>
              <td className="text-right strong">₹{order.amountInr}.00</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colSpan="2" className="text-right muted">Taxes (Inclusive)</td>
              <td className="text-right muted">₹0.00</td>
            </tr>
            <tr className="total-row">
              <td colSpan="2" className="text-right strong">Total Paid (INR)</td>
              <td className="text-right total-amount">₹{order.amountInr}.00</td>
            </tr>
          </tfoot>
        </table>

        <div className="receipt-footer-note">
          <p>
            Thank you for supporting independent literature. Your pass is tied to your account and gives you permanent access to this novel.
          </p>
          <p className="author-signature">
            — H.M. Abhilash, Author
          </p>
        </div>

        <div className="receipt-actions no-print">
          <button className="btn btn-outline" onClick={() => window.print()}>
            🖨️ Print / Save as PDF
          </button>
          <Link to="/chapters" className="btn btn-primary">
            📖 Start Reading Novel
          </Link>
          <Link to="/" className="btn btn-ghost">
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
