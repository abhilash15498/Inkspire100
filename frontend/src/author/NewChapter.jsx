import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { Notice, PageHeader, errMsg } from '../ui.jsx';

export default function NewChapter() {
  const navigate = useNavigate();
  const [number, setNumber] = useState('');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [keepFile, setKeepFile] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get('/author/chapters')
      .then((d) => {
        const nums = (d.chapters || []).map((c) => c.number).filter((n) => n != null && !isNaN(n));
        setNumber((cur) => cur || (nums.length > 0 ? String(Math.max(...nums) + 1) : '1'));
      })
      .catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const numVal = number.trim() === '' ? null : Number(number);
      const created = await api.post('/author/chapters', { number: numVal, title });
      const id = created.chapter.id;
      if (file) {
        const form = new FormData();
        form.append('file', file);
        form.append('keepFile', String(keepFile));
        try {
          await api.upload(`/author/chapters/${id}/import`, form);
        } catch (err) {
          // The chapter exists; let the author fix the file problem on the editor page.
          navigate(`/author/chapters/${id}`, { state: { notice: `The chapter was created, but the file could not be imported: ${errMsg(err)}` } });
          return;
        }
      }
      navigate(`/author/chapters/${id}`);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="narrow">
      <PageHeader title="New chapter" subtitle="It starts as a draft. Reviewers see nothing until you publish." />
      <form onSubmit={submit} className="stack">
        <div className="field">
          <label htmlFor="nc-number">
            Chapter number <span className="muted small">(optional)</span>
          </label>
          <input
            id="nc-number"
            type="number"
            min="0"
            max="9999"
            step="1"
            placeholder="e.g. 1 (leave blank for Prologue / Epilogue)"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
          />
          <p className="hint muted small">Leave empty for unnumbered sections like a Prologue or Epilogue.</p>
        </div>
        <div className="field">
          <label htmlFor="nc-title">Chapter title</label>
          <input id="nc-title" type="text" required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="nc-file">Start from a file (optional)</label>
          <input id="nc-file" type="file" accept=".docx,.pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <p className="hint muted small">A Word (.docx) or PDF file for just this chapter. You can also paste text on the next page.</p>
        </div>
        {file && (
          <label className="check">
            <input type="checkbox" checked={keepFile} onChange={(e) => setKeepFile(e.target.checked)} /> Keep a copy of the uploaded file
          </label>
        )}
        <Notice kind="error">{error}</Notice>
        <div className="row">
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Creating…' : 'Create chapter'}
          </button>
        </div>
      </form>
    </div>
  );
}
