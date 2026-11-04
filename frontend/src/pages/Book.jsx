import { api } from '../api.js';
import { Loading, LoadError, PageHeader, useAsync } from '../ui.jsx';

export default function Book() {
  const { data, error, loading } = useAsync(() => api.get('/book'), []);
  if (loading) return <Loading />;
  if (error) return <LoadError error={error} />;
  return (
    <article className="narrow">
      <PageHeader title={data.title} subtitle={data.authorName ? `by ${data.authorName}` : ''} />
      {data.tagline && <p className="tagline">{data.tagline}</p>}
      <h2>About this book</h2>
      {data.synopsis ? <p className="pre-wrap">{data.synopsis}</p> : <p className="muted">The author has not added a description yet.</p>}
      <h2>How to review</h2>
      <ol>
        <li>Open a chapter from the chapter list and read it at your own pace.</li>
        <li>At the bottom of each chapter, leave your thoughts. Choose a category if it helps.</li>
        <li>Chapters can be corrected after you read them. A chapter with a newer version is marked, and you can add more feedback.</li>
      </ol>
      <p className="muted">Your feedback is visible only to you and the author.</p>
      {data.reviewerNote && (
        <section className="note-box">
          <h2>A note from the author</h2>
          <p className="pre-wrap">{data.reviewerNote}</p>
        </section>
      )}
    </article>
  );
}
