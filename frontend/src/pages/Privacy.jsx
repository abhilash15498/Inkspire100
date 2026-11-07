import { Link } from 'react-router-dom';

export default function Privacy() {
  const lastUpdated = 'November 5, 2026';

  return (
    <article className="legal-page narrow">
      <header className="legal-header">
        <span className="eyebrow">Legal & Compliance</span>
        <h1>Privacy Policy</h1>
        <p className="muted small">Last updated: {lastUpdated} · Effective immediately</p>
      </header>

      <div className="legal-body">
        <p>
          Welcome to the official website and reading platform for the novel <strong>“Is It Me or You as Well?”</strong>,
          authored and operated by H.M. Abhilash (“we”, “us”, or “our”). We respect your privacy and are committed
          to protecting your personal information in accordance with applicable data protection laws, including the
          Information Technology Act, 2000 (India), the Digital Personal Data Protection (DPDP) Act, 2023, and international
          privacy best practices.
        </p>

        <section>
          <h2>1. Information We Collect</h2>
          <p>We collect only the minimum necessary information required to deliver the novel, manage pre-orders, and facilitate reader feedback:</p>
          <ul>
            <li>
              <strong>Google Account Information:</strong> When you sign in via Google OAuth, we receive your name, email address,
              and unique Google subscriber identifier. We do not receive, access, or store your Google password.
            </li>
            <li>
              <strong>Order & Purchase Information:</strong> If you pre-order or purchase an edition of the novel (digital eBook or physical paperback),
              we collect your name, contact email, delivery address (for physical paperbacks), and phone number (for dispatch notifications).
              <em>Note: All credit card, debit card, UPI, and net banking transactions are processed securely by PCI-DSS compliant payment gateways (such as Razorpay or Stripe). We never store or process your financial card credentials.</em>
            </li>
            <li>
              <strong>Reader Feedback & Interactions:</strong> Any comments, chapter reviews, feedback categories, or suggestions you submit through the reader feedback form are stored securely to allow the author to improve the manuscript.
            </li>
            <li>
              <strong>Reading Preferences:</strong> We store your reading preferences (chosen font family, font size, reading theme, and last read chapter) locally on your device using browser LocalStorage for your convenience.
            </li>
          </ul>
        </section>

        <section>
          <h2>2. How We Use Your Information</h2>
          <p>We use the collected information solely for legitimate purposes:</p>
          <ul>
            <li>To grant you access to protected novel chapters and manuscript drafts.</li>
            <li>To process pre-orders, verify payments, and ship physical copies of the novel.</li>
            <li>To enable beta reviewer feedback and author-reader correspondence.</li>
            <li>To safeguard the manuscript against unauthorized copying, web-scraping, or piracy.</li>
            <li>To send critical updates regarding book releases, shipping tracking, or policy updates (you may opt out at any time).</li>
          </ul>
        </section>

        <section>
          <h2>3. Cookies & Browser Storage</h2>
          <p>Our platform uses standard, secure web technologies to maintain your session:</p>
          <ul>
            <li>
              <strong>Session Cookie (<code>session</code>):</strong> A secure, HTTP-only cookie that authenticates your account. It cannot be accessed by client-side scripts and expires automatically after 7 days.
            </li>
            <li>
              <strong>LocalStorage:</strong> Used exclusively to persist your display settings (e.g., Paper/Sepia/Night mode, Literata/Garamond font choice) so your reading experience remains consistent across sessions.
            </li>
          </ul>
        </section>

        <section>
          <h2>4. Information Sharing & Third Parties</h2>
          <p>
            <strong>We do not sell, rent, trade, or monetize your personal data.</strong> Your information is shared only with trusted service providers necessary to operate the platform:
          </p>
          <ul>
            <li><strong>Google Identity Services:</strong> For secure OAuth sign-in and account verification.</li>
            <li><strong>Payment Gateways (Razorpay / Stripe):</strong> For processing pre-orders and e-commerce payments securely.</li>
            <li><strong>Cloud Infrastructure (Neon / AWS):</strong> Encrypted database hosting to securely store chapter drafts, order records, and user feedback.</li>
            <li><strong>Courier / Postal Services:</strong> Only your name, shipping address, and phone number are shared with logistics partners to fulfill physical book deliveries.</li>
          </ul>
        </section>

        <section>
          <h2>5. Data Security & Manuscript Protection</h2>
          <p>
            We implement industry-standard technical safeguards, including 256-bit SSL/TLS encryption for all data in transit,
            CSRF protection, rate limiting on authentication endpoints, and strict role-based access controls.
            Unpublished manuscript drafts are strictly isolated to verified reviewers and the author.
          </p>
        </section>

        <section>
          <h2>6. Your Data Rights</h2>
          <p>You have the following rights regarding your personal information:</p>
          <ul>
            <li><strong>Access & Review:</strong> You can view your saved feedback and account profile at any time in the reader portal.</li>
            <li><strong>Data Correction:</strong> You can update or edit your submitted reviews directly in the feedback portal.</li>
            <li><strong>Account & Data Deletion:</strong> You may request the permanent deletion of your account, order history, and feedback by emailing the author at the address below.</li>
          </ul>
        </section>

        <section>
          <h2>7. Grievance Officer & Contact</h2>
          <p>
            For any questions, concerns, or data requests regarding this Privacy Policy, please contact our Grievance Officer:
          </p>
          <div className="contact-box">
            <strong>H.M. Abhilash</strong><br />
            Author & Data Controller<br />
            Hospete, Karnataka, India<br />
            Email: <a href="mailto:hmabhilash15@gmail.com">hmabhilash15@gmail.com</a>
          </div>
          <p className="small muted">
            We review and respond to all verified inquiries within 30 days of receipt.
          </p>
        </section>

        <div className="legal-footer-nav">
          <Link to="/" className="btn">← Back to Storefront</Link>
          <Link to="/terms" className="btn btn-ghost">Terms of Service & Refunds →</Link>
        </div>
      </div>
    </article>
  );
}

