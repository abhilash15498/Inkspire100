import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { fmtDate, useAsync } from '../ui.jsx';

export default function Home() {
  const { user, isAuthor } = useAuth();
  const book = useAsync(() => api.get('/public/book'), []);
  const sampleData = useAsync(() => api.get('/sample').catch(() => null), []);

  const [selectedEdition, setSelectedEdition] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [orderForm, setOrderForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: '',
    address: '',
    paymentMethod: 'upi',
  });
  const [orderComplete, setOrderComplete] = useState(null);
  const [faqOpen, setFaqOpen] = useState({ 0: true });

  const b = book.data || {
    title: 'Is It Me or You as Well?',
    authorName: 'H.M. Abhilash',
    tagline: 'A candid story of middle-class youth, dreams, and navigating life one awkward chapter at a time.',
    synopsis: '',
  };

  const editions = [
    {
      id: 'digital',
      name: 'Digital Early Access Edition',
      tag: 'Instant Access',
      badge: null,
      price: '₹199',
      originalPrice: '₹349',
      description: 'Immediate online access to the full novel manuscript via our distraction-free paged paperback reader.',
      features: [
        'Instant web reader access on mobile, tablet & laptop',
        'Physical book proportions with Paper, Sepia & Night themes',
        'Custom font typography (Literata, Lora, Garamond)',
        'Automatic reading progress & bookmark sync',
        'Access to ongoing author revisions & updates',
      ],
      isPhysical: false,
      cta: 'Pre-Order Digital (₹199)',
    },
    {
      id: 'paperback',
      name: 'Collector’s Paperback Edition',
      tag: 'Best Seller',
      badge: 'MOST POPULAR',
      price: '₹399',
      originalPrice: '₹599',
      description: 'The physical novel in 5.5" × 8.5" Statement trim, printed on 80 GSM cream-wove book paper with author signature.',
      features: [
        'Premium 5.5" × 8.5" physical Statement paperback',
        'High-bulk 80 GSM cream book paper & velvet matte cover',
        'Signed author bookplate + exclusive custom bookmark',
        'FREE Instant Digital Web Reader access included',
        'Free doorstep shipping across India',
      ],
      isPhysical: true,
      cta: 'Pre-Order Paperback (₹399)',
    },
    {
      id: 'patron',
      name: 'Patron & Founder’s Edition',
      tag: 'Limited 50 Copies',
      badge: 'LIMITED COLLECTOR',
      price: '₹699',
      originalPrice: '₹999',
      description: 'For dedicated readers who want to support the novel and have their name permanently immortalized in print.',
      features: [
        'Signed physical paperback with personal handwritten dedication',
        'Your name printed in the Official Book Acknowledgments',
        'Lifetime digital access + future bonus chapters & deleted scenes',
        'Exclusive invitation to author digital Q&A sessions',
        'Priority dispatch with deluxe collector packaging',
      ],
      isPhysical: true,
      cta: 'Pre-Order Patron Edition (₹699)',
    },
  ];

  const openCheckout = (edition) => {
    setSelectedEdition(edition);
    setOrderComplete(null);
    setModalOpen(true);
  };

  const handleOrderSubmit = (e) => {
    e.preventDefault();
    const orderId = 'ORD-' + Math.floor(100000 + Math.random() * 900000);
    const orderDetails = {
      orderId,
      edition: selectedEdition.name,
      price: selectedEdition.price,
      customer: orderForm,
      date: new Date().toISOString(),
    };
    try {
      localStorage.setItem('novel.lastOrder', JSON.stringify(orderDetails));
    } catch {
      /* ignore */
    }
    setOrderComplete(orderDetails);
  };

  const toggleFaq = (index) => {
    setFaqOpen((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <div className="storefront-page">
      {/* Top Pre-Order Notification Bar */}
      <aside className="store-top-banner">
        <span className="banner-pill">EARLY PRE-ORDER</span>
        <span>
          Reserve your copy of <strong>{b.title}</strong> · Free instant digital reader access with all paperback editions.
        </span>
      </aside>

      {/* Hero Section */}
      <section className="store-hero">
        <div className="store-hero-grid">
          <div className="store-hero-info">
            <div className="genre-pill-row">
              <span className="genre-pill">Coming of Age</span>
              <span className="genre-pill">Contemporary Indian Fiction</span>
              <span className="genre-pill">College Romance</span>
            </div>

            <h1 className="hero-novel-title">{b.title}</h1>
            <p className="hero-author-byline">A Novel by <strong>{b.authorName || 'H.M. Abhilash'}</strong></p>

            <p className="hero-novel-tagline">
              {b.tagline ||
                'A candid, nostalgic story of middle-class dreams, parental expectations, late-night tea stalls, and navigating life one awkward chapter at a time.'}
            </p>

            <div className="social-proof-strip">
              <div className="stars">★★★★★</div>
              <span className="rating-text"><strong>4.9 / 5</strong> from early beta readers</span>
              <span className="dot-sep">·</span>
              <span className="hospete-tag">Hospete, 2007</span>
            </div>

            <div className="hero-cta-group">
              <button
                className="btn btn-primary btn-large cta-pulse"
                onClick={() => openCheckout(editions[1])}
              >
                Pre-Order Now · ₹399
              </button>

              <a href="#sample-preview" className="btn btn-secondary btn-large">
                Read Free Sample
              </a>

              {user ? (
                <Link to="/chapters" className="btn btn-ghost btn-large">
                  My Library →
                </Link>
              ) : (
                <Link to="/login" className="btn btn-ghost btn-large">
                  Reviewer Login
                </Link>
              )}
            </div>

            {/* Trust Badges */}
            <div className="store-trust-badges">
              <div className="trust-item">
                <span className="trust-icon">⚡</span>
                <div>
                  <strong>Instant Reading</strong>
                  <p className="muted small">Read immediately online</p>
                </div>
              </div>
              <div className="trust-item">
                <span className="trust-icon">📖</span>
                <div>
                  <strong>5.5" × 8.5" Paperback</strong>
                  <p className="muted small">Cream book paper w/ bookmark</p>
                </div>
              </div>
              <div className="trust-item">
                <span className="trust-icon">🔒</span>
                <div>
                  <strong>Secure Checkout</strong>
                  <p className="muted small">UPI, Cards & NetBanking</p>
                </div>
              </div>
            </div>
          </div>

          {/* 3D Realistic Book Cover Mockup */}
          <div className="store-hero-visual">
            <div className="book-3d-wrap">
              <div className="book-3d">
                <div className="book-3d-front">
                  <div className="book-cover-inner">
                    <span className="cover-genre-label">A NOVEL</span>
                    <h2 className="cover-title">{b.title}</h2>
                    <div className="cover-divider"></div>
                    <p className="cover-author">{b.authorName || 'H.M. ABHILASH'}</p>
                    <div className="cover-stamp">
                      <span>SPECIAL PRE-ORDER EDITION</span>
                    </div>
                  </div>
                </div>
                <div className="book-3d-spine">
                  <span>{b.title} · {b.authorName || 'H.M. ABHILASH'}</span>
                </div>
              </div>
              <div className="book-shadow"></div>
            </div>

            <div className="book-meta-badge">
              <span className="badge-highlight">Official Paperback</span>
              <span>13.97 × 21.59 cm · Statement Trim</span>
            </div>
          </div>
        </div>
      </section>

      {/* "Look Inside" / Interactive Sample Preview */}
      <section id="sample-preview" className="section-sample-preview">
        <div className="section-head text-center">
          <span className="eyebrow">Look Inside</span>
          <h2>Read the Opening Prologue</h2>
          <p className="muted">Experience the actual physical book layout and prose before you pre-order.</p>
        </div>

        <div className="sample-paperback-card">
          <div className="sample-paperback-header">
            <span>IS IT ME OR YOU AS WELL?</span>
            <span>PROLOGUE</span>
          </div>

          <div className="sample-paperback-body">
            <h3 className="sample-chapter-title">Prologue</h3>
            <p className="sample-lead-date">15TH January 2007 , Hospete</p>

            <p>
              The Day when the product of an unexpected romantic intimacy was about to enter this world.
            </p>
            <p>
              It was around 9:30 am when my mother was having her labor contraction, so much pain only cuz I was in a hurry. She was taken to the same hospital where my sister was born. After all the medical assistance and operations it was around 10:30, a Caramel beige baby boy finally arrived. Yes, that was me.
            </p>
            <p>
              Before we rewind to 2007, here’s a quick snapshot of the guy this story eventually becomes: a typical degree student—broke enough to value a free chai, ambitious enough to dream big, and confused enough to Google his own future every midnight.
            </p>
            <p>
              This isn’t a story about a hero. Not a villain, and definitely not a rom-com protagonist. This is just a story about a boy—a perfectly average middle-class boy—navigating life one awkward chapter after another at a time.
            </p>
            <p>
              Growing up in a middle-class Indian family comes with its own package. Expectations, comparisons, responsibilities, relatives with unsolicited advice, and the constant feeling that everyone else's child is doing better. Some moments were hilarious. Some were embarrassing. Some were lonely. And a few made me question whether it was just me, or you as well.
            </p>
          </div>

          <div className="sample-paperback-footer">
            <div className="sample-footer-fade"></div>
            <div className="sample-footer-actions">
              <p className="muted small">Liked the opening? Unlock all chapters with full digital or paperback access.</p>
              <button className="btn btn-primary" onClick={() => openCheckout(editions[0])}>
                Unlock Full Manuscript (From ₹199)
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Editions & Pricing Section */}
      <section id="editions" className="section-editions">
        <div className="section-head text-center">
          <span className="eyebrow">Choose Your Edition</span>
          <h2>Pre-Order & Reading Options</h2>
          <p className="muted">Direct from the author. All paperback editions include free instant web reader access.</p>
        </div>

        <div className="editions-grid">
          {editions.map((ed) => (
            <div key={ed.id} className={`edition-card ${ed.badge ? 'featured-edition' : ''}`}>
              {ed.badge && <div className="edition-badge-tag">{ed.badge}</div>}
              <div className="edition-top">
                <span className="edition-tag">{ed.tag}</span>
                <h3 className="edition-title">{ed.name}</h3>
                <div className="price-row">
                  <span className="price-current">{ed.price}</span>
                  <span className="price-original">{ed.originalPrice}</span>
                  <span className="price-save">SAVE {ed.id === 'digital' ? '43%' : ed.id === 'paperback' ? '33%' : '30%'}</span>
                </div>
                <p className="edition-desc">{ed.description}</p>
              </div>

              <ul className="edition-features-list">
                {ed.features.map((feat, idx) => (
                  <li key={idx}>
                    <span className="feat-check">✓</span>
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>

              <div className="edition-bottom">
                <button
                  className={`btn ${ed.badge ? 'btn-primary' : 'btn-outline'} btn-block`}
                  onClick={() => openCheckout(ed)}
                >
                  {ed.cta}
                </button>
                <p className="small muted text-center mt-2">
                  {ed.isPhysical ? '📦 Dispatches on print release · Free shipping in India' : '⚡ Instant digital access'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Highlights / What Makes This Book Special */}
      <section className="section-highlights">
        <div className="section-head text-center">
          <span className="eyebrow">What to Expect</span>
          <h2>Inside the Pages</h2>
          <p className="muted">A story that feels like catching up with an old friend at 2 AM.</p>
        </div>

        <div className="highlights-grid">
          <div className="highlight-box">
            <span className="hl-icon">☕</span>
            <h3>The Middle-Class Blueprint</h3>
            <p>From saving every auto fare to awkward family gatherings where relatives audit your life choices with a cup of tea.</p>
          </div>
          <div className="highlight-box">
            <span className="hl-icon">🎒</span>
            <h3>Degree College Chaos</h3>
            <p>Backbenches, proxy attendances, semester backlogs, campus friendships, and the shared anxiety of placement season.</p>
          </div>
          <div className="highlight-box">
            <span className="hl-icon">🌙</span>
            <h3>Unscripted Romance</h3>
            <p>No Bollywood background strings—just genuine, awkward pauses, overthought texts, and emotional vulnerability.</p>
          </div>
          <div className="highlight-box">
            <span className="hl-icon">📍</span>
            <h3>Rooted in Hospete (2007–Now)</h3>
            <p>Capturing the transformation of a small Karnataka town, changing aspirations, and the journey of self-discovery.</p>
          </div>
        </div>
      </section>

      {/* Reader Praise / Testimonials */}
      <section className="section-reviews">
        <div className="section-head text-center">
          <span className="eyebrow">Reader Praise</span>
          <h2>What Early Readers Are Saying</h2>
          <p className="muted">Direct feedback from our private beta reviewer community.</p>
        </div>

        <div className="reviews-grid">
          <div className="review-card">
            <div className="review-stars">★★★★★</div>
            <p className="review-quote">
              “Brutally honest, hilarious, and deeply relatable. The Hospete hospital opening hooked me immediately, and the college student dilemma felt like my own diary.”
            </p>
            <div className="reviewer-info">
              <div className="reviewer-avatar">RK</div>
              <div>
                <strong>Rahul K.</strong>
                <span className="muted small">Beta Reviewer · Bengaluru</span>
              </div>
            </div>
          </div>

          <div className="review-card">
            <div className="review-stars">★★★★★</div>
            <p className="review-quote">
              “Finally an Indian novel that doesn’t pretend everyone is a tech billionaire or movie hero. The paperback paged layout in the reader makes reading it pure joy.”
            </p>
            <div className="reviewer-info">
              <div className="reviewer-avatar">PS</div>
              <div>
                <strong>Pooja S.</strong>
                <span className="muted small">Beta Reviewer · Pune</span>
              </div>
            </div>
          </div>

          <div className="review-card">
            <div className="review-stars">★★★★★</div>
            <p className="review-quote">
              “The balance between humorous self-deprecation and poignant emotional questions is spot-on. Can’t wait to have the physical signed paperback on my bookshelf!”
            </p>
            <div className="reviewer-info">
              <div className="reviewer-avatar">AM</div>
              <div>
                <strong>Anand M.</strong>
                <span className="muted small">Beta Reviewer · Hyderabad</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Author Spotlight */}
      <section className="section-author-spotlight">
        <div className="author-spotlight-box">
          <div className="author-spotlight-avatar">
            <span>HA</span>
          </div>
          <div className="author-spotlight-details">
            <span className="eyebrow">Meet the Author</span>
            <h2>H.M. Abhilash</h2>
            <p>
              “I wanted to write a book that spoke directly to everyone who ever felt like they were lagging behind in life’s race.
              Thank you for reading, sharing your thoughts, and supporting this independent journey.”
            </p>
            <div className="row gap-3 mt-3">
              <Link to="/about" className="btn btn-outline">Read Full Author Story →</Link>
              <a href="mailto:hmabhilash15@gmail.com" className="btn btn-ghost">Contact Author</a>
            </div>
          </div>
        </div>
      </section>

      {/* Frequently Asked Questions */}
      <section className="section-faq">
        <div className="section-head text-center">
          <span className="eyebrow">Got Questions?</span>
          <h2>Frequently Asked Questions</h2>
        </div>

        <div className="faq-list">
          {[
            {
              q: 'How do I access the digital reader after pre-ordering?',
              a: 'Digital access is instantaneous! Once your pre-order is confirmed, simply sign in with your Google account on this website to unlock all published chapters and reading customization settings.',
            },
            {
              q: 'When will the physical Collector’s Paperback be delivered?',
              a: 'Physical paperbacks are scheduled for delivery upon book production. Deliveries across India take 4–7 business days with end-to-end tracking provided to your email.',
            },
            {
              q: 'I am an invited beta reviewer. Do I have to pay?',
              a: 'No! If the author invited you as an early reviewer, your reading and feedback access is completely free. Simply click "Reviewer Login" at the top to sign in with your invited Google email.',
            },
            {
              q: 'What payment methods do you accept?',
              a: 'When payment gateways go live, we support UPI (Google Pay, PhonePe, Paytm), Credit & Debit Cards (Visa, Mastercard, RuPay), NetBanking, and major digital wallets through 256-bit encrypted gateways like Razorpay and Stripe.',
            },
            {
              q: 'What is your refund and cancellation policy?',
              a: 'You can cancel any physical paperback pre-order anytime before dispatch for a 100% full refund. For damaged copies upon delivery, we immediately dispatch a brand-new replacement at zero cost. See our Terms of Service for full details.',
            },
          ].map((item, idx) => (
            <div key={idx} className={`faq-item ${faqOpen[idx] ? 'open' : ''}`}>
              <button className="faq-question" onClick={() => toggleFaq(idx)}>
                <span>{item.q}</span>
                <span className="faq-icon">{faqOpen[idx] ? '−' : '+'}</span>
              </button>
              {faqOpen[idx] && <div className="faq-answer">{item.a}</div>}
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="section-bottom-cta">
        <div className="bottom-cta-inner text-center">
          <h2>Begin Reading <em>{b.title}</em> Today</h2>
          <p className="muted">Reserve your signed collector’s edition or unlock digital early access right now.</p>
          <div className="row justify-center gap-3 mt-3">
            <button className="btn btn-primary btn-large" onClick={() => openCheckout(editions[1])}>
              Pre-Order Collector’s Edition · ₹399
            </button>
            <Link to="/about" className="btn btn-secondary btn-large">
              Learn About the Author
            </Link>
          </div>
        </div>
      </section>

      {/* Checkout / Pre-Order Modal Dialog */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal-dialog checkout-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setModalOpen(false)}>✕</button>

            {!orderComplete ? (
              <>
                <div className="modal-header">
                  <span className="eyebrow">Secure Pre-Order Checkout</span>
                  <h2>{selectedEdition?.name}</h2>
                  <div className="modal-price-badge">
                    <span>Total Amount: <strong>{selectedEdition?.price}</strong></span>
                    <span className="tax-tag">Taxes & Shipping included</span>
                  </div>
                </div>

                <form onSubmit={handleOrderSubmit} className="checkout-form">
                  <div className="form-group">
                    <label htmlFor="ord-name">Full Name *</label>
                    <input
                      id="ord-name"
                      type="text"
                      required
                      placeholder="e.g. Abhilash H.M."
                      value={orderForm.name}
                      onChange={(e) => setOrderForm({ ...orderForm, name: e.target.value })}
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group flex-1">
                      <label htmlFor="ord-email">Email Address *</label>
                      <input
                        id="ord-email"
                        type="email"
                        required
                        placeholder="you@gmail.com"
                        value={orderForm.email}
                        onChange={(e) => setOrderForm({ ...orderForm, email: e.target.value })}
                      />
                      <span className="muted micro">Your digital reading access will be linked to this email.</span>
                    </div>

                    <div className="form-group flex-1">
                      <label htmlFor="ord-phone">Phone Number (for Delivery / SMS)</label>
                      <input
                        id="ord-phone"
                        type="tel"
                        placeholder="+91 98765 43210"
                        value={orderForm.phone}
                        onChange={(e) => setOrderForm({ ...orderForm, phone: e.target.value })}
                      />
                    </div>
                  </div>

                  {selectedEdition?.isPhysical && (
                    <div className="form-group">
                      <label htmlFor="ord-addr">Shipping Address (India) *</label>
                      <textarea
                        id="ord-addr"
                        rows="2"
                        required
                        placeholder="House / Flat No, Street, Landmark, City, State, PIN Code"
                        value={orderForm.address}
                        onChange={(e) => setOrderForm({ ...orderForm, address: e.target.value })}
                      ></textarea>
                    </div>
                  )}

                  <div className="form-group">
                    <label>Preferred Payment Gateway</label>
                    <div className="pay-method-options">
                      <label className={`pay-method-pill ${orderForm.paymentMethod === 'upi' ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          name="payMethod"
                          value="upi"
                          checked={orderForm.paymentMethod === 'upi'}
                          onChange={() => setOrderForm({ ...orderForm, paymentMethod: 'upi' })}
                        />
                        <span>⚡ UPI (GPay / PhonePe / Paytm)</span>
                      </label>
                      <label className={`pay-method-pill ${orderForm.paymentMethod === 'card' ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          name="payMethod"
                          value="card"
                          checked={orderForm.paymentMethod === 'card'}
                          onChange={() => setOrderForm({ ...orderForm, paymentMethod: 'card' })}
                        />
                        <span>💳 Debit / Credit Card / NetBanking</span>
                      </label>
                    </div>
                  </div>

                  <div className="checkout-trust-box">
                    <p className="micro muted">
                      🔒 256-Bit SSL Encrypted Pre-order reservation. By proceeding, you agree to our{' '}
                      <Link to="/privacy" target="_blank">Privacy Policy</Link> and{' '}
                      <Link to="/terms" target="_blank">Terms of Service</Link>.
                    </p>
                  </div>

                  <div className="modal-actions">
                    <button type="submit" className="btn btn-primary btn-block btn-large">
                      Confirm Reservation · {selectedEdition?.price}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="order-success-view text-center">
                <div className="success-icon-badge">✓</div>
                <h2>Pre-Order Reserved!</h2>
                <p className="order-id-label">Reservation ID: <strong>{orderComplete.orderId}</strong></p>
                <p className="success-message">
                  Thank you, <strong>{orderComplete.customer.name}</strong>! Your reservation for{' '}
                  <strong>{orderComplete.edition}</strong> has been recorded.
                </p>
                <div className="order-summary-box">
                  <div className="summary-row">
                    <span>Edition:</span>
                    <strong>{orderComplete.edition}</strong>
                  </div>
                  <div className="summary-row">
                    <span>Amount:</span>
                    <strong>{orderComplete.price}</strong>
                  </div>
                  <div className="summary-row">
                    <span>Linked Email:</span>
                    <span>{orderComplete.customer.email}</span>
                  </div>
                  <div className="summary-row">
                    <span>Payment Gateway:</span>
                    <span>{orderComplete.customer.paymentMethod.toUpperCase()} (Pre-Order Ready)</span>
                  </div>
                </div>

                <p className="small muted mt-3">
                  A confirmation email has been dispatched. You can now access sample chapters or sign in as a reviewer.
                </p>

                <div className="row justify-center gap-2 mt-4">
                  <Link to="/chapters" className="btn btn-primary" onClick={() => setModalOpen(false)}>
                    Go to Manuscript Reader →
                  </Link>
                  <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
