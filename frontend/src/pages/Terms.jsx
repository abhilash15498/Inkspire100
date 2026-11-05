import { Link } from 'react-router-dom';

export default function Terms() {
  const lastUpdated = 'November 5, 2026';

  return (
    <article className="legal-page narrow">
      <header className="legal-header">
        <span className="eyebrow">Legal & Compliance</span>
        <h1>Terms of Service & Refund Policy</h1>
        <p className="muted small">Last updated: {lastUpdated} · Effective immediately</p>
      </header>

      <div className="legal-body">
        <p>
          These Terms of Service (“Terms”) govern your access to and use of the website, digital reader, and e-commerce services for the novel <strong>“Is It Me or You as Well?”</strong>, created and published by H.M. Abhilash (“Author”, “we”, or “us”). By accessing our site or placing a pre-order, you agree to be bound by these Terms.
        </p>

        <section>
          <h2>1. Intellectual Property & Copyright Protection</h2>
          <p>
            All novel contents, including without limitation the story, prologue, chapters, character names, plot developments, prose, dialogue, illustrations, logos, and website design, are the exclusive intellectual property of H.M. Abhilash and protected under the Indian Copyright Act, 1957, the Berne Convention, and international copyright treaties.
          </p>
          <p>
            <strong>Strict Prohibition:</strong> You are granted a personal, non-exclusive, non-transferable revocable license to read the novel. You may NOT copy, reproduce, screenshot in bulk, republish, redistribute, upload to public repositories, re-sell, or feed into machine learning / AI datasets any part of this manuscript without prior written permission from the Author.
          </p>
        </section>

        <section>
          <h2>2. Editions & Digital Reader Access</h2>
          <ul>
            <li>
              <strong>Digital Reader Access:</strong> Grants instantaneous online access to the full novel manuscript via our distraction-free, paged paperback reader interface on desktop, tablet, and mobile.
            </li>
            <li>
              <strong>Collector's Paperback Edition:</strong> Includes a physical printed book (5.5" × 8.5" Statement trim, cream-wove book paper, matte/silk finish cover, and custom bookmark) shipped to your specified address, plus complimentary instant digital web reader access.
            </li>
            <li>
              <strong>Patron Edition:</strong> Includes a signed physical copy with a personalized inscription, your name credited in the book's official Acknowledgments, and lifetime early draft access.
            </li>
          </ul>
        </section>

        <section>
          <h2>3. Pricing & Payment Terms</h2>
          <p>
            All prices are stated in Indian Rupees (₹ INR) and include applicable taxes unless specified otherwise. International orders are calculated based on real-time currency conversions.
          </p>
          <p>
            Payments are securely collected using trusted, certified third-party payment gateways (such as Razorpay, Stripe, UPI, Cards, and NetBanking). We do not store financial card details on our servers.
          </p>
        </section>

        <section>
          <h2>4. Shipping & Delivery Policy</h2>
          <ul>
            <li>
              <strong>Digital Products:</strong> Digital eBook reader access is activated immediately upon successful authentication or pre-order confirmation.
            </li>
            <li>
              <strong>Physical Paperback Delivery:</strong> For pre-orders of the physical book, dispatch commences as soon as the print edition is produced. Standard domestic delivery within India takes 4–7 business days following dispatch. Tracking numbers will be emailed to you upon shipment.
            </li>
          </ul>
        </section>

        <section>
          <h2>5. Cancellation & Refund Policy</h2>
          <p>We want every reader to be delighted with their experience. Our refund policy is structured as follows:</p>
          <ul>
            <li>
              <strong>Digital Web Reader:</strong> Due to the immediate delivery and unretrievable nature of digital literary content, digital eBook purchases are generally non-refundable once accessed. If you experience technical issues accessing the manuscript, please contact us immediately for assistance.
            </li>
            <li>
              <strong>Physical Paperback Pre-Orders:</strong> You may cancel your physical paperback pre-order anytime prior to the dispatch date for a 100% full refund to your original payment method.
            </li>
            <li>
              <strong>Damaged or Defective Copies:</strong> If your physical paperback arrives damaged, misprinted, or defective, contact us with a photo of the defect within 7 days of delivery. We will immediately dispatch a brand-new replacement copy at zero additional cost to you.
            </li>
          </ul>
        </section>

        <section>
          <h2>6. Reviewer Code of Conduct</h2>
          <p>
            Invited beta reviewers are granted privileged early access to unreleased drafts and chapters. Reviewers agree to provide constructive, honest feedback and to maintain confidentiality regarding unpublished plot twists and drafts prior to public retail release.
          </p>
        </section>

        <section>
          <h2>7. Governing Law & Dispute Resolution</h2>
          <p>
            These Terms shall be governed by and construed in accordance with the laws of the Republic of India. Any disputes arising out of or in connection with these Terms or the purchase of the novel shall be subject to the exclusive jurisdiction of the competent courts in Karnataka, India.
          </p>
        </section>

        <section>
          <h2>8. Contact & Customer Support</h2>
          <p>For questions regarding your pre-order, refunds, shipping, or manuscript permissions:</p>
          <div className="contact-box">
            <strong>H.M. Abhilash</strong><br />
            Author & Publisher<br />
            Hospete, Karnataka, India<br />
            Email: <a href="mailto:hmabhilash15@gmail.com">hmabhilash15@gmail.com</a>
          </div>
        </section>

        <div className="legal-footer-nav">
          <Link to="/" className="btn">← Back to Storefront</Link>
          <Link to="/privacy" className="btn btn-ghost">Read Privacy Policy →</Link>
        </div>
      </div>
    </article>
  );
}
