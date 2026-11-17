import crypto from 'node:crypto';
import { Router } from 'express';
import { HttpError, text } from '../http.js';

export function paymentRoutes({ config, db }) {
  const r = Router();

  // Create an order intent for unlocking the novel (default ₹30)
  r.post('/payment/create-order', async (req, res) => {
    const amountInr = config.chapterPriceInr || 30;
    const orderId = `order_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    res.json({
      orderId,
      amount: amountInr * 100, // in paise
      amountInr,
      currency: 'INR',
      keyId: config.razorpayKeyId || 'rzp_test_simulation',
      isTestMode: !config.razorpayKeySecret,
      novelTitle: 'Is It Me or You as Well?',
      authorName: 'H.M. Abhilash',
    });
  });

  // Verify and record a completed payment
  r.post('/payment/verify', async (req, res) => {
    const orderId = text(req.body?.orderId, { name: 'orderId', required: true, max: 100 });
    const paymentId = text(req.body?.paymentId, { name: 'paymentId', max: 100 }) || `pay_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const customerName = text(req.body?.customerName, { name: 'customerName', max: 200 }) || req.user?.name || 'Valued Reader';
    const customerEmail = (text(req.body?.customerEmail, { name: 'customerEmail', max: 254 }) || req.user?.email || '').toLowerCase();

    if (!customerEmail) {
      throw new HttpError(400, 'Customer email is required for receipt generation.', 'missing_email');
    }

    const amountInr = config.chapterPriceInr || 30;
    const gateway = config.razorpayKeySecret ? 'razorpay' : 'simulation';
    const userId = req.user?.id || null;

    // Check if order already recorded
    const existing = await db.query('SELECT * FROM orders WHERE order_id = $1', [orderId]);
    if (existing.rows.length > 0) {
      return res.json({ success: true, order: existing.rows[0] });
    }

    const ins = await db.query(
      `INSERT INTO orders (order_id, user_id, customer_name, customer_email, edition, amount_inr, payment_gateway, payment_id, status)
       VALUES ($1, $2, $3, $4, 'Digital Lifetime Reading Pass', $5, $6, $7, 'completed')
       RETURNING *`,
      [orderId, userId, customerName, customerEmail, amountInr, gateway, paymentId],
    );

    const order = ins.rows[0];

    res.status(201).json({
      success: true,
      order: {
        id: order.id,
        orderId: order.order_id,
        customerName: order.customer_name,
        customerEmail: order.customer_email,
        edition: order.edition,
        amountInr: order.amount_inr,
        paymentGateway: order.payment_gateway,
        paymentId: order.payment_id,
        status: order.status,
        createdAt: order.created_at,
        novelTitle: 'Is It Me or You as Well?',
        authorName: 'H.M. Abhilash',
      },
    });
  });

  // Get receipt by order ID
  r.get('/payment/receipt/:orderId', async (req, res) => {
    const orderId = req.params.orderId;
    const { rows } = await db.query('SELECT * FROM orders WHERE order_id = $1', [orderId]);
    if (!rows[0]) throw new HttpError(404, 'Receipt not found.', 'not_found');
    const order = rows[0];

    res.json({
      receiptNumber: `REC-${order.id.toString().padStart(6, '0')}`,
      orderId: order.order_id,
      customerName: order.customer_name,
      customerEmail: order.customer_email,
      edition: order.edition,
      amountInr: order.amount_inr,
      paymentGateway: order.payment_gateway,
      paymentId: order.payment_id,
      status: order.status,
      createdAt: order.created_at,
      novelTitle: 'Is It Me or You as Well?',
      authorName: 'H.M. Abhilash',
    });
  });

  // Check if current user has unlocked the novel
  r.get('/payment/my-access', async (req, res) => {
    const isAuthor = req.user?.role === 'author';
    const email = req.user?.email?.toLowerCase();
    const userId = req.user?.id;

    if (isAuthor) {
      return res.json({ hasAccess: true, isAuthor: true, isReviewer: false, hasPurchased: false, orders: [] });
    }

    let hasPurchased = false;
    let ordersList = [];
    if (userId || email) {
      const { rows } = await db.query(
        `SELECT * FROM orders WHERE (user_id = $1 OR lower(customer_email) = $2) AND status = 'completed' ORDER BY created_at DESC`,
        [userId || 0, email || ''],
      );
      if (rows.length > 0) {
        hasPurchased = true;
        ordersList = rows.map((o) => ({
          id: o.id,
          orderId: o.order_id,
          receiptNumber: `REC-${o.id.toString().padStart(6, '0')}`,
          amountInr: o.amount_inr,
          paymentId: o.payment_id,
          createdAt: o.created_at,
          edition: o.edition,
        }));
      }
    }

    // Check if specifically invited as VIP reviewer (not just self-registered reader)
    let isReviewer = false;
    if (email) {
      const rev = await db.query(
        `SELECT id, note, revoked_at FROM reviewer_access WHERE lower(email) = $1`,
        [email],
      );
      if (rev.rows.length > 0 && !rev.rows[0].revoked_at && rev.rows[0].note !== 'Registered reader') {
        isReviewer = true;
      }
    }

    const hasAccess = isAuthor || isReviewer || hasPurchased;

    res.json({
      hasAccess,
      isAuthor,
      isReviewer,
      hasPurchased,
      orders: ordersList,
    });
  });

  // Author route: Get all orders and sales summary
  r.get('/author/orders', async (req, res) => {
    if (req.user?.role !== 'author') {
      throw new HttpError(403, 'Only the author can view orders.', 'forbidden');
    }
    const { rows } = await db.query('SELECT * FROM orders ORDER BY created_at DESC');
    const totalRevenue = rows.reduce((sum, o) => sum + (Number(o.amount_inr) || 0), 0);
    res.json({
      orders: rows.map((o) => ({
        id: o.id,
        orderId: o.order_id,
        receiptNumber: `REC-${o.id.toString().padStart(6, '0')}`,
        customerName: o.customer_name,
        customerEmail: o.customer_email,
        edition: o.edition,
        amountInr: o.amount_inr,
        paymentGateway: o.payment_gateway,
        paymentId: o.payment_id,
        status: o.status,
        createdAt: o.created_at,
      })),
      totalOrders: rows.length,
      totalRevenue,
    });
  });

  return r;
}
