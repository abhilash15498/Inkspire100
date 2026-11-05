import { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { parseBlocks, renderBlock } from '../markdown.jsx';
import { Chip, Notice, fmtDate, readingMinutes } from '../ui.jsx';

/**
 * PagedBookReader
 * Displays chapter content in physical Paperback Statement pages (13.97 cm x 21.59 cm)
 * with Narrow Margins (1.27 cm).
 *
 * Guarantees:
 * - Exact physical page dimensions and margins
 * - ZERO text bleeding on the sides (each page only renders its own blocks)
 * - ZERO blank ghost pages (accurate dynamic block partitioning)
 * - Word document date headers (e.g. 15TH January 2007) and section numbers centered
 * - Tap edges, keyboard arrows, and buttons to flip pages
 */
export function PagedBookReader({
  title,
  bookTitle = 'Is It Me or You as Well?',
  eyebrow,
  content,
  wordCount,
  version,
  updatedAt,
  changeNote,
  updatedSinceMyFeedback,
  pdf,
  prevId,
  nextId,
  onPrevChapter,
  onNextChapter,
  authorPreview = false,
  apiHref,
  children,
}) {
  const [mode, setMode] = useState(() => {
    try {
      return localStorage.getItem('reader.viewMode') || 'pages';
    } catch {
      return 'pages';
    }
  });

  const [currentPage, setCurrentPage] = useState(0);
  const [pages, setPages] = useState([]);
  const [showFeedback, setShowFeedback] = useState(false);

  const measureRef = useRef(null);
  const headMeasureRef = useRef(null);
  const sheetRef = useRef(null);
  const pageBodyRef = useRef(null);
  const touchStartX = useRef(null);

  const blocks = useMemo(() => parseBlocks(content), [content]);

  const changeMode = (newMode) => {
    setMode(newMode);
    try {
      localStorage.setItem('reader.viewMode', newMode);
    } catch {
      /* ignore */
    }
  };

  // Partition blocks into pages based on actual rendered heights
  const partitionPages = useCallback(() => {
    if (mode !== 'pages' || !measureRef.current) return;

    const measureEl = measureRef.current;
    const blockEls = Array.from(measureEl.children);
    if (blockEls.length === 0) {
      setPages([[]]);
      return;
    }

    // 1. Measure the real printable height available in the book paper sheet
    let bodyH = 0;
    if (pageBodyRef.current) {
      bodyH = pageBodyRef.current.getBoundingClientRect().height;
    } else if (sheetRef.current) {
      const sheetBox = sheetRef.current.getBoundingClientRect();
      const pxPerCm = sheetBox.width > 0 ? sheetBox.width / 13.97 : 37.8;
      const paddingVertical = 2 * 1.27 * pxPerCm;
      // Running header: 32px + 12.8px (0.8rem) + 1px border = 45.8px
      // Running footer: 34px + 9.6px (0.6rem) + 1px border = 44.6px
      // Border: 2px
      const nonBodyH = 45.8 + 44.6 + 2;
      bodyH = Math.max(300, sheetBox.height - paddingVertical - nonBodyH);
    } else {
      bodyH = 620;
    }

    // Safety buffer: keep 28px breathing room above the running footer
    // (approximately one full line height 1.75 * 16px) so the bottom-most line
    // is never clipped, sliced, or embedded into the footer border.
    const SAFETY_BUFFER = 28;
    const regularMaxH = Math.max(260, bodyH - SAFETY_BUFFER);

    // Page 1 header outer height (including margins)
    let headH = 120;
    if (headMeasureRef.current) {
      const rect = headMeasureRef.current.getBoundingClientRect();
      const style = window.getComputedStyle(headMeasureRef.current);
      const mt = parseFloat(style.marginTop) || 0;
      const mb = parseFloat(style.marginBottom) || 0;
      headH = rect.height + mt + mb;
    }
    const page1MaxH = Math.max(180, regularMaxH - headH);

    const computed = [];
    let currentBlockList = [];
    let currentH = 0;
    let maxH = page1MaxH;

    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];

      // Explicit page break marker
      if (b.type === 'pagebreak') {
        if (currentBlockList.length > 0) {
          computed.push(currentBlockList);
          currentBlockList = [];
          currentH = 0;
          maxH = regularMaxH;
        }
        continue;
      }

      const el = blockEls[i];
      let h = el ? el.getBoundingClientRect().height : 32;
      // Include margins
      if (el) {
        const style = window.getComputedStyle(el);
        const marginTop = parseFloat(style.marginTop) || 0;
        const marginBottom = parseFloat(style.marginBottom) || 0;
        h += marginTop + marginBottom;
      }

      // If adding this block overflows the current page
      if (currentH + h > maxH) {
        if (currentBlockList.length > 0) {
          computed.push(currentBlockList);
          currentBlockList = [];
          currentH = 0;
          maxH = regularMaxH;
        }

        // If the block alone fits on a fresh page (which normal paragraphs do)
        if (h <= maxH) {
          currentBlockList.push(b);
          currentH = h;
        } else if (b.type === 'p' && b.text) {
          // If a single paragraph is longer than an entire page, split cleanly by sentences
          const sentences = b.text.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) || [b.text];
          if (sentences.length > 1) {
            let partText = '';
            let sIdx = 0;
            const avgSentH = h / sentences.length;
            while (sIdx < sentences.length && (currentH + avgSentH <= maxH || currentBlockList.length === 0)) {
              partText += sentences[sIdx];
              currentH += avgSentH;
              sIdx++;
            }
            if (partText) {
              currentBlockList.push({ ...b, text: partText.trim() });
            }
            computed.push(currentBlockList);
            currentBlockList = [];
            currentH = 0;
            maxH = regularMaxH;

            const remainingText = sentences.slice(sIdx).join('').trim();
            if (remainingText) {
              currentBlockList.push({ ...b, text: remainingText, continued: true });
              currentH = (sentences.length - sIdx) * avgSentH;
            }
          } else {
            currentBlockList.push(b);
            currentH = h;
          }
        } else {
          currentBlockList.push(b);
          currentH = h;
        }
      } else {
        currentBlockList.push(b);
        currentH += h;
      }
    }

    if (currentBlockList.length > 0) {
      computed.push(currentBlockList);
    }
    if (computed.length === 0) {
      computed.push([]);
    }

    setPages(computed);
    setCurrentPage((cur) => Math.min(cur, computed.length - 1));
  }, [mode, blocks]);

  // Measure and partition whenever content, title, or mode changes
  useLayoutEffect(() => {
    partitionPages();

    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        partitionPages();
      });
      if (measureRef.current) ro.observe(measureRef.current);
      if (sheetRef.current) ro.observe(sheetRef.current);
    }

    const handleResize = () => partitionPages();
    window.addEventListener('resize', handleResize);
    if (document.fonts?.ready) {
      document.fonts.ready.then(() => {
        partitionPages();
      });
    }
    return () => {
      window.removeEventListener('resize', handleResize);
      if (ro) ro.disconnect();
    };
  }, [partitionPages]);

  // Reset to page 0 when chapter changes
  useEffect(() => {
    setCurrentPage(0);
  }, [title]);

  const totalPages = Math.max(1, pages.length);
  const isFirstPage = currentPage === 0;
  const isLastPage = currentPage === totalPages - 1;
  const progressPercent = Math.round(((currentPage + 1) / totalPages) * 100);

  const goToPrev = useCallback(() => {
    if (currentPage > 0) {
      setCurrentPage((p) => p - 1);
    } else if (onPrevChapter) {
      onPrevChapter();
    }
  }, [currentPage, onPrevChapter]);

  const goToNext = useCallback(() => {
    if (currentPage < totalPages - 1) {
      setCurrentPage((p) => p + 1);
    } else if (onNextChapter) {
      onNextChapter();
    }
  }, [currentPage, totalPages, onNextChapter]);

  // Keyboard navigation
  useEffect(() => {
    if (mode !== 'pages') return;
    const onKey = (e) => {
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable) return;

      if (e.key === 'ArrowRight' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) {
        e.preventDefault();
        goToNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) {
        e.preventDefault();
        goToPrev();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, goToNext, goToPrev]);

  // Touch swipe support
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    touchStartX.current = null;
    if (Math.abs(diff) > 45) {
      if (diff > 0) goToNext();
      else goToPrev();
    }
  };

  // Blocks for current page
  const activePageBlocks = pages[currentPage] || blocks;

  return (
    <div className={`paged-book-container mode-${mode}`}>
      {/* Hidden Off-Screen Measurement Container */}
      <div className="book-measure-box" aria-hidden="true">
        <div ref={headMeasureRef} className="chapter-head book-first-page-head">
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1 className="display">{title}</h1>
        </div>
        <div ref={measureRef} className="prose">
          {blocks.map((b, i) => renderBlock(b, i))}
        </div>
      </div>

      {/* Top Reading Mode Switcher */}
      <div className="book-mode-bar">
        <div className="segmented mode-selector" role="group" aria-label="Reading mode">
          <button
            type="button"
            className={mode === 'pages' ? 'active' : ''}
            onClick={() => changeMode('pages')}
            title="Read in physical Statement Paperback pages (13.97 x 21.59 cm)"
          >
            📖 Pages
          </button>
          <button
            type="button"
            className={mode === 'scroll' ? 'active' : ''}
            onClick={() => changeMode('scroll')}
            title="Continuous single scroll"
          >
            📜 Continuous
          </button>
        </div>

        {mode === 'pages' && (
          <span className="page-counter-badge muted small">
            Page {currentPage + 1} of {totalPages}
          </span>
        )}
      </div>

      {mode === 'pages' ? (
        /* ==================== EXACT PAPERBACK SHEET ==================== */
        <div className="book-stage">
          <div
            className="book-paper-sheet"
            ref={sheetRef}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* Running Header */}
            <div className="book-running-header">
              <span className="book-running-title">{bookTitle}</span>
              <span className="book-running-chapter">{title}</span>
            </div>

            {/* Click-to-turn transparent edge tap zones */}
            <button
              type="button"
              className="page-tap-zone page-tap-prev"
              onClick={goToPrev}
              disabled={isFirstPage && !prevId && !onPrevChapter}
              aria-label="Previous page"
              tabIndex={-1}
            >
              <span className="page-tap-arrow">‹</span>
            </button>
            <button
              type="button"
              className="page-tap-zone page-tap-next"
              onClick={goToNext}
              disabled={isLastPage && !nextId && !onNextChapter}
              aria-label="Next page"
              tabIndex={-1}
            >
              <span className="page-tap-arrow">›</span>
            </button>

            {/* Page Body Content */}
            <div className="book-page-body" ref={pageBodyRef}>
              {currentPage === 0 && (
                <header className="chapter-head book-first-page-head">
                  {eyebrow && <p className="eyebrow">{eyebrow}</p>}
                  <h1 className="display">{title}</h1>
                </header>
              )}

              <div className="prose">
                {activePageBlocks.map((b, i) => renderBlock(b, i))}
              </div>

              {isLastPage && (
                <p className="end-mark" aria-hidden="true">
                  ❦
                </p>
              )}
            </div>

            {/* Running Footer */}
            <div className="book-running-footer">
              <span className="book-footer-percent muted small">{progressPercent}%</span>
              <span className="book-footer-number">— {currentPage + 1} —</span>
              <span className="book-footer-count muted small">
                {currentPage + 1} / {totalPages}
              </span>
            </div>

            {/* Progress line */}
            <div
              className="book-progress-line"
              style={{ width: `${progressPercent}%` }}
              aria-hidden="true"
            />
          </div>

          {/* Under-Sheet Controls Bar */}
          <div className="book-page-controls">
            {isFirstPage && (prevId || onPrevChapter) ? (
              prevId ? (
                <Link className="btn btn-small" to={`/chapters/${prevId}`}>
                  ← Previous chapter
                </Link>
              ) : (
                <button type="button" className="btn btn-small" onClick={onPrevChapter}>
                  ← Previous chapter
                </button>
              )
            ) : (
              <button
                type="button"
                className="btn btn-small"
                onClick={goToPrev}
                disabled={isFirstPage}
                aria-label="Previous page"
              >
                ← Prev Page
              </button>
            )}

            <div className="page-scrubber">
              <input
                type="range"
                min="0"
                max={Math.max(0, totalPages - 1)}
                value={currentPage}
                onChange={(e) => setCurrentPage(Number(e.target.value))}
                aria-label="Jump to page"
              />
              <span className="small muted">
                Page {currentPage + 1} of {totalPages}
              </span>
            </div>

            {isLastPage && (nextId || onNextChapter) ? (
              nextId ? (
                <Link className="btn btn-primary btn-small" to={`/chapters/${nextId}`}>
                  Next chapter →
                </Link>
              ) : (
                <button type="button" className="btn btn-primary btn-small" onClick={onNextChapter}>
                  Next chapter →
                </button>
              )
            ) : (
              <button
                type="button"
                className="btn btn-primary btn-small"
                onClick={goToNext}
                disabled={isLastPage}
                aria-label="Next page"
              >
                Next Page →
              </button>
            )}
          </div>

          {/* PDF Link if present */}
          {pdf && apiHref && (
            <p className="small center-text mt-1">
              <a href={apiHref} target="_blank" rel="noopener noreferrer">
                Open original PDF
              </a>{' '}
              <span className="muted">({pdf.name})</span>
            </p>
          )}

          {/* Feedback Drawer / Section */}
          {children && (
            <div className="book-feedback-wrapper">
              <div className="feedback-toggle-bar">
                <button
                  type="button"
                  className={`btn btn-small ${showFeedback || isLastPage ? 'btn-ghost' : ''}`}
                  onClick={() => setShowFeedback((v) => !v)}
                >
                  💬 {showFeedback ? 'Hide Feedback' : 'Give Feedback on this chapter'}
                </button>
              </div>
              {(showFeedback || isLastPage) && (
                <div className="book-feedback-panel">{children}</div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ==================== SCROLL (CONTINUOUS) MODE ==================== */
        <article className="chapter scroll-mode-article">
          <header className="chapter-head">
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h1 className="display">{title}</h1>
          </header>

          <div className="prose">
            {blocks.map((b, i) => renderBlock(b, i))}
          </div>

          <p className="end-mark" aria-hidden="true">
            ❦
          </p>

          {pdf && apiHref && (
            <p className="small">
              <a href={apiHref} target="_blank" rel="noopener noreferrer">
                Open this chapter as a PDF
              </a>{' '}
              <span className="muted">({pdf.name})</span>
            </p>
          )}

          <nav className="chapter-nav" aria-label="Chapter navigation">
            {prevId ? (
              <Link className="btn" to={`/chapters/${prevId}`}>
                ← Previous chapter
              </Link>
            ) : (
              <span />
            )}
            {nextId ? (
              <Link className="btn btn-primary" to={`/chapters/${nextId}`}>
                Next chapter →
              </Link>
            ) : (
              <span />
            )}
          </nav>

          {children}
        </article>
      )}
    </div>
  );
}
