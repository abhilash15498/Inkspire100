import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import FeedbackItem, { CategorySelect } from '../components/FeedbackItem.jsx';
import { PagedBookReader } from '../components/PagedBookReader.jsx';
import UnlockModal from '../components/UnlockModal.jsx';
import { ChapterText } from '../markdown.jsx';
import { Chip, Loading, LoadError, Notice, errMsg, fmtDate, readingMinutes, useAsync, usePref } from '../ui.jsx';

const SIZES = ['3xs', '2xs', 'xs', 'sm', 'md', 'lg', 'xl'];

function FeedbackSection({ chapterId, version }) {
  const mine = useAsync(() => api.get(`/chapters/${chapterId}/feedback`), [chapterId]);
  const [comment, setComment] = useState('');
  const [category, setCategory] = useState('general');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setSent(false);
    try {
      const d = await api.post(`/chapters/${chapterId}/feedback`, { comment, category });
      mine.setData((cur) => ({ feedback: [d.feedback, ...(cur?.feedback || [])] }));
      setComment('');
      setSent(true);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="feedback-section" aria-labelledby="fb-heading">
      <h2 id="fb-heading">Your feedback on this chapter</h2>
      <form onSubmit={submit} className="stack">
        <label htmlFor="fb-comment">What did you think? (You are commenting on version {version}.)</label>
        <textarea
          id="fb-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={6}
          maxLength={5000}
          placeholder="Anything that stood out, confused you, or you would change."
        />
        <div className="row">
          <label htmlFor="fb-category">Category</label>
          <CategorySelect id="fb-category" value={category} onChange={setCategory} />
          <span className="muted small">{comment.length}/5000</span>
        </div>
        <div className="row">
          <button className="btn btn-primary" disabled={busy || !comment.trim()}>
            {busy ? 'Sending…' : 'Send feedback'}
          </button>
        </div>
        <Notice kind="error">{error}</Notice>
        <Notice kind="success">{sent ? 'Thank you. Your feedback was sent.' : ''}</Notice>
      </form>

      {mine.loading ? (
        <Loading />
      ) : mine.error ? (
        <LoadError error={mine.error} />
      ) : (
        mine.data.feedback.length > 0 && (
          <>
            <h3>What you have sent</h3>
            <ul className="plain-list stack">
              {mine.data.feedback.map((f) => (
                <li key={f.id}>
                  <FeedbackItem
                    item={f}
                    onChanged={(u) => mine.setData((d) => ({ feedback: d.feedback.map((x) => (x.id === u.id ? u : x)) }))}
                    onDeleted={(id) => mine.setData((d) => ({ feedback: d.feedback.filter((x) => x.id !== id) }))}
                  />
                </li>
              ))}
            </ul>
          </>
        )
      )}
    </section>
  );
}

