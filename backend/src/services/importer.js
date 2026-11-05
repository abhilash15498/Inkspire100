import mammoth from 'mammoth';
import pdfParse from 'pdf-parse/lib/pdf-parse.js'; // import the file directly: the package index runs debug code
import { HttpError } from '../http.js';

const MAX_CONTENT = 1_000_000;

/** Decides what kind of file this is from its name AND its first bytes. */
export function detectFileType(file) {
  const name = String(file.originalname || '').toLowerCase();
  const buf = file.buffer;
  if (name.endsWith('.doc')) {
    throw new HttpError(415, 'Old .doc files are not supported. In Word choose File > Save As > Word Document (.docx).');
  }
  if (name.endsWith('.docx')) {
    if (buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4b) {
      throw new HttpError(415, 'This file is not a real .docx Word document.');
    }
    return 'docx';
  }
  if (name.endsWith('.pdf')) {
    if (buf.slice(0, 5).toString('latin1') !== '%PDF-') {
      throw new HttpError(415, 'This file is not a real PDF.');
    }
    return 'pdf';
  }
  throw new HttpError(415, 'Only .docx and .pdf files can be uploaded.');
}

export function cleanFileName(name) {
  const base = String(name || 'upload').split(/[\\/]/).pop();
  return (
    base
      .replace(/[\u0000-\u001f\u007f"<>:|?*]/g, '')
      .trim()
      .slice(0, 150) || 'upload'
  );
}

// ---------- DOCX ----------
const decodeEntities = (s) =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&');

function wrapMarks(marker) {
  return (_m, _tag, inner) => {
    const trimmed = inner.trim();
    if (!trimmed) return inner;
    const lead = inner.match(/^\s*/)[0];
    const tail = inner.match(/\s*$/)[0];
    return `${lead}${marker}${trimmed}${marker}${tail}`;
  };
}

/** Converts the simple HTML produced by mammoth into the site's plain-text format. */
export function htmlToChapterText(html) {
  let s = html.replace(/\r/g, '').replace(/\*/g, '\\*'); // literal asterisks must be escaped
  for (let i = 0; i < 3; i++) {
    s = s.replace(/<(strong|b)>([\s\S]*?)<\/\1>/g, wrapMarks('**'));
    s = s.replace(/<(em|i)>([\s\S]*?)<\/\1>/g, wrapMarks('*'));
  }
  s = s.replace(/<br\s*\/?>/g, '\n');
  s = s.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/g, (_m, level, inner) => {
    const plain = inner.replace(/<[^>]+>/g, '').replace(/\*\*|\*/g, '');
    return `\n\n${'#'.repeat(Math.min(Number(level), 3))} ${plain.trim()}\n\n`;
  });
  s = s.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/g, (_m, inner) => {
    const lines = inner
      .replace(/<\/p>/g, '\n')
      .replace(/<[^>]+>/g, '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    return '\n\n' + lines.map((l) => `> ${l}`).join('\n') + '\n\n';
  });
  s = s.replace(/<hr\s+class="page-break"\s*\/?>/gi, '\n\n---page---\n\n');
  s = s.replace(/<\/(p|li|tr)>/g, '\n\n').replace(/<[^>]+>/g, '');
  s = decodeEntities(s);

  const lines = s
    .split('\n')
    .map((l) => l.replace(/[ \t ]+/g, ' ').trim())
    .map((l) => {
      if (/^[-–—_=~*]{0,3}page[-–—_=~*]{0,3}$/i.test(l)) return '---page---';
      return /^(?:\\\*\s*){3,}$/.test(l) || /^[-–—_=~]{3,}$/.test(l) ? '***' : l;
    });
  return lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function extractDocx(buffer) {
  const warnings = [];
  let result;
  try {
    result = await mammoth.convertToHtml(
      { buffer },
      {
        convertImage: mammoth.images.imgElement(async () => ({ src: 'image-removed' })),
        styleMap: ["br[type='page'] => hr.page-break"],
      },
    );
  } catch {
    throw new HttpError(422, 'That Word file could not be read. Try opening it in Word and saving it again as .docx.');
  }
  if (/<img\b/.test(result.value)) warnings.push('Pictures in the document were skipped (only text is imported).');
  if (/<table\b/.test(result.value)) warnings.push('The document contains a table; its text was imported without the table layout.');
  return { text: htmlToChapterText(result.value), warnings };
}

// ---------- PDF ----------
const LIGATURES = { 'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬀ': 'ff', 'ﬃ': 'ffi', 'ﬄ': 'ffl' };

/** Turns raw PDF text (hard-wrapped lines) back into paragraphs. Best effort. */
export function reflowPdfText(raw) {
  const cleaned = raw
    .replace(/\f/g, '\n\n---page---\n\n')
    .replace(/\r/g, '')
    .replace(/[ﬁﬂﬀﬃﬄ]/g, (c) => LIGATURES[c])
    .split('\n')
    .map((l) => l.replace(/[ \t ]+/g, ' ').trim());

  // Drop bare page numbers.
  const lines = cleaned.filter((l) => !/^\d{1,4}$/.test(l));
  const hasBlankLines = lines.some((l) => l === '');
  const nonEmpty = lines.filter(Boolean);
  if (nonEmpty.length === 0) return '';

  const lengths = nonEmpty.map((l) => l.length).sort((a, b) => a - b);
  const median = lengths[Math.floor(lengths.length / 2)] || 0;

  const paragraphs = [];
  let current = '';
  let lastLen = 0; // length of the previous physical line
  const flush = () => {
    if (current) paragraphs.push(current);
    current = '';
  };
  for (const line of lines) {
    if (line === '') {
      if (hasBlankLines) flush();
      continue;
    }
    if (current) {
      const endsSentence = /[.!?…:"”’)]$/.test(current);
      const shortLine = lastLen < median * 0.75;
      // Hard-wrapped PDFs: a short line that ends a sentence usually ends a paragraph.
      if (!hasBlankLines && endsSentence && shortLine) flush();
    }
    if (!current) current = line;
    else if (current.endsWith('-') && /^[a-z]/.test(line)) current = current.slice(0, -1) + line;
    else current += ' ' + line;
    lastLen = line.length;
  }
  flush();
  return paragraphs.join('\n\n');
}

async function extractPdf(buffer) {
  let data;
  try {
    data = await Promise.race([
      pdfParse(buffer),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 30_000)),
    ]);
  } catch {
    throw new HttpError(
      422,
      'That PDF could not be read. It may be a scanned image, damaged, or password-protected. Please upload the .docx instead, or paste the text.',
    );
  }
  const text = reflowPdfText(data.text || '');
  if (!text) {
    throw new HttpError(
      422,
      'No text could be found in that PDF. It may be a scanned image. Please upload the .docx instead, or paste the text.',
    );
  }
  return {
    text,
    warnings: [
      'Text was extracted from a PDF, so paragraph breaks are estimated. Please read it through before publishing. A .docx import is more accurate.',
    ],
  };
}

/** Returns { text, warnings } for a validated file. */
export async function extractChapterText(buffer, fileType) {
  const out = fileType === 'docx' ? await extractDocx(buffer) : await extractPdf(buffer);
  if (!out.text) throw new HttpError(422, 'No text could be found in that file.');
  if (out.text.length > MAX_CONTENT) throw new HttpError(422, 'That file is too long to import as one chapter.');
  const first = out.text.split('\n')[0];
  if (/^(#+\s*)?(chapter|ch\.?|part|prologue)\b/i.test(first)) {
    out.warnings.push(
      `The first line is "${first.slice(0, 60)}". The site already shows the chapter number and title above the text, so delete that line in the editor if it repeats them.`,
    );
  }
  return out;
}
