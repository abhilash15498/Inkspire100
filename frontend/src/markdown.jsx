// A tiny, safe formatter for chapter text. It builds React elements (never raw HTML),
// so chapter text can't inject scripts into the page.
//
//   Every line is its own paragraph.      Blank lines are ignored.
//   *italic*   **bold**   ***bold italic***
//   # Heading   ## Smaller heading
//   > quoted lines
//   ***   (a line with only three asterisks)  -> scene break
//   \*    -> a literal asterisk

const INLINE_SOURCE = String.raw`\\([*\\])|\*\*\*(?=\S)(.+?)(?<=\S)\*\*\*|\*\*(?=\S)(.+?)(?<=\S)\*\*|\*(?=\S)(.+?)(?<=\S)\*`;

export function renderInline(str, prefix = 'i') {
  const re = new RegExp(INLINE_SOURCE, 'g'); // new object each call: this function calls itself
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
    else out.push(<em key={key}>{renderInline(m[4], `${key}-`)}</em>);
    last = m.index + m[0].length;
  }
  if (last < str.length) out.push(str.slice(last));
  return out;
}

const SCENE_BREAK = /^(?:\*\s*){3,}$|^[-_=~]{3,}$/;

export function parseBlocks(text) {
  const blocks = [];
  for (const raw of String(text || '').replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) blocks.push({ type: 'heading', level: heading[1].length + 1, text: heading[2] });
    else if (SCENE_BREAK.test(line)) blocks.push({ type: 'break' });
    else if (line.startsWith('>')) {
      const content = line.replace(/^>\s?/, '');
      const prev = blocks[blocks.length - 1];
      if (prev?.type === 'quote') prev.lines.push(content);
      else blocks.push({ type: 'quote', lines: [content] });
    } else blocks.push({ type: 'p', text: line });
  }
  return blocks;
}

export function ChapterText({ text }) {
  const blocks = parseBlocks(text);
  if (blocks.length === 0) return <p className="muted">There is no text yet.</p>;
  return (
    <div className="prose">
      {blocks.map((b, i) => {
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
        return <p key={i}>{renderInline(b.text, `b${i}-`)}</p>;
      })}
    </div>
  );
}

export const countWords = (s) => {
  const t = String(s || '').trim();
  return t ? t.split(/\s+/).length : 0;
};