export default function Reader() {
  const { id } = useParams();
  const { user } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const { data, error, loading } = useAsync(() => api.get(`/chapters/${id}`), [id, refreshKey]);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [size, setSize] = usePref('reader.size', 'md');
  const [theme, setTheme] = usePref('reader.theme', 'paper');
  const [font, setFont] = usePref('reader.font', 'literata');
  const [layout, setLayout] = usePref('reader.layout', 'justified');
  const ch = data?.chapter;

  useEffect(() => {
    if (!ch) return;
    try {
      localStorage.setItem('reader.last', String(ch.id));
    } catch {
      /* ignore */
    }
    window.scrollTo?.(0, 0);
  }, [ch?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <Loading />;
  if (error) {
    const isLocked =
      error.status === 401 ||
      error.status === 403 ||
      error.code === 'chapter_locked' ||
      error.code === 'payment_required' ||
      String(error.message || '').toLowerCase().includes('private') ||
      String(error.message || '').toLowerCase().includes('locked');

    if (isLocked) {
      return (
        <div style={{ maxWidth: '540px', margin: '4rem auto', padding: '2.5rem 2rem', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.6rem' }}>🔒</div>
          <span className="chip chip-accent" style={{ marginBottom: '1rem', display: 'inline-block' }}>
            Digital Lifetime Pass · ₹30
          </span>
          <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: '0.6rem' }}>Chapter Locked</h2>
          <p className="muted" style={{ lineHeight: 1.6, marginBottom: '2rem' }}>
            Only the <strong>Trailer</strong> and <strong>Prologue</strong> are available as free preview reading.
            Unlock all chapters of <em>Is It Me or You as Well?</em> for just <strong>₹30</strong> to continue reading with lifetime access, 2-page book spread, and customized bookmarks.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowUnlockModal(true)}
              style={{ padding: '0.8rem 1.6rem', fontSize: '1rem' }}
            >
              Unlock Full Novel · ₹30
            </button>
            {!user ? (
              <Link to="/login" state={{ from: `/chapters/${id}` }} className="btn btn-outline" style={{ padding: '0.8rem 1.6rem' }}>
                Sign In to Account
              </Link>
            ) : (
              <Link to="/#pricing" className="btn btn-ghost" style={{ padding: '0.8rem 1.2rem' }}>
                Pricing Details
              </Link>
            )}
          </div>
          <div style={{ marginTop: '2rem' }}>
            <Link to="/#sample-preview" className="muted small">
              ← Back to Free Samples
            </Link>
          </div>
          <UnlockModal
            isOpen={showUnlockModal}
            onClose={() => setShowUnlockModal(false)}
            onSuccess={() => setRefreshKey((k) => k + 1)}
            user={user}
            chapterId={id}
          />
        </div>
      );
    }
    return (
      <>
        <LoadError error={error} />
        <p>
          <Link to={user ? '/chapters' : '/#sample-preview'}>{user ? 'Back to the chapter list' : 'Back to free samples'}</Link>
        </p>
      </>
    );
  }
  const idx = SIZES.indexOf(SIZES.includes(size) ? size : 'md');

  return (
    <div className={`reader theme-${theme} size-${SIZES[idx]} font-${font} layout-${layout}`}>
      <div className="reader-tools" role="group" aria-label="Reading settings">
        {user ? (
          <Link to="/chapters" className="btn btn-ghost btn-small">
            ← Chapters
          </Link>
        ) : (
          <Link to="/#sample-preview" className="btn btn-ghost btn-small">
            ← Free Samples
          </Link>
        )}
        <span className="spacer" />
        <button className="btn btn-ghost btn-small" onClick={() => setSize(SIZES[Math.max(0, idx - 1)])} disabled={idx === 0} aria-label="Smaller text">
          A−
        </button>
        <span className="muted small" style={{ minWidth: '2.4rem', textAlign: 'center', fontWeight: 600, userSelect: 'none' }} title="Current font size">
          {SIZES[idx].toUpperCase()}
        </span>
        <button className="btn btn-ghost btn-small" onClick={() => setSize(SIZES[Math.min(SIZES.length - 1, idx + 1)])} disabled={idx === SIZES.length - 1} aria-label="Larger text">
          A+
        </button>
        <select id="font-select" value={font} onChange={(e) => setFont(e.target.value)} aria-label="Reading font">
          <option value="literata">Literata (Kindle)</option>
          <option value="lora">Lora (Book)</option>
          <option value="garamond">Garamond</option>
          <option value="sans">Clean Sans</option>
        </select>
        <select id="layout-select" value={layout} onChange={(e) => setLayout(e.target.value)} aria-label="Text alignment">
          <option value="clean">Flush Left</option>
          <option value="justified">Justified</option>
        </select>
        <label className="sr-only" htmlFor="theme-select">
          Page colour
        </label>
        <select id="theme-select" value={theme} onChange={(e) => setTheme(e.target.value)} aria-label="Color theme">
          <option value="paper">Paper</option>
          <option value="sepia">Sepia</option>
          <option value="night">Night</option>
        </select>
      </div>

      {(() => {
        const eyebrow =
          ch.number != null && ch.number !== '' && Number(ch.number) > 0
            ? `Chapter ${ch.number}`
            : ch.number != null && ch.number !== '' && Number(ch.number) === 0 && !ch.title?.toLowerCase().includes('prologue')
              ? 'Prologue'
              : null;

        return (
          <PagedBookReader
            title={ch.title}
            bookTitle="Is It Me or You as Well?"
            eyebrow={eyebrow}
            content={ch.content}
            wordCount={ch.wordCount}
            version={ch.version}
            updatedAt={ch.updatedAt}
            changeNote={ch.changeNote}
            updatedSinceMyFeedback={ch.updatedSinceMyFeedback}
            pdf={ch.pdf}
            apiHref={ch.pdf ? api.href(`/chapters/${ch.id}/pdf`) : null}
            prevId={ch.prevId}
            nextId={ch.nextId}
          >
            {user ? <FeedbackSection chapterId={ch.id} version={ch.version} /> : null}
          </PagedBookReader>
        );
      })()}
    </div>
  );
}
