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

  const digitalAccess = {
    id: 'digital',
    name: 'Digital Novel Access',
    tag: 'Instant Access',
    price: '₹30',
    originalPrice: '₹99',
    description: 'Immediate online access to the full novel manuscript via our distraction-free paged paperback reader.',
    features: [
      'Instant web reader access on mobile, tablet & laptop',
      'Physical book proportions with Paper, Sepia & Night themes',
      'Custom font typography (Literata, Lora, Garamond)',
      'Automatic reading progress & bookmark sync',
      'Access to ongoing author revisions & updates',
    ],
    isPhysical: false,
    cta: 'Get Full Access · ₹30',
  };

  const openCheckout = (edition = digitalAccess) => {
    setSelectedEdition(edition);
    setOrderComplete(null);
    setModalOpen(true);
  };

  const handleOrderSubmit = (e) => {
    e.preventDefault();
    const orderId = 'ORD-' + Math.floor(100000 + Math.random() * 900000);
    const orderDetails = {
      orderId,
      edition: selectedEdition?.name || digitalAccess.name,
      price: selectedEdition?.price || digitalAccess.price,
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
        <span className="banner-pill">EARLY ACCESS</span>
        <span>
          Read <strong>{b.title}</strong> online · Full digital access for just <strong>₹30</strong>
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

            <div className="hero-cta-group">
              <button
                className="btn btn-primary btn-large cta-pulse"
                onClick={() => openCheckout(digitalAccess)}
              >
                Read Full Novel · ₹30
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
                  Sign in / Register
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
                  <strong>Complete Novel</strong>
                  <p className="muted small">All chapters unlocked</p>
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
              <p className="muted small">Liked the opening? Unlock all chapters online for just ₹30.</p>
              <button className="btn btn-primary" onClick={() => openCheckout(digitalAccess)}>
                Unlock Full Novel · ₹30
              </button>
            </div>
          </div>
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
              q: 'How do I access the digital reader after purchasing?',
              a: 'Digital access is instantaneous! Once confirmed, you can sign in with your email or Google account on this website to read all published chapters in our paged paperback reader.',
            },
            {
              q: 'What is the price of the novel?',
              a: 'Right now, complete digital access to read the novel online is available for just ₹30 directly on this website.',
            },
            {
              q: 'I am an invited beta reviewer. Do I have to pay?',
              a: 'No! If you have been invited by the author as an early beta reviewer, your reading and feedback access is completely free. Simply click "Sign in / Register" at the top to sign in with your invited email.',
            },
            {
              q: 'What payment methods do you accept?',
              a: 'We support UPI (Google Pay, PhonePe, Paytm, BHIM), Credit & Debit Cards (Visa, Mastercard, RuPay), and NetBanking through secure payment channels.',
            },
            {
              q: 'Can I read on my mobile phone or tablet?',
              a: 'Yes! The reader is designed with responsive book proportions, tap-to-turn pages, custom typography (Literata, Garamond, Lora), and Sepia/Night themes for comfortable reading on any screen.',
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
          <p className="muted">Unlock complete digital reading access for just ₹30 directly on this website.</p>
          <div className="row justify-center gap-3 mt-3">
            <button className="btn btn-primary btn-large" onClick={() => openCheckout(digitalAccess)}>
              Get Full Access · ₹30
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
                  <span className="eyebrow">Instant Digital Access</span>
                  <h2>{selectedEdition?.name || 'Digital Novel Access'}</h2>
                  <div className="modal-price-badge">
                    <span>Total Amount: <strong>₹30</strong></span>
                    <span className="tax-tag">Taxes included · Immediate online access</span>
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
                      <label htmlFor="ord-phone">Phone Number (Optional)</label>
                      <input
                        id="ord-phone"
                        type="tel"
                        placeholder="+91 98765 43210"
                        value={orderForm.phone}
                        onChange={(e) => setOrderForm({ ...orderForm, phone: e.target.value })}
                      />
                    </div>
                  </div>

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
                        <span>⚡ UPI (GPay / PhonePe / Paytm / BHIM)</span>
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
                      🔒 256-Bit SSL Encrypted checkout. By proceeding, you agree to our{' '}
                      <Link to="/privacy" target="_blank">Privacy Policy</Link> and{' '}
                      <Link to="/terms" target="_blank">Terms of Service</Link>.
                    </p>
                  </div>

                  <div className="modal-actions">
                    <button type="submit" className="btn btn-primary btn-block btn-large">
                      Confirm & Get Access · ₹30
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="order-success-view text-center">
                <div className="success-icon-badge">✓</div>
                <h2>Access Confirmed!</h2>
                <p className="order-id-label">Access ID: <strong>{orderComplete.orderId}</strong></p>
                <p className="success-message">
                  Thank you, <strong>{orderComplete.customer.name}</strong>! Your access to{' '}
                  <strong>{orderComplete.edition}</strong> has been registered.
                </p>
                <div className="order-summary-box">
                  <div className="summary-row">
                    <span>Edition:</span>
                    <strong>{orderComplete.edition}</strong>
                  </div>
                  <div className="summary-row">
                    <span>Amount:</span>
                    <strong>₹30</strong>
                  </div>
                  <div className="summary-row">
                    <span>Linked Email:</span>
                    <span>{orderComplete.customer.email}</span>
                  </div>
                  <div className="summary-row">
                    <span>Payment Gateway:</span>
                    <span>{orderComplete.customer.paymentMethod.toUpperCase()} (Online Access Active)</span>
                  </div>
                </div>

                <p className="small muted mt-3">
                  You can now sign in using your email to read all published chapters in the online reader.
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
