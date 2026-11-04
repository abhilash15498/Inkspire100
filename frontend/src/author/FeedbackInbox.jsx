import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { CATEGORY_LABELS, Chip, Loading, LoadError, Notice, PageHeader, errMsg, fmtDateTime, useAsync } from '../ui.jsx';

export default function FeedbackInbox() {
  const [params, setParams] = useSearchParams();
  const chapterId = params.get('chapterId') || '';
  const reviewerId = params.get('reviewerId') || '';
  const unread = params.get('unread') === 'true';
  const order = params.get('order') === 'newest' ? 'newest' : 'oldest';
  const [msg, setMsg] = useState('');

  const chapters = useAsync(() => api.get('/author/chapters'), []);
  const reviewers = useAsync(() => api.get('/author/reviewers'), []);
  const qs = new URLSearchParams();
  if (chapterId) qs.set('chapterId', chapterId);
  if (reviewerId) qs.set('reviewerId', reviewerId);
  if (unread) qs.set('unread', 'true');
  qs.set('order', order);
  const inbox = useAsync(() => api.get(`/author/feedback?${qs.toString()}`), [chapterId, reviewerId, unread, order]);

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const toggle = async (f) => {
    try {
      await api.patch(`/author/feedback/${f.id}`, { isRead: !f.isRead });
      inbox.setData((d) => ({ feedback: d.feedback.map((x) => (x.id === f.id ? { ...x, isRead: !f.isRead } : x)) }));
    } catch (err) {
      setMsg(errMsg(err));
    }
  };

  const markAll = async () => {
    try {
      await api.post('/author/feedback/mark-read', { chapterId: chapterId ? Number(chapterId) : undefined });
      inbox.reload();
    } catch (err) {
      setMsg(errMsg(err));
    }
  };

  const people = new Map();
  for (const r of reviewers.data?.reviewers || []) if (r.userId) people.set(r.userId, r.name || r.email);

  return (
    <>
      <PageHeader title="Feedback inbox" subtitle="Everything your reviewers have sent.">
        <button className="btn btn-small" onClick={markAll}>
          Mark all as read
        </button>
      </PageHeader>

      <form className="filters" onSubmit={(e) => e.preventDefault()}>
        <div className="field">
          <label htmlFor="f-chapter">Chapter</label>
          <select id="f-chapter" value={chapterId} onChange={(e) => setFilter('chapterId', e.target.value)}>
            <option value="">All chapters</option>
            {(chapters.data?.chapters || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.number}. {c.title}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-reviewer">Reviewer</label>
          <select id="f-reviewer" value={reviewerId} onChange={(e) => setFilter('reviewerId', e.target.value)}>
            <option value="">Everyone</option>
            {[...people.entries()].map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-order">Order</label>
          <select id="f-order" value={order} onChange={(e) => setFilter('order', e.target.value === 'newest' ? 'newest' : '')}>
            <option value="oldest">Oldest first</option>
            <option value="newest">Newest first</option>
          </select>
        </div>
        <label className="check">
          <input type="checkbox" checked={unread} onChange={(e) => setFilter('unread', e.target.checked ? 'true' : '')} /> Unread only
        </label>
      </form>

      <Notice kind="error">{msg}</Notice>
      {inbox.loading ? (
        <Loading />
      ) : inbox.error ? (
        <LoadError error={inbox.error} />
      ) : inbox.data.feedback.length === 0 ? (
        <p className="empty">No feedback matches these filters.</p>
      ) : (
        <ul className="plain-list stack">
          {inbox.data.feedback.map((f) => (
            <li key={f.id}>
              <article className={`feedback-item ${f.isRead ? '' : 'unread'}`}>
                <div className="feedback-meta">
                  <span className="strong">
                    Chapter {f.chapterNumber}: {f.chapterTitle}
                  </span>
                  <Chip>{CATEGORY_LABELS[f.category]}</Chip>
                  {!f.isRead && <Chip tone="accent">New</Chip>}
                </div>
                <p className="muted small">
                  {f.reviewer.name || f.reviewer.email}
                  {f.reviewer.name ? ` (${f.reviewer.email})` : ''} · {fmtDateTime(f.createdAt)}
                  {f.edited ? ' (edited)' : ''} · on version {f.version}
                  {f.chapterUpdatedSince ? ' · chapter updated since' : ''}
                </p>
                <p className="pre-wrap">{f.comment}</p>
                <div className="row">
                  <button className="btn btn-ghost btn-small" onClick={() => toggle(f)}>
                    {f.isRead ? 'Mark as unread' : 'Mark as read'}
                  </button>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
