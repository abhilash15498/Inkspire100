import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChapterText, parseBlocks } from '../src/markdown.jsx';

const html = (t) => renderToStaticMarkup(<ChapterText text={t} />);

describe('chapter text formatting', () => {
  it('makes each line a paragraph and ignores blank lines', () => {
    expect(html('One.\n\n\nTwo.')).toBe('<div class="prose"><p>One.</p><p>Two.</p></div>');
  });
  it('handles italic, bold and escaped asterisks', () => {
    expect(html('a *b* **c** \\*d\\*')).toContain('a <em>b</em> <strong>c</strong> *d*');
  });
  it('detects scene breaks, headings and quotes', () => {
    const types = parseBlocks('# Title\n***\n> quoted\n> more\nText').map((b) => b.type);
    expect(types).toEqual(['heading', 'break', 'quote', 'p']);
  });
  it('never turns text into HTML (no script injection)', () => {
    const out = html('<script>alert(1)</script> <img src=x onerror=alert(1)>');
    expect(out).not.toContain('<script');
    expect(out).not.toContain('<img');
    expect(out).toContain('&lt;script&gt;');
  });
  it('shows a placeholder for empty text', () => {
    expect(html('')).toContain('There is no text yet');
  });
});
