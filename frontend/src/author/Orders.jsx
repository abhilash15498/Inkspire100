import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Loading, LoadError, PageHeader, fmtDate, useAsync } from '../ui.jsx';

export default function Orders() {
  const { data, error, loading } = useAsync(() => api.get('/author/orders'), []);

  if (loading) return <Loading />;
  if (error) return <LoadError error={error} />;

  const orders = data.orders || [];
  const totalRevenue = data.totalRevenue || 0;
  const totalOrders = data.totalOrders || 0;

  return (
    <>
      <PageHeader
        title="Sales & Reader Orders"
        subtitle="Live records of every reader who has unlocked your novel."
      />

      <ul className="stats plain-list">
        <li>
          <strong>₹{totalRevenue}</strong> Total Revenue
        </li>
        <li>
          <strong>{totalOrders}</strong> Readers Unlocked
        </li>
        <li>
          <strong>₹30</strong> Pass Price
        </li>
      </ul>

      {orders.length === 0 ? (
        <p className="empty">
          No reader purchases yet. Readers who register can preview the Trailer and Prologue, and will unlock here when they purchase for ₹30.
        </p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Receipt</th>
                <th scope="col">Reader</th>
                <th scope="col">Amount</th>
                <th scope="col">Gateway</th>
                <th scope="col">Payment Ref</th>
                <th scope="col">Date</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.orderId}>
                  <td>
                    <span className="code strong">{o.receiptNumber}</span>
                  </td>
                  <td>
                    <div className="strong">{o.customerName}</div>
                    <div className="muted small">{o.customerEmail}</div>
                  </td>
                  <td>
                    <span className="strong">₹{o.amountInr}</span>
                  </td>
                  <td>
                    <span className="chip chip-good">{o.paymentGateway}</span>
                  </td>
                  <td>
                    <code className="small muted">{o.paymentId || o.orderId}</code>
                  </td>
                  <td>{fmtDate(o.createdAt)}</td>
                  <td>
                    <Link to={`/receipt/${o.orderId}`} className="btn btn-small" target="_blank" rel="noopener noreferrer">
                      View Receipt
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
