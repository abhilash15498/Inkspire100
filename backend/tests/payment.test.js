import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, assertStatus, AUTHOR } from './helpers.js';

test('payment flow: create order, unlock chapter, verify receipt and author dashboard', async () => {
  const t = await setup({ OPEN_REGISTRATION: 'true' });
  try {
    // 1. Author publishes a Trailer (free) and Chapter 1 (paid)
    const trailerRes = assertStatus(
      await t.author.post('/api/author/chapters', { title: 'Trailer', content: 'Trailer preview text.' }),
      201,
    );
    const trailerId = trailerRes.data.chapter.id;
    assertStatus(await t.author.post(`/api/author/chapters/${trailerId}/publish`, {}), 200);

    const ch1Res = assertStatus(
      await t.author.post('/api/author/chapters', { title: 'Chapter 1', content: 'Secret chapter 1 text.', number: 1 }),
      201,
    );
    const ch1Id = ch1Res.data.chapter.id;
    assertStatus(await t.author.post(`/api/author/chapters/${ch1Id}/publish`, {}), 200);

    // 2. Unauthenticated reader can read Trailer
    const anon = t.client();
    const trailerRead = assertStatus(await anon.get(`/api/chapters/${trailerId}`), 200);
    assert.match(trailerRead.data.chapter.content, /Trailer preview text/);

    // Unauthenticated reader cannot read Chapter 1
    const anonCh1 = await anon.get(`/api/chapters/${ch1Id}`);
    assert.equal(anonCh1.status, 401);
    assert.equal(anonCh1.data.code, 'chapter_locked');

    // 3. Reader creates an account
    const readerClient = t.client();
    const reg = assertStatus(
      await readerClient.post('/api/auth/register', {
        name: 'Rahul Sharma',
        email: 'rahul.reader@example.com',
        password: 'Password123!',
      }),
      201,
    );
    assert.equal(reg.data.user.email, 'rahul.reader@example.com');

    // Registered reader has NOT paid yet, so Chapter 1 gives 403 payment_required
    const readerCh1Locked = await readerClient.get(`/api/chapters/${ch1Id}`);
    assert.equal(readerCh1Locked.status, 403);
    assert.equal(readerCh1Locked.data.code, 'payment_required');

    // Check my-access before payment
    const accessBefore = assertStatus(await readerClient.get('/api/payment/my-access'), 200);
    assert.equal(accessBefore.data.hasAccess, false);
    assert.equal(accessBefore.data.hasPurchased, false);

    // 4. Create payment order intent
    const orderIntent = assertStatus(await readerClient.post('/api/payment/create-order', {}), 200);
    assert.equal(orderIntent.data.amountInr, 30);
    assert.ok(orderIntent.data.orderId);

    // 5. Complete / verify payment
    const verifyRes = assertStatus(
      await readerClient.post('/api/payment/verify', {
        orderId: orderIntent.data.orderId,
        paymentId: 'pay_test_12345',
        customerName: 'Rahul Sharma',
        customerEmail: 'rahul.reader@example.com',
      }),
      201,
    );
    assert.equal(verifyRes.data.success, true);
    assert.equal(verifyRes.data.order.amountInr, 30);

    // 6. Check my-access after payment
    const accessAfter = assertStatus(await readerClient.get('/api/payment/my-access'), 200);
    assert.equal(accessAfter.data.hasAccess, true);
    assert.equal(accessAfter.data.hasPurchased, true);

    // 7. Reader can now read Chapter 1!
    const readerCh1Unlocked = assertStatus(await readerClient.get(`/api/chapters/${ch1Id}`), 200);
    assert.match(readerCh1Unlocked.data.chapter.content, /Secret chapter 1 text/);

    // 8. Fetch receipt
    const receipt = assertStatus(await readerClient.get(`/api/payment/receipt/${orderIntent.data.orderId}`), 200);
    assert.equal(receipt.data.customerEmail, 'rahul.reader@example.com');
    assert.equal(receipt.data.amountInr, 30);
    assert.ok(receipt.data.receiptNumber.startsWith('REC-'));

    // 9. Author views sales & orders
    const authorOrders = assertStatus(await t.author.get('/api/author/orders'), 200);
    assert.equal(authorOrders.data.totalOrders, 1);
    assert.equal(authorOrders.data.totalRevenue, 30);
    assert.equal(authorOrders.data.orders[0].customerEmail, 'rahul.reader@example.com');
  } finally {
    await t.close();
  }
});
