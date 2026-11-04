import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import FeedbackItem, { CategorySelect } from '../components/FeedbackItem.jsx';
import { ChapterText } from '../markdown.jsx';
import { Chip, Loading, LoadError, Notice, errMsg, fmtDate, readingMinutes, useAsync, usePref } from '../ui.jsx';

const SIZES = ['sm', 'md', 'lg', 'xl'];

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
  const { data, error, loading } = useAsync(() => api.get(`/chapters/${id}`), [id]);
  const [size, setSize] = usePref('reader.size', 'md');
  const [theme, setTheme] = usePref('reader.theme', 'paper');
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
    return (
      <>
        <LoadError error={error} />
        <p>
          <Link to="/chapters">Back to the chapter list</Link>
        </p>
      </>
    );
  }
  const idx = SIZES.indexOf(SIZES.includes(size) ? size : 'md');

  return (
    <div className={`reader theme-${theme} size-${SIZES[idx]}`}>
      <div className="reader-tools" role="group" aria-label="Reading settings">
        <Link to="/chapters" className="btn btn-ghost btn-small">
          ← Chapters
        </Link>
        <span className="spacer" />
        <button className="btn btn-ghost btn-small" onClick={() => setSize(SIZES[Math.max(0, idx - 1)])} disabled={idx === 0} aria-label="Smaller text">
          A−
        </button>
        <button className="btn btn-ghost btn-small" onClick={() => setSize(SIZES[Math.min(SIZES.length - 1, idx + 1)])} disabled={idx === SIZES.length - 1} aria-label="Larger text">
          A+
        </button>
        <label className="sr-only" htmlFor="theme-select">
          Page colour
        </label>
        <select id="theme-select" value={theme} onChange={(e) => setTheme(e.target.value)}>
          <option value="paper">Paper</option>
          <option value="sepia">Sepia</option>
          <option value="night">Night</option>
        </select>
      </div>

      <article className="chapter">
        <header className="chapter-head">
          <p className="eyebrow">Chapter {ch.number}</p>
          <h1 className="display">{ch.title}</h1>
          <p className="muted small">
            {ch.wordCount.toLocaleString()} words · about {readingMinutes(ch.wordCount)} min · Version {ch.version}, updated {fmtDate(ch.updatedAt)}
          </p>
          {ch.version > 1 && ch.changeNote && (
            <p className="update-note">
              <Chip tone="accent">What changed</Chip> {ch.changeNote}
            </p>
          )}
          {ch.updatedSinceMyFeedback && <Notice kind="info">This chapter has been updated since you last sent feedback on it.</Notice>}
        </header>
        <ChapterText text={ch.content} />
        <p className="end-mark" aria-hidden="true">
          ❦
        </p>
        {ch.pdf && (
          <p className="small">
            <a href={api.href(`/chapters/${ch.id}/pdf`)} target="_blank" rel="noopener noreferrer">
              Open this chapter as a PDF
            </a>{' '}
            <span className="muted">({ch.pdf.name})</span>
          </p>
        )}
        <nav className="chapter-nav" aria-label="Chapter navigation">
          {ch.prevId ? (
            <Link className="btn" to={`/chapters/${ch.prevId}`}>
              ← Previous chapter
            </Link>
          ) : (
            <span />
          )}
          {ch.nextId ? (
            <Link className="btn btn-primary" to={`/chapters/${ch.nextId}`}>
              Next chapter →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </article>

      <FeedbackSection chapterId={ch.id} version={ch.version} />
    </div>
  );
}
