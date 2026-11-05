// A tiny, safe formatter for chapter text. It builds React elements (never raw HTML),
// so chapter text can't inject scripts into the page.
//
//   Every line is its own paragraph.      Blank lines are ignored.
//   *italic*   **bold**   ***bold italic***
//   # Heading   ## Smaller heading
//   > quoted lines
//   ***   (a line with only three asterisks)  -> scene break
//   \*    -> a literal asterisk
//   15TH or 15th -> renders 15 with superscript TH
//   -> centered text <- -> centers the line

const INLINE_SOURCE = String.raw`\\([*\\])|\*\*\*(?=\S)(.+?)(?<=\S)\*\*\*|\*\*(?=\S)(.+?)(?<=\S)\*\*|\*(?=\S)(.+?)(?<=\S)\*|\^([^\^]+)\^|(\b\d{1,2})(st|nd|rd|th|ST|ND|RD|TH)\b`;

export function renderInline(str, prefix = 'i') {
  const re = new RegExp(INLINE_SOURCE, 'g');
  const out = [];
  let last = 0;
  let n = 0;
  let m;
  while ((m = re.exec(str)) !== null) {
    if (m.index > last) out.push(str.slice(last, m.index));
    const key = `${prefix}${n++}`;
    if (m[1] !== undefined) out.push(m[1]);
    else if (m[2] !== undefined) out.push(<strong key={key}><em>{renderInline(m[2], `${key}-`)}</em></strong>);
    else if (m[3] !== undefined) out.push(<strong key={key}>{renderInline(m[3], `${key}-`)}</strong>);
    else if (m[4] !== undefined) out.push(<em key={key}>{renderInline(m[4], `${key}-`)}</em>);
    else if (m[5] !== undefined) out.push(<sup key={key}>{m[5]}</sup>);
    else if (m[6] !== undefined && m[7] !== undefined) out.push(<span key={key}>{m[6]}<sup>{m[7]}</sup></span>);
    last = m.index + m[0].length;
  }
  if (last < str.length) out.push(str.slice(last));
  return out;
}

const PAGE_BREAK = /^[-_=~*]{0,3}page[-_=~*]{0,3}$/i;
const SCENE_BREAK = /^(?:\*\s*){3,}$|^[-_=~]{3,}$/;
const DATE_RE = /^\d{1,2}(?:st|nd|rd|th|ST|ND|RD|TH)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\b/i;

export function parseBlocks(text) {
  const blocks = [];
  for (const raw of String(text || '').replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (PAGE_BREAK.test(line)) {
      blocks.push({ type: 'pagebreak' });
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length + 1, text: heading[2] });
      continue;
    }
    if (SCENE_BREAK.test(line)) {
      blocks.push({ type: 'break' });
      continue;
    }
    if (/^->\s*(.+?)\s*<-$/.test(line)) {
      blocks.push({ type: 'centered', text: line.replace(/^->\s*|\s*<-$/g, '') });
      continue;
    }
    if (/^<center>\s*(.+?)\s*<\/center>$/i.test(line)) {
      blocks.push({ type: 'centered', text: line.replace(/^<center>\s*|\s*<\/center>$/gi, '') });
      continue;
    }
    // Standalone number or Roman numeral (e.g. 1, 2, I, II)
    if (/^(?:[0-9]{1,3}|[IVXLCDM]{1,8})$/i.test(line)) {
      blocks.push({ type: 'section-number', text: line });
      continue;
    }
    // Date/location scene stamp (e.g. 15TH January 2007 , Hospete)
    if (DATE_RE.test(line)) {
      blocks.push({ type: 'scene-date', text: line });
      continue;
    }
    if (line.startsWith('>')) {
      const content = line.replace(/^>\s?/, '');
      const prev = blocks[blocks.length - 1];
      if (prev?.type === 'quote') prev.lines.push(content);
      else blocks.push({ type: 'quote', lines: [content] });
    } else {
      blocks.push({ type: 'p', text: line });
    }
  }
  return blocks;
}

export function renderBlock(b, i) {
  if (b.type === 'pagebreak') {
    return <div key={i} className="book-page-break" role="separator" aria-label="Page break" />;
  }
  if (b.type === 'section-number') {
    return <div key={i} className="book-section-number">{b.text}</div>;
  }
  if (b.type === 'scene-date') {
    return <div key={i} className="book-scene-date">{renderInline(b.text, `d${i}-`)}</div>;
  }
  if (b.type === 'centered') {
    return <div key={i} className="book-centered-line">{renderInline(b.text, `c${i}-`)}</div>;
  }
  if (b.type === 'heading') {
    const Tag = `h${Math.min(b.level, 4)}`;
    return <Tag key={i}>{renderInline(b.text, `b${i}-`)}</Tag>;
  }
  if (b.type === 'break') return <hr key={i} className="scene-break" aria-label="Scene break" />;
  if (b.type === 'quote') {
    return (
      <blockquote key={i}>
        {b.lines.map((l, j) => (
          <p key={j}>{renderInline(l, `b${i}-${j}-`)}</p>
        ))}
      </blockquote>
    );
  }
  return (
    <p key={i} className={b.continued ? 'paragraph-continuation' : ''}>
      {renderInline(b.text, `b${i}-`)}
    </p>
  );
}

export function ChapterText({ text }) {
  const blocks = parseBlocks(text);
  if (blocks.length === 0) return <p className="muted">There is no text yet.</p>;
  return (
    <div className="prose">
      {blocks.map((b, i) => renderBlock(b, i))}
    </div>
  );
}

export const countWords = (s) => {
  const t = String(s || '').trim();
  return t ? t.split(/\s+/).length : 0;
};

export const estimatePages = (s) => {
  const words = countWords(s);
  const pageBreaks = (String(s || '').match(/^[-_=~*]{0,3}page[-_=~*]{0,3}$/gim) || []).length;
  // A standard paperback page holds ~250-280 words
  return Math.max(1, Math.max(pageBreaks + 1, Math.ceil(words / 260)));
};
