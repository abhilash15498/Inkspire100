import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { CATEGORY_LABELS, Chip, Notice, errMsg, fmtDateTime } from '../ui.jsx';

export function CategorySelect({ value, onChange, id }) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
        <option key={k} value={k}>
          {label}
        </option>
      ))}
    </select>
  );
}

/** One piece of the signed-in person's own feedback, which they can edit or delete. */
export default function FeedbackItem({ item, showChapter = false, onChanged, onDeleted }) {
  const [editing, setEditing] = useState(false);
  const [comment, setComment] = useState(item.comment);
  const [category, setCategory] = useState(item.category);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const d = await api.put(`/feedback/${item.id}`, { comment, category });
      onChanged(d.feedback);
      setEditing(false);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm('Delete this feedback? This cannot be undone.')) return;
    try {
      await api.del(`/feedback/${item.id}`);
      onDeleted(item.id);
    } catch (err) {
      setError(errMsg(err));
    }
  };

  return (
    <article className="feedback-item">
      <div className="feedback-meta">
        {showChapter && (
          <Link to={`/chapters/${item.chapterId}`} className="strong">
            Chapter {item.chapterNumber}: {item.chapterTitle}
          </Link>
        )}
        <Chip>{CATEGORY_LABELS[item.category]}</Chip>
        <span className="muted small">
          {fmtDateTime(item.createdAt)}
          {item.edited ? ' (edited)' : ''} · on version {item.version}
        </span>
        {item.chapterUpdatedSince && <Chip tone="accent">Chapter updated to version {item.currentVersion}</Chip>}
      </div>
      {editing ? (
        <form onSubmit={save} className="stack">
          <label htmlFor={`fb-c-${item.id}`} className="sr-only">
            Your feedback
          </label>
          <textarea id={`fb-c-${item.id}`} value={comment} onChange={(e) => setComment(e.target.value)} rows={5} maxLength={5000} required />
          <div className="row">
            <label htmlFor={`fb-k-${item.id}`}>Category</label>
            <CategorySelect id={`fb-k-${item.id}`} value={category} onChange={setCategory} />
          </div>
          <div className="row">
            <button className="btn btn-primary" disabled={busy || !comment.trim()}>
              Save changes
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className="pre-wrap">{item.comment}</p>
          <div className="row">
            <button className="btn btn-ghost btn-small" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button className="btn btn-ghost btn-small btn-danger-text" onClick={remove}>
              Delete
            </button>
          </div>
        </>
      )}
      <Notice kind="error">{error}</Notice>
    </article>
  );
}
