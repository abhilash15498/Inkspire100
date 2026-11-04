import { Link } from 'react-router-dom';
import { api } from '../api.js';
import FeedbackItem from '../components/FeedbackItem.jsx';
import { Loading, LoadError, PageHeader, useAsync } from '../ui.jsx';

export default function MyFeedback() {
  const { data, error, loading, setData } = useAsync(() => api.get('/me/feedback'), []);
  if (loading) return <Loading />;
  if (error) return <LoadError error={error} />;
  const list = data.feedback;
  return (
    <>
      <PageHeader title="My feedback" subtitle="Everything you have sent. Only you and the author can see it." />
      {list.length === 0 ? (
        <p className="empty">
          You have not sent any feedback yet. <Link to="/chapters">Open a chapter</Link> to get started.
        </p>
      ) : (
        <ul className="plain-list stack">
          {list.map((f) => (
            <li key={f.id}>
              <FeedbackItem
                item={f}
                showChapter
                onChanged={(u) => setData((d) => ({ feedback: d.feedback.map((x) => (x.id === u.id ? u : x)) }))}
                onDeleted={(id) => setData((d) => ({ feedback: d.feedback.filter((x) => x.id !== id) }))}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
