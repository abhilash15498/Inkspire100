import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Chip, Loading, LoadError, fmtDate, useAsync } from '../ui.jsx';

export default function Home() {
  const { user, isAuthor } = useAuth();
  const book = useAsync(() => api.get('/book'), []);
  const chapters = useAsync(() => api.get('/chapters'), []);
  if (book.loading || chapters.loading) return <Loading />;
  if (book.error || chapters.error) return <LoadError error={book.error || chapters.error} />;

  const list = chapters.data.chapters;
  let lastRead = null;
  try {
    lastRead = Number(localStorage.getItem('reader.last'));
  } catch {
    /* ignore */
  }
  const resume = list.find((c) => c.id === lastRead);
  const recent = [...list].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 5);
  const b = book.data;

  return (
    <>
      <section className="hero">
        <p className="eyebrow">Welcome{user?.name ? `, ${user.name.split(' ')[0]}` : ''}</p>
        <h1 className="display">{b.title}</h1>
        {b.authorName && <p className="byline">by {b.authorName}</p>}
        {b.tagline && <p className="tagline">{b.tagline}</p>}
        <div className="hero-actions">
          {resume ? (
            <Link className="btn btn-primary" to={`/chapters/${resume.id}`}>
              Continue: Chapter {resume.number}
            </Link>
          ) : list[0] ? (
            <Link className="btn btn-primary" to={`/chapters/${list[0].id}`}>
              Start reading
            </Link>
          ) : null}
          <Link className="btn" to="/chapters">
            All chapters
          </Link>
          {isAuthor && (
            <Link className="btn btn-ghost" to="/author">
              Author dashboard
            </Link>
          )}
        </div>
      </section>

      {list.length === 0 ? (
        <p className="empty">No chapters have been published yet. Please check back soon.</p>
      ) : (
        <section aria-labelledby="recent">
          <h2 id="recent">Recently updated</h2>
          <ul className="plain-list cards">
            {recent.map((c) => (
              <li key={c.id}>
                <Link to={`/chapters/${c.id}`} className="card-link">
                  <span className="num">Chapter {c.number}</span>
                  <span className="card-title">{c.title}</span>
                  <span className="muted small">
                    Version {c.version} · {fmtDate(c.updatedAt)}
                    {c.changeNote ? ` · ${c.changeNote}` : ''}
                  </span>
                  {c.updatedSinceMyFeedback && <Chip tone="accent">Changed since your feedback</Chip>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {b.reviewerNote && (
        <section className="note-box">
          <h2>A note from the author</h2>
          <p className="pre-wrap">{b.reviewerNote}</p>
        </section>
      )}
    </>
  );
}
