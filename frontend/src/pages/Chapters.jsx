import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Chip, Loading, LoadError, PageHeader, fmtDate, readingMinutes, useAsync } from '../ui.jsx';

export default function Chapters() {
  const { data, error, loading } = useAsync(() => api.get('/chapters'), []);
  if (loading) return <Loading />;
  if (error) return <LoadError error={error} />;
  const list = data.chapters;
  return (
    <>
      <PageHeader title="Chapters" subtitle="Only chapters the author has published are shown here." />
      {list.length === 0 ? (
        <p className="empty">No chapters have been published yet.</p>
      ) : (
        <ol className="chapter-list plain-list">
          {list.map((c) => (
            <li key={c.id}>
              <Link to={`/chapters/${c.id}`} className="chapter-row">
                <span className="num">{c.number != null ? c.number : '—'}</span>
                <span className="chapter-main">
                  <span className="card-title">{c.title}</span>
                  <span className="muted small">
                    {c.wordCount.toLocaleString()} words · about {readingMinutes(c.wordCount)} min · Version {c.version}, updated {fmtDate(c.updatedAt)}
                  </span>
                </span>
                <span className="chapter-chips">
                  {c.updatedSinceMyFeedback && <Chip tone="accent">Updated since your feedback</Chip>}
                  {c.myFeedbackCount > 0 && !c.updatedSinceMyFeedback && <Chip tone="good">Feedback sent</Chip>}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
