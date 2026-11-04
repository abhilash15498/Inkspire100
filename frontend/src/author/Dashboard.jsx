import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Chip, Loading, LoadError, PageHeader, StatusChip, fmtDate, useAsync } from '../ui.jsx';

export default function Dashboard() {
  const { data, error, loading } = useAsync(() => api.get('/author/chapters'), []);
  if (loading) return <Loading />;
  if (error) return <LoadError error={error} />;
  const list = data.chapters;
  const count = (s) => list.filter((c) => c.status === s).length;
  const unread = list.reduce((n, c) => n + c.unreadFeedback, 0);

  return (
    <>
      <PageHeader title="Your chapters" subtitle="Your Word document stays the master copy. Publish here only what you want reviewers to read.">
        <Link className="btn btn-primary" to="/author/chapters/new">
          + New chapter
        </Link>
      </PageHeader>

      <ul className="stats plain-list">
        <li>
          <strong>{count('published')}</strong> published
        </li>
        <li>
          <strong>{count('draft') + count('unpublished')}</strong> draft or hidden
        </li>
        <li>
          <Link to="/author/feedback?unread=true">
            <strong>{unread}</strong> unread feedback
          </Link>
        </li>
      </ul>

      {list.length === 0 ? (
        <p className="empty">
          No chapters yet. <Link to="/author/chapters/new">Create your first chapter</Link> by uploading a Word file or pasting the text.
        </p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">No.</th>
                <th scope="col">Title</th>
                <th scope="col">Status</th>
                <th scope="col">Live version</th>
                <th scope="col">Last published</th>
                <th scope="col">Feedback</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id}>
                  <td>{c.number}</td>
                  <td>
                    <Link to={`/author/chapters/${c.id}`} className="strong">
                      {c.title}
                    </Link>
                    <div className="muted small">{c.wordCount.toLocaleString()} words</div>
                  </td>
                  <td>
                    <StatusChip status={c.status} />
                    {c.hasUnpublishedChanges && <Chip tone="warn">Unpublished edits</Chip>}
                  </td>
                  <td>{c.publishedVersion ? `v${c.publishedVersion}` : '–'}</td>
                  <td>{c.lastPublishedAt ? fmtDate(c.lastPublishedAt) : '–'}</td>
                  <td>
                    {c.feedbackCount}
                    {c.unreadFeedback > 0 && <Chip tone="accent">{c.unreadFeedback} new</Chip>}
                  </td>
                  <td>
                    <Link className="btn btn-small" to={`/author/chapters/${c.id}`}>
                      Edit
                    </Link>
                    {c.status === 'published' && (
                      <Link className="btn btn-ghost btn-small" to={`/chapters/${c.id}`}>
                        View
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
