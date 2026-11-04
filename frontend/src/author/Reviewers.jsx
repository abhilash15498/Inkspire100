import { useState } from 'react';
import { api } from '../api.js';
import { Chip, Loading, LoadError, Notice, PageHeader, errMsg, fmtDate, fmtDateTime, useAsync } from '../ui.jsx';

export default function Reviewers() {
  const { data, error, loading, setData } = useAsync(() => api.get('/author/reviewers'), []);
  const [emails, setEmails] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState({ kind: '', text: '' });

  if (loading) return <Loading />;
  if (error) return <LoadError error={error} />;

  const add = async (e) => {
    e.preventDefault();
    setMsg({ kind: '', text: '' });
    try {
      const d = await api.post('/author/reviewers', { emails, note });
      setData({ reviewers: d.reviewers });
      setEmails('');
      setNote('');
      const extra = d.skippedAuthor.length ? ` (${d.skippedAuthor.join(', ')} is the author account and was skipped.)` : '';
      setMsg({ kind: 'success', text: `${d.added} reviewer${d.added === 1 ? '' : 's'} can now sign in.${extra}` });
    } catch (err) {
      setMsg({ kind: 'error', text: errMsg(err) });
    }
  };

  const update = async (r, patch) => {
    try {
      const d = await api.patch(`/author/reviewers/${r.id}`, patch);
      setData((cur) => ({ reviewers: cur.reviewers.map((x) => (x.id === r.id ? d.reviewer : x)) }));
    } catch (err) {
      setMsg({ kind: 'error', text: errMsg(err) });
    }
  };

  const remove = async (r) => {
    if (!window.confirm(`Remove ${r.email}? They will no longer be able to sign in. Feedback they already sent is kept.`)) return;
    try {
      await api.del(`/author/reviewers/${r.id}`);
      setData((cur) => ({ reviewers: cur.reviewers.filter((x) => x.id !== r.id) }));
    } catch (err) {
      setMsg({ kind: 'error', text: errMsg(err) });
    }
  };

  const list = data.reviewers;
  return (
    <>
      <PageHeader title="Reviewers" subtitle="Only people listed here can sign in. Use the exact email address of the Google account they will use." />
      <form onSubmit={add} className="stack panel">
        <div className="field">
          <label htmlFor="rv-emails">Email addresses to invite</label>
          <textarea id="rv-emails" rows={3} value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="one@gmail.com, two@gmail.com" required />
          <p className="hint muted small">Separate several addresses with commas, spaces or new lines. Nothing is emailed; tell them the site address yourself.</p>
        </div>
        <div className="field">
          <label htmlFor="rv-note">Note for yourself (optional)</label>
          <input id="rv-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="e.g. college friend" />
        </div>
        <Notice kind={msg.kind || 'info'}>{msg.text}</Notice>
        <div className="row">
          <button className="btn btn-primary">Give access</button>
        </div>
      </form>

      <h2>People with access ({list.filter((r) => !r.revoked).length})</h2>
      {list.length === 0 ? (
        <p className="empty">Nobody has been invited yet.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Reviewer</th>
                <th scope="col">Status</th>
                <th scope="col">Last sign-in</th>
                <th scope="col">Feedback</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="strong">{r.name || r.email}</div>
                    {r.name && <div className="muted small">{r.email}</div>}
                    {r.note && <div className="muted small">{r.note}</div>}
                    <div className="muted small">Invited {fmtDate(r.invitedAt)}</div>
                  </td>
                  <td>{r.revoked ? <Chip tone="warn">Access removed</Chip> : r.userId ? <Chip tone="good">Signed in</Chip> : <Chip>Not signed in yet</Chip>}</td>
                  <td>{r.lastLoginAt ? fmtDateTime(r.lastLoginAt) : '–'}</td>
                  <td>{r.feedbackCount}</td>
                  <td>
                    {r.revoked ? (
                      <button className="btn btn-small" onClick={() => update(r, { revoked: false })}>
                        Restore access
                      </button>
                    ) : (
                      <button className="btn btn-small" onClick={() => update(r, { revoked: true })}>
                        Remove access
                      </button>
                    )}
                    <button className="btn btn-ghost btn-small btn-danger-text" onClick={() => remove(r)}>
                      Delete
                    </button>
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
