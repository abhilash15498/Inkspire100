import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function About() {
  const { user } = useAuth();

  return (
    <article className="about-page">
      <header className="about-hero">
        <span className="eyebrow">The Story & The Journey</span>
        <h1 className="about-title">About the Novel & The Author</h1>
        <p className="about-subtitle">
          From a hospital room in Hospete in 2007 to late-night college tea stalls—the candid story of an ordinary Indian boy navigating life, dreams, and awkward heartbreaks.
        </p>
      </header>

      <section className="about-grid">
        <div className="about-content">
          <div className="about-card quote-banner">
            <blockquote>
              “This isn’t a story about a hero. Not a villain, and definitely not a rom-com protagonist.
              This is just a story about a boy—a perfectly average middle-class boy—navigating life one awkward chapter after another at a time.”
            </blockquote>
            <cite>— H.M. Abhilash, from the Prologue</cite>
          </div>

          <h2>The Genesis of the Novel</h2>
          <p>
            Every great journey starts with an ordinary beginning. On 15th January 2007 in Hospete, Karnataka,
            a caramel beige baby boy entered the world in a hurry. What followed was the quintessential Indian middle-class upbringing—a world of unspoken parental sacrifices, unsolicited relative advice, engineering dreams, midnight chai, and the persistent pressure that everyone else’s child is somehow doing better.
          </p>
          <p>
            <em>Is It Me or You as Well?</em> was born from a desire to tell the unvarnished truth. Not an idealized fiction of billionaire romance or flawless movie characters, but the authentic comedy, confusion, loneliness, and triumphs of young people growing up in India today.
          </p>

          <h2>Core Themes</h2>
          <div className="theme-cards-grid">
            <div className="theme-card">
              <span className="theme-icon">🏡</span>
              <h3>Middle-Class Realities</h3>
              <p>The hilarious yet poignant pressure of parental expectations, relative comparisons, and learning the value of every single rupee.</p>
            </div>
            <div className="theme-card">
              <span className="theme-icon">☕</span>
              <h3>Nostalgia & Friendship</h3>
              <p>From cycle rides in Hospete to canteen debates and late-night Google searches trying to figure out what the future holds.</p>
            </div>
            <div className="theme-card">
              <span className="theme-icon">💌</span>
              <h3>Messy, Honest Romance</h3>
              <p>Romance without the cinematic slow-motion wind—awkward conversations, unspoken feelings, misunderstandings, and true emotional warmth.</p>
            </div>
            <div className="theme-card">
              <span className="theme-icon">📖</span>
              <h3>Finding One's Voice</h3>
              <p>The quiet courage to question what society prescribes and carve out a path that feels genuinely your own.</p>
            </div>
          </div>

          <h2>About the Author — H.M. Abhilash</h2>
          <p>
            H.M. Abhilash is an author, observer, and developer. Passionate about both literary craft and technology, Abhilash built this private reading platform to give readers an authentic, distraction-free reading experience modeled after a physical 5.5" × 8.5" Statement Paperback.
          </p>
          <p>
            Rather than locking the manuscript away behind traditional publishing walls, Abhilash chose an open, collaborative model—inviting early reviewers directly into the workshop to review chapters as they are polished, before releasing the collector's paperback edition worldwide.
          </p>

          <h2>The Reading Experience</h2>
          <p>
            Every page in the web reader is calibrated to replicate the exact feel of a paperback novel:
          </p>
          <ul className="about-perks-list">
            <li><strong>Standard Paperback Proportions:</strong> Standard 13.97 cm × 21.59 cm trim with 1.27 cm authentic margins.</li>
            <li><strong>Custom Book Typography:</strong> Hand-picked book serif typefaces (Literata, Lora, Garamond) with zero-hyphenation line flow.</li>
            <li><strong>Private Reader Feedback:</strong> Direct feedback pipeline where reviewers can highlight notes on character, pacing, and plot.</li>
          </ul>

          <div className="about-cta-box">
            <h3>Ready to Experience the Story?</h3>
            <p>Read sample chapters on the storefront, pre-order the collector's edition, or sign in to your reviewer library.</p>
            <div className="row">
              <Link to="/" className="btn btn-primary">Visit Storefront</Link>
              {user ? (
                <Link to="/chapters" className="btn">Open Chapter Library</Link>
              ) : (
                <Link to="/login" className="btn">Reviewer Sign In</Link>
              )}
            </div>
          </div>
        </div>

        <aside className="about-sidebar">
          <div className="sidebar-card author-profile-card">
            <div className="author-avatar-badge">HA</div>
            <h3>H.M. Abhilash</h3>
            <p className="author-role">Author & Creator</p>
            <div className="author-facts">
              <div className="fact-row">
                <span className="fact-label">Origin:</span>
                <span className="fact-val">Hospete, Karnataka</span>
              </div>
              <div className="fact-row">
                <span className="fact-label">Current Work:</span>
                <span className="fact-val">Is It Me or You as Well?</span>
              </div>
              <div className="fact-row">
                <span className="fact-label">Genre:</span>
                <span className="fact-val">Contemporary Fiction / Coming of Age</span>
              </div>
              <div className="fact-row">
                <span className="fact-label">Format:</span>
                <span className="fact-val">Paperback & Digital Reader</span>
              </div>
            </div>
          </div>

          <div className="sidebar-card contact-card">
            <h3>Connect & Inquiries</h3>
            <p className="small muted">
              For literary inquiries, book club features, beta reviewer requests, or interview invitations:
            </p>
            <a href="mailto:hmabhilash15@gmail.com" className="contact-email-btn">
              ✉ hmabhilash15@gmail.com
            </a>
            <div className="social-links-row">
              <span className="social-pill">Instagram: @author</span>
              <span className="social-pill">Goodreads</span>
            </div>
          </div>

          <div className="sidebar-card trust-card">
            <h3>Pre-Order & Monetization</h3>
            <p className="small muted">
              All digital and physical pre-orders are processed securely with SSL encryption. Readers receive immediate digital access to ongoing chapters.
            </p>
            <Link to="/privacy" className="small subtle-link">Privacy Policy →</Link>
            <br />
            <Link to="/terms" className="small subtle-link">Terms & Refund Policy →</Link>
          </div>
        </aside>
      </section>
    </article>
  );
}
