import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Loading, LoadError, Notice, PageHeader, errMsg, useAsync } from '../ui.jsx';

export default function BookEditor() {
  const { data, error, loading } = useAsync(() => api.get('/book'), []);
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState({ kind: '', text: '' });
  useEffect(() => {
    if (data) setForm(data);
  }, [data]);
  if (loading || !form) return error ? <LoadError error={error} /> : <Loading />;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setMsg({ kind: '', text: '' });
    try {
      await api.put('/author/book', form);
      setMsg({ kind: 'success', text: 'Saved.' });
    } catch (err) {
      setMsg({ kind: 'error', text: errMsg(err) });
    }
  };

  return (
    <div className="narrow">
      <PageHeader title="Book details" subtitle="Shown to reviewers on the home page and the About page." />
      <form onSubmit={save} className="stack">
        <div className="field">
          <label htmlFor="b-title">Title</label>
          <input id="b-title" required maxLength={200} value={form.title} onChange={set('title')} />
        </div>
        <div className="field">
          <label htmlFor="b-author">Author name</label>
          <input id="b-author" maxLength={200} value={form.authorName} onChange={set('authorName')} />
        </div>
        <div className="field">
          <label htmlFor="b-tag">Tagline</label>
          <input id="b-tag" maxLength={300} value={form.tagline} onChange={set('tagline')} />
        </div>
        <div className="field">
          <label htmlFor="b-syn">Synopsis</label>
          <textarea id="b-syn" rows={6} maxLength={5000} value={form.synopsis} onChange={set('synopsis')} />
        </div>
        <div className="field">
          <label htmlFor="b-note">Note to reviewers (what kind of feedback you want)</label>
          <textarea id="b-note" rows={5} maxLength={5000} value={form.reviewerNote} onChange={set('reviewerNote')} />
        </div>
        <Notice kind={msg.kind || 'info'}>{msg.text}</Notice>
        <div className="row">
          <button className="btn btn-primary">Save</button>
        </div>
      </form>
    </div>
  );
}
