import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { ChapterText, countWords } from '../markdown.jsx';
import { Chip, Loading, LoadError, Notice, StatusChip, errMsg, fmtDate, fmtDateTime } from '../ui.jsx';

const toForm = (c) => ({ number: String(c.number), title: c.title, content: c.content });

export default function ChapterEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const path = `/author/chapters/${id}`;

  const [chapter, setChapter] = useState(null); // what the server has
  const [form, setForm] = useState(null); // what is in the editor
  const [loadError, setLoadError] = useState(null);
  const [tab, setTab] = useState('write');
  const [preview, setPreview] = useState(false);
  const [msg, setMsg] = useState({ kind: '', text: '' });
  const [busy, setBusy] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [note, setNote] = useState('');

  const [history, setHistory] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [file, setFile] = useState(null);
  const [keepFile, setKeepFile] = useState(true);
  const [warnings, setWarnings] = useState([]);

  const applyServer = useCallback((c) => {
    setChapter(c);
    setForm(toForm(c));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setChapter(null);
    setLoadError(null);
    api
      .get(path)
      .then((d) => {
        if (cancelled) return;
        applyServer(d.chapter);
        if (location.state?.notice) setMsg({ kind: 'error', text: location.state.notice });
      })
      .catch((e) => !cancelled && setLoadError(e));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, applyServer]);

  const dirty = useMemo(() => !!chapter && !!form && (form.number !== String(chapter.number) || form.title !== chapter.title || form.content !== chapter.content), [chapter, form]);

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  if (loadError) return <LoadError error={loadError} />;
  if (!chapter || !form) return <Loading />;

  const say = (kind, text) => setMsg({ kind, text });
  const run = async (fn) => {
    setBusy(true);
    setMsg({ kind: '', text: '' });
    try {
      await fn();
    } catch (e) {
      say('error', errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const saveDraft = async () => {
    const d = await api.put(path, { number: Number(form.number), title: form.title, content: form.content });
    applyServer(d.chapter);
    return d.chapter;
  };

  const onSave = () =>
    run(async () => {
      await saveDraft();
      say('success', 'Draft saved. Reviewers still see the published version.');
    });

  const onPublish = () =>
    run(async () => {
      if (dirty) await saveDraft();
      const d = await api.post(`${path}/publish`, { changeNote: note });
      applyServer(d.chapter);
      setNote('');
      setPublishing(false);
      say('success', `Published as version ${d.chapter.publishedVersion}. Reviewers can read it now.`);
      setHistory(null);
    });

  const onUnpublish = () =>
    run(async () => {
      if (!window.confirm('Hide this chapter from reviewers? Nothing is deleted, and you can publish it again.')) return;
      const d = await api.post(`${path}/unpublish`);
      applyServer({ ...d.chapter, ...(dirty ? { number: Number(form.number), title: form.title, content: form.content } : {}) });
      if (dirty) setForm(form);
      say('success', 'The chapter is hidden from reviewers.');
    });

  const onDelete = () =>
    run(async () => {
      if (!window.confirm(`Delete Chapter ${chapter.number} permanently, including its version history, uploaded files and all reviewer feedback on it? This cannot be undone.`)) return;
      await api.del(path);
      navigate('/author');
    });

  // ----- history -----
  const loadHistory = () =>
    run(async () => {
      const d = await api.get(`${path}/versions`);
      setHistory(d.versions);
    });
  const openTab = (t) => {
    setTab(t);
    if (t === 'history' && history === null) loadHistory();
  };
  const viewVersion = (n) =>
    run(async () => {
      const d = await api.get(`${path}/versions/${n}`);
      setViewing(d.version);
    });
  const restore = (n, publish) =>
    run(async () => {
      const q = publish
        ? `Restore version ${n} and publish it right away as a new version? Reviewers will see it immediately.`
        : `Load version ${n} into your draft? Anything unsaved in the editor will be replaced. Reviewers are not affected until you publish.`;
      if (!window.confirm(q)) return;
      const d = await api.post(`${path}/versions/${n}/restore`, { publish });
      applyServer(d.chapter);
      setViewing(null);
      setHistory(null);
      await loadHistory();
      setTab(publish ? 'history' : 'write');
      say('success', publish ? `Version ${n} was restored and published as version ${d.chapter.publishedVersion}.` : `Version ${n} is now in your draft. Review it, then publish when ready.`);
    });

  // ----- upload -----
  const doImport = (e) => {
    e.preventDefault();
    if (!file) return;
    return run(async () => {
      const hasText = form.content.trim().length > 0;
      if (hasText && !window.confirm('This replaces the text in your draft with the text from the file. (Anything unsaved in the editor is lost. The published version is not touched.) Continue?')) return;
      const data = new FormData();
      data.append('file', file);
      data.append('keepFile', String(keepFile));
      const d = await api.upload(`${path}/import`, data);
      applyServer(d.chapter);
      setWarnings(d.warnings || []);
      setFile(null);
      e.target.reset?.();
      setTab('write');
      say('success', 'Text imported into your draft. Read it through, then save or publish.');
    });
  };
  const toggleShare = (f) =>
    run(async () => {
      await api.patch(`/author/files/${f.id}`, { sharedWithReviewers: !f.sharedWithReviewers });
      const d = await api.get(path);
      setChapter(d.chapter);
    });
  const deleteFile = (f) =>
    run(async () => {
      if (!window.confirm(`Delete the stored copy of "${f.name}"? The chapter text is not affected.`)) return;
      await api.del(`/author/files/${f.id}`);
      const d = await api.get(path);
      setChapter(d.chapter);
    });

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const live = chapter.status === 'published';
  const nextVersion = (chapter.publishedVersion || 0) + 1;

  return (
    <>
      <div className="editor-head">
        <div>
          <p className="eyebrow">
            <Link to="/author">← All chapters</Link>
          </p>
          <h1>
            Chapter {chapter.number}: {chapter.title}
          </h1>
          <p className="muted small">
            <StatusChip status={chapter.status} />{' '}
            {chapter.publishedVersion ? (
              <>
                {live ? 'Reviewers see' : 'Last published:'} version {chapter.publishedVersion} ({fmtDate(chapter.lastPublishedAt)}).{' '}
              </>
            ) : (
              'Never published. '
            )}
            {chapter.hasUnpublishedChanges && <Chip tone="warn">Draft differs from published</Chip>}
            {dirty && <Chip tone="accent">Unsaved changes</Chip>}
          </p>
        </div>
        <div className="row">
          {live && (
            <Link className="btn btn-ghost btn-small" to={`/chapters/${chapter.id}`}>
              View as reader
            </Link>
          )}
        </div>
      </div>

      <div className="tabs" role="tablist" aria-label="Chapter sections">
        {[
          ['write', 'Write & publish'],
          ['upload', 'Upload a file'],
          ['history', 'Version history'],
        ].map(([key, label]) => (
          <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'tab active' : 'tab'} onClick={() => openTab(key)}>
            {label}
          </button>
        ))}
      </div>

      <Notice kind={msg.kind || 'info'}>{msg.text}</Notice>
      {warnings.length > 0 && tab === 'write' && (
        <Notice kind="warn">
          <strong>Please check the imported text:</strong>
          <ul>
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Notice>
      )}

      {tab === 'write' && (
        <section aria-label="Write and publish">
          <div className="grid-2">
            <div className="field">
              <label htmlFor="ed-number">Chapter number</label>
              <input id="ed-number" type="number" min="0" max="9999" value={form.number} onChange={set('number')} />
            </div>
            <div className="field">
              <label htmlFor="ed-title">Title</label>
              <input id="ed-title" maxLength={200} value={form.title} onChange={set('title')} />
            </div>
          </div>

          <div className="editor-bar">
            <div className="segmented" role="group" aria-label="Editor view">
              <button className={!preview ? 'active' : ''} aria-pressed={!preview} onClick={() => setPreview(false)}>
                Write
              </button>
              <button className={preview ? 'active' : ''} aria-pressed={preview} onClick={() => setPreview(true)}>
                Preview
              </button>
            </div>
            <span className="muted small">{countWords(form.content).toLocaleString()} words</span>
          </div>

          {preview ? (
            <div className="preview-pane">
              <h2 className="display">{form.title}</h2>
              <ChapterText text={form.content} />
            </div>
          ) : (
            <div className="field">
              <label htmlFor="ed-content" className="sr-only">
                Chapter text
              </label>
              <textarea id="ed-content" className="editor" rows={22} value={form.content} onChange={set('content')} spellCheck placeholder="Paste your chapter here, or upload a Word file from the “Upload a file” tab. Press Enter to start a new paragraph." />
            </div>
          )}

          <details className="help">
            <summary>Formatting help</summary>
            <ul>
              <li>Press <kbd>Enter</kbd> to start a new paragraph. Blank lines are ignored.</li>
              <li><code>*italic*</code> gives <em>italic</em>, and <code>**bold**</code> gives <strong>bold</strong>.</li>
              <li>A line with only <code>***</code> makes a scene break (a small ornament).</li>
              <li><code># Heading</code> makes a heading, and <code>&gt; text</code> makes an indented quote.</li>
              <li>To show a real asterisk, type <code>\*</code>.</li>
            </ul>
          </details>

          <div className="action-bar">
            <button className="btn" onClick={onSave} disabled={busy || !dirty}>
              Save draft
            </button>
            {!publishing && (
              <button className="btn btn-primary" onClick={() => setPublishing(true)} disabled={busy || (!dirty && live && !chapter.hasUnpublishedChanges)}>
                {live ? 'Publish changes…' : 'Publish…'}
              </button>
            )}
            {live && (
              <button className="btn btn-ghost" onClick={onUnpublish} disabled={busy}>
                Unpublish
              </button>
            )}
          </div>

          {publishing && (
            <div className="panel stack" role="group" aria-label="Publish">
              <p>
                {live
                  ? `This will create version ${nextVersion}. Reviewers see it immediately. Version ${chapter.publishedVersion} is kept in the history.`
                  : chapter.publishedVersion && !dirty && !chapter.hasUnpublishedChanges
                    ? `This switches the chapter back on (version ${chapter.publishedVersion}).`
                    : `This publishes the chapter as version ${nextVersion}. Reviewers see it immediately.`}
              </p>
              <div className="field">
                <label htmlFor="ed-note">What changed? (optional, shown to reviewers)</label>
                <input id="ed-note" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Fixed two typos in the opening scene" />
              </div>
              <div className="row">
                <button className="btn btn-primary" onClick={onPublish} disabled={busy}>
                  {busy ? 'Publishing…' : 'Confirm and publish'}
                </button>
                <button className="btn btn-ghost" onClick={() => setPublishing(false)} disabled={busy}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          <details className="danger-zone">
            <summary>Delete this chapter</summary>
            <p className="muted">This permanently removes the chapter, every saved version, its uploaded files and all feedback on it. To simply hide it from reviewers, use Unpublish instead.</p>
            <button className="btn btn-danger" onClick={onDelete} disabled={busy}>
              Delete chapter permanently
            </button>
          </details>
        </section>
      )}

      {tab === 'upload' && (
        <section aria-label="Upload a file" className="stack">
          <p>
            Upload this chapter as a Word (<code>.docx</code>) or PDF file. Its text replaces your <strong>draft</strong>; what reviewers see does not change until you publish. Word files give the best result.
          </p>
          <form onSubmit={doImport} className="panel stack">
            <div className="field">
              <label htmlFor="up-file">File (.docx or .pdf, up to 10 MB)</label>
              <input id="up-file" type="file" accept=".docx,.pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} required />
            </div>
            <label className="check">
              <input type="checkbox" checked={keepFile} onChange={(e) => setKeepFile(e.target.checked)} /> Keep a private copy of the uploaded file
            </label>
            <div className="row">
              <button className="btn btn-primary" disabled={busy || !file}>
                {busy ? 'Importing…' : 'Import text into draft'}
              </button>
            </div>
          </form>

          <h2>Kept files</h2>
          {chapter.files.length === 0 ? (
            <p className="muted">No files are stored for this chapter.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">File</th>
                    <th scope="col">Uploaded</th>
                    <th scope="col">Reviewers</th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {chapter.files.map((f) => (
                    <tr key={f.id}>
                      <td>
                        <span className="strong">{f.name}</span>
                        <div className="muted small">{(f.sizeBytes / 1024).toFixed(0)} KB</div>
                      </td>
                      <td>{fmtDateTime(f.uploadedAt)}</td>
                      <td>
                        {f.type === 'pdf' ? (
                          <label className="check">
                            <input type="checkbox" checked={f.sharedWithReviewers} onChange={() => toggleShare(f)} disabled={busy} /> Offer as a PDF link
                          </label>
                        ) : (
                          <span className="muted small">Author only</span>
                        )}
                      </td>
                      <td>
                        <a className="btn btn-small" href={api.href(`/author/files/${f.id}/download`)}>
                          Download
                        </a>
                        <button className="btn btn-ghost btn-small btn-danger-text" onClick={() => deleteFile(f)} disabled={busy}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === 'history' && (
        <section aria-label="Version history" className="stack">
          <p>Every time you publish, the text is saved as a permanent version. Old versions can never be changed or lost.</p>
          {history === null ? (
            <Loading />
          ) : history.length === 0 ? (
            <p className="muted">Nothing has been published yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Version</th>
                    <th scope="col">Published</th>
                    <th scope="col">Note</th>
                    <th scope="col">Words</th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((v) => (
                    <tr key={v.version}>
                      <td>
                        v{v.version} {v.isLive && <Chip tone="good">Live</Chip>}
                      </td>
                      <td>{fmtDateTime(v.createdAt)}</td>
                      <td>{v.changeNote || <span className="muted">–</span>}</td>
                      <td>{v.wordCount.toLocaleString()}</td>
                      <td>
                        <button className="btn btn-small" onClick={() => viewVersion(v.version)} disabled={busy}>
                          View
                        </button>
                        <button className="btn btn-ghost btn-small" onClick={() => restore(v.version, false)} disabled={busy}>
                          Load into draft
                        </button>
                        {!v.isLive && (
                          <button className="btn btn-ghost btn-small" onClick={() => restore(v.version, true)} disabled={busy}>
                            Restore &amp; publish
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {viewing && (
            <div className="panel">
              <div className="row between">
                <h2>
                  Version {viewing.version}: {viewing.title}
                </h2>
                <button className="btn btn-ghost btn-small" onClick={() => setViewing(null)}>
                  Close
                </button>
              </div>
              <p className="muted small">Published {fmtDateTime(viewing.createdAt)}</p>
              <ChapterText text={viewing.content} />
            </div>
          )}
        </section>
      )}
    </>
  );
}
