import { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { parseBlocks, renderBlock } from '../markdown.jsx';
import { Chip, Notice, fmtDate, readingMinutes } from '../ui.jsx';

/**
 * BookPageSheet - Renders one leaf / page of the book
 */
function BookPageSheet({
  pageIndex,
  totalPages,
  pageBlocks,
  title,
  bookTitle,
  eyebrow,
  isLeft = false,
  isRight = false,
  nextId,
  onNextChapter,
  bodyRef,
}) {
  if (pageIndex >= totalPages) {
    return (
      <div className={`book-paper-sheet ${isLeft ? 'book-sheet-left' : 'book-sheet-right'} book-sheet-blank`}>
        <div className={`book-spine-gutter ${isLeft ? 'spine-right' : 'spine-left'}`} aria-hidden="true" />
        <div className="book-page-body book-blank-body">
          <div className="book-colophon">
            <span className="colophon-ornament">❦</span>
            <p className="colophon-title">{bookTitle}</p>
            <p className="colophon-author">by H.M. Abhilash</p>
            {(nextId || onNextChapter) && (
              <div className="colophon-next-btn">
                {nextId ? (
                  <Link className="btn btn-primary" to={`/chapters/${nextId}`}>
                    Continue to Next Chapter →
                  </Link>
                ) : (
                  <button type="button" className="btn btn-primary" onClick={onNextChapter}>
                    Continue to Next Chapter →
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="book-running-footer">
          <span className="book-footer-number muted small">— End of Chapter —</span>
        </div>
      </div>
    );
  }

  const isFirst = pageIndex === 0;
  const isLast = pageIndex === totalPages - 1;
  const progressPercent = Math.round(((pageIndex + 1) / totalPages) * 100);

  return (
    <div className={`book-paper-sheet ${isLeft ? 'book-sheet-left' : ''} ${isRight ? 'book-sheet-right' : ''}`}>
      <div className={`book-spine-gutter ${isLeft ? 'spine-right' : 'spine-left'}`} aria-hidden="true" />
      <div className="book-running-header">
        <span className="book-running-title">{isLeft ? bookTitle : title}</span>
        <span className="book-running-chapter">{isLeft ? title : `p. ${pageIndex + 1}`}</span>
      </div>
      <div className="book-page-body" ref={bodyRef}>
        {isFirst && (
          <header className="chapter-head book-first-page-head">
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h1 className="display">{title}</h1>
          </header>
        )}
        <div className="prose">
          {(pageBlocks || []).map((b, i) => renderBlock(b, i))}
        </div>
        {isLast && (
          <p className="end-mark" aria-hidden="true">❦</p>
        )}
      </div>
      <div className="book-running-footer">
        <span className="book-footer-percent muted small">{isLeft ? `${progressPercent}%` : ''}</span>
        <span className="book-footer-number">— {pageIndex + 1} —</span>
        <span className="book-footer-count muted small">{isRight ? `${pageIndex + 1} / ${totalPages}` : ''}</span>
      </div>
    </div>
  );
}

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
      return localStorage.getItem('reader.viewMode') || 'spread';
    } catch {
      return 'spread';
    }
  });

  const [currentPage, setCurrentPage] = useState(0);
  const [pages, setPages] = useState([]);
  const [showFeedback, setShowFeedback] = useState(false);
  const [flipStatus, setFlipStatus] = useState('');
  const [turningPage, setTurningPage] = useState(null);
  const [hoverEdge, setHoverEdge] = useState(null);
  const [bookmarkStyle, setBookmarkStyle] = useState(() => {
    try {
      return localStorage.getItem('reader.bookmarkStyle') || 'crimson';
    } catch {
      return 'crimson';
    }
  });
  const isFlipping = useRef(false);

  const changeBookmarkStyle = (s) => {
    setBookmarkStyle(s);
    try {
      localStorage.setItem('reader.bookmarkStyle', s);
    } catch {
      /* ignore */
    }
  };

  const measureRef = useRef(null);
  const headMeasureRef = useRef(null);
  const sheetRef = useRef(null);
  const pageBodyRef = useRef(null);
  const touchStartX = useRef(null);

  const blocks = useMemo(() => parseBlocks(content), [content]);

  const changeMode = (newMode) => {
    setMode(newMode);
    if (newMode === 'spread') {
      setCurrentPage((p) => p - (p % 2));
    }
    try {
      localStorage.setItem('reader.viewMode', newMode);
    } catch {
      /* ignore */
    }
  };

  // Partition blocks into pages based on actual rendered heights
  const partitionPages = useCallback(() => {
    if ((mode !== 'pages' && mode !== 'spread') || !measureRef.current) return;

    // 1. Measure the real printable width and height of the visible book page body
    let targetWidth = 0;
    let bodyH = 0;

    const liveBody = pageBodyRef.current || document.querySelector('.book-page-body:not(.book-blank-body)');
    if (liveBody) {
      const rect = liveBody.getBoundingClientRect();
      targetWidth = rect.width;
      bodyH = rect.height;
    } else if (sheetRef.current) {
      const sheetBox = sheetRef.current.getBoundingClientRect();
      const pxPerCm = sheetBox.width > 0 ? sheetBox.width / 13.97 : 37.8;
      const paddingVertical = 2 * 1.27 * pxPerCm;
      const nonBodyH = 45.8 + 44.6 + 2;
      bodyH = Math.max(300, sheetBox.height - paddingVertical - nonBodyH);
      targetWidth = Math.max(200, sheetBox.width - 2 * 1.27 * pxPerCm);
    }

    if (!bodyH || bodyH < 300) {
      bodyH = 600;
    }

    // Synchronize the off-screen measurement box to match EXACT width of the visible page
    if (targetWidth > 100 && measureRef.current) {
      const parentMeasure = measureRef.current.parentElement;
      if (parentMeasure) {
        parentMeasure.style.width = `${Math.floor(targetWidth)}px`;
        parentMeasure.style.maxWidth = `${Math.floor(targetWidth)}px`;
      }
      measureRef.current.style.width = `${Math.floor(targetWidth)}px`;
    }

    const measureEl = measureRef.current;
    const blockEls = Array.from(measureEl.children);
    if (blockEls.length === 0) {
      setPages([[]]);
      return;
    }

    // Generous safety buffer: 48px (~2 full line heights above running footer)
    // Guarantees zero text bleeding, clipping, or slicing at the bottom
    const SAFETY_BUFFER = 48;
    const regularMaxH = Math.max(200, bodyH - SAFETY_BUFFER);

    // Page 1 header outer height (including margins)
    let headH = 120;
    if (headMeasureRef.current) {
      const rect = headMeasureRef.current.getBoundingClientRect();
      const style = window.getComputedStyle(headMeasureRef.current);
      const mt = parseFloat(style.marginTop) || 0;
      const mb = parseFloat(style.marginBottom) || 0;
      headH = rect.height + mt + mb;
    }
    const page1MaxH = Math.max(160, regularMaxH - headH);

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
            let sIdx = 0;
            const avgSentH = Math.max(20, h / sentences.length);
            while (sIdx < sentences.length) {
              let partText = '';
              while (sIdx < sentences.length && (currentH + avgSentH <= maxH || currentBlockList.length === 0)) {
                partText += sentences[sIdx];
                currentH += avgSentH;
                sIdx++;
              }
              if (partText) {
                currentBlockList.push({
                  ...b,
                  text: partText.trim(),
                  continued: currentBlockList.length === 0 && sIdx > 1,
                });
              }
              if (sIdx < sentences.length) {
                computed.push(currentBlockList);
                currentBlockList = [];
                currentH = 0;
                maxH = regularMaxH;
              }
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
      if (pageBodyRef.current) ro.observe(pageBodyRef.current);
      const containerEl = document.querySelector('.paged-book-container');
      if (containerEl) ro.observe(containerEl);
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

  const isSpread = mode === 'spread';
  const totalPages = Math.max(1, pages.length);
  const isFirstPage = currentPage === 0;
  const isLastPage = isSpread ? currentPage + 1 >= totalPages - 1 : currentPage === totalPages - 1;
  const progressPercent = Math.round(
    ((currentPage + (isSpread ? Math.min(2, totalPages - currentPage) : 1)) / totalPages) * 100
  );

  const goToPrev = useCallback(() => {
    if (isFlipping.current) return;
    if (currentPage > 0) {
      isFlipping.current = true;
      setHoverEdge(null);
      const step = mode === 'spread' ? 2 : 1;
      const target = Math.max(0, currentPage - step);
      setTurningPage({ from: currentPage, to: target, direction: 'prev' });
      setFlipStatus('flipping-prev');
      setTimeout(() => {
        setCurrentPage(target);
        setFlipStatus('');
        setTurningPage(null);
        isFlipping.current = false;
      }, mode === 'spread' ? 520 : 420);
    } else if (onPrevChapter) {
      onPrevChapter();
    }
  }, [currentPage, mode, onPrevChapter]);

  const goToNext = useCallback(() => {
    if (isFlipping.current) return;
    const canGoNext = mode === 'spread' ? currentPage + 2 < totalPages : currentPage < totalPages - 1;
    if (canGoNext) {
      isFlipping.current = true;
      setHoverEdge(null);
      const step = mode === 'spread' ? 2 : 1;
      const target = Math.min(totalPages - 1, currentPage + step);
      setTurningPage({ from: currentPage, to: target, direction: 'next' });
      setFlipStatus('flipping-next');
      setTimeout(() => {
        setCurrentPage(target);
        setFlipStatus('');
        setTurningPage(null);
        isFlipping.current = false;
      }, mode === 'spread' ? 520 : 420);
    } else if (onNextChapter) {
      onNextChapter();
    }
  }, [currentPage, mode, totalPages, onNextChapter]);

  // Keyboard navigation
  useEffect(() => {
    if (mode !== 'pages' && mode !== 'spread') return;
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

      {/* Top Reading Mode Switcher with 3 modes */}
      <div className="book-mode-bar">
        <div className="segmented mode-selector" role="group" aria-label="Reading mode">
          <button
            type="button"
            className={mode === 'spread' ? 'active' : ''}
            onClick={() => changeMode('spread')}
            title="Read in two-page open book spread"
          >
            📖 2-Page Book
          </button>
          <button
            type="button"
            className={mode === 'pages' ? 'active' : ''}
            onClick={() => changeMode('pages')}
            title="Read in single Statement Paperback page"
          >
            📄 Single Page
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

        {/* Customizable Ribbon Bookmark Picker */}
        <div className="bookmark-style-picker" role="group" aria-label="Ribbon Bookmark Style" title="Choose your custom ribbon bookmark style">
          <span className="muted small" style={{ marginRight: '4px', fontSize: '0.75rem' }}>🔖 Bookmark:</span>
          <button
            type="button"
            className={`bookmark-chip crimson ${bookmarkStyle === 'crimson' ? 'active' : ''}`}
            onClick={() => changeBookmarkStyle('crimson')}
            aria-label="Crimson Silk Bookmark"
            title="Crimson Silk Bookmark"
          />
          <button
            type="button"
            className={`bookmark-chip gold ${bookmarkStyle === 'gold' ? 'active' : ''}`}
            onClick={() => changeBookmarkStyle('gold')}
            aria-label="Antique Gold Leaf Bookmark"
            title="Antique Gold Leaf Bookmark"
          />
          <button
            type="button"
            className={`bookmark-chip emerald ${bookmarkStyle === 'emerald' ? 'active' : ''}`}
            onClick={() => changeBookmarkStyle('emerald')}
            aria-label="Forest Emerald Bookmark"
            title="Forest Emerald Bookmark"
          />
          <button
            type="button"
            className={`bookmark-chip midnight ${bookmarkStyle === 'midnight' ? 'active' : ''}`}
            onClick={() => changeBookmarkStyle('midnight')}
            aria-label="Midnight Obsidian Bookmark"
            title="Midnight Obsidian Bookmark"
          />
        </div>

        {mode === 'spread' && (
          <span className="page-counter-badge muted small">
            Pages {currentPage + 1}–{Math.min(totalPages, currentPage + 2)} of {totalPages}
          </span>
        )}
        {mode === 'pages' && (
          <span className="page-counter-badge muted small">
            Page {currentPage + 1} of {totalPages}
          </span>
        )}
      </div>

      {mode === 'spread' ? (
        /* ==================== TWO-PAGE BOOK SPREAD ==================== */
        <div className="book-spread-stage">
          <div className="book-spread-volume" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
            {/* Center Spine Crease & Shadow */}
            <div className="book-spread-spine" aria-hidden="true" />
            <div className="book-spread-stitch" aria-hidden="true" />

            {/* Silk Ribbon Bookmark dangling from spine top */}
            <div className={`book-ribbon-bookmark ribbon-${bookmarkStyle}`} aria-hidden="true" />

            {/* Left Page Half */}
            <div className={`book-spread-half spread-left-half${hoverEdge === 'prev' && !flipStatus ? ' hover-lift-left' : ''}`}>
              <BookPageSheet
                pageIndex={flipStatus === 'flipping-prev' ? turningPage.to : currentPage}
                totalPages={totalPages}
                pageBlocks={pages[flipStatus === 'flipping-prev' ? turningPage.to : currentPage]}
                title={title}
                bookTitle={bookTitle}
                eyebrow={eyebrow}
                isLeft={true}
                nextId={nextId}
                onNextChapter={onNextChapter}
                bodyRef={pageBodyRef}
              />
              <button
                type="button"
                className="page-tap-zone page-tap-prev"
                onClick={goToPrev}
                disabled={isFirstPage && !prevId && !onPrevChapter}
                onMouseEnter={() => (!isFirstPage || prevId || onPrevChapter) && setHoverEdge('prev')}
                onMouseLeave={() => setHoverEdge(null)}
                aria-label="Previous pages"
                tabIndex={-1}
              >
                <span className="page-tap-arrow">‹</span>
              </button>
              <div className="page-curl-corner corner-left" aria-hidden="true" />
            </div>

            {/* Right Page Half */}
            <div className={`book-spread-half spread-right-half${hoverEdge === 'next' && !flipStatus ? ' hover-lift-right' : ''}`}>
              <BookPageSheet
                pageIndex={flipStatus === 'flipping-next' ? turningPage.to + 1 : currentPage + 1}
                totalPages={totalPages}
                pageBlocks={pages[flipStatus === 'flipping-next' ? turningPage.to + 1 : currentPage + 1]}
                title={title}
                bookTitle={bookTitle}
                eyebrow={eyebrow}
                isRight={true}
                nextId={nextId}
                onNextChapter={onNextChapter}
              />
              <button
                type="button"
                className="page-tap-zone page-tap-next"
                onClick={goToNext}
                disabled={isLastPage && !nextId && !onNextChapter}
                onMouseEnter={() => (!isLastPage || nextId || onNextChapter) && setHoverEdge('next')}
                onMouseLeave={() => setHoverEdge(null)}
                aria-label="Next pages"
                tabIndex={-1}
              >
                <span className="page-tap-arrow">›</span>
              </button>
              <div className="page-curl-corner corner-right" aria-hidden="true" />
            </div>

            {/* 3D Flipping Leaf (forward turn across spine) */}
            {flipStatus === 'flipping-next' && turningPage && (
              <div className="book-spread-leaf leaf-turning-next" aria-hidden="true">
                <div className="book-leaf-face face-front">
                  <BookPageSheet
                    pageIndex={turningPage.from + 1}
                    totalPages={totalPages}
                    pageBlocks={pages[turningPage.from + 1]}
                    title={title}
                    bookTitle={bookTitle}
                    eyebrow={eyebrow}
                    isRight={true}
                    nextId={nextId}
                    onNextChapter={onNextChapter}
                  />
                </div>
                <div className="book-leaf-face face-back">
                  <BookPageSheet
                    pageIndex={turningPage.to}
                    totalPages={totalPages}
                    pageBlocks={pages[turningPage.to]}
                    title={title}
                    bookTitle={bookTitle}
                    eyebrow={eyebrow}
                    isLeft={true}
                    nextId={nextId}
                    onNextChapter={onNextChapter}
                  />
                </div>
              </div>
            )}

            {/* 3D Flipping Leaf (backward turn across spine) */}
            {flipStatus === 'flipping-prev' && turningPage && (
              <div className="book-spread-leaf leaf-turning-prev" aria-hidden="true">
                <div className="book-leaf-face face-front">
                  <BookPageSheet
                    pageIndex={turningPage.from}
                    totalPages={totalPages}
                    pageBlocks={pages[turningPage.from]}
                    title={title}
                    bookTitle={bookTitle}
                    eyebrow={eyebrow}
                    isLeft={true}
                    nextId={nextId}
                    onNextChapter={onNextChapter}
                  />
                </div>
                <div className="book-leaf-face face-back-prev">
                  <BookPageSheet
                    pageIndex={turningPage.to + 1}
                    totalPages={totalPages}
                    pageBlocks={pages[turningPage.to + 1]}
                    title={title}
                    bookTitle={bookTitle}
                    eyebrow={eyebrow}
                    isRight={true}
                    nextId={nextId}
                    onNextChapter={onNextChapter}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Under-Spread Controls Bar */}
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
                onMouseEnter={() => !isFirstPage && setHoverEdge('prev')}
                onMouseLeave={() => setHoverEdge(null)}
                aria-label="Previous pages"
              >
                ← Prev Pages
              </button>
            )}

            <div className="page-scrubber">
              <input
                type="range"
                min="0"
                max={Math.max(0, totalPages - 1)}
                step={2}
                value={currentPage}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setCurrentPage(val - (val % 2));
                }}
                aria-label="Jump to page spread"
              />
              <span className="small muted">
                Pages {currentPage + 1}–{Math.min(totalPages, currentPage + 2)} of {totalPages}
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
                onMouseEnter={() => !isLastPage && setHoverEdge('next')}
                onMouseLeave={() => setHoverEdge(null)}
                aria-label="Next pages"
              >
                Next Pages →
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
      ) : mode === 'pages' ? (
        /* ==================== SINGLE PAPERBACK SHEET ==================== */
        <div className="book-stage">
          <div className="book-volume">
            {/* Silk Ribbon Bookmark dangling from top */}
            <div className={`book-ribbon-bookmark ribbon-${bookmarkStyle}`} aria-hidden="true" />
            {/* Underneath page that is revealed as top page turns */}
            {turningPage && (
              <div className="book-paper-sheet book-underneath-page" aria-hidden="true">
                <div className="book-spine-gutter" aria-hidden="true" />
                <div className="book-running-header">
                  <span className="book-running-title">{bookTitle}</span>
                  <span className="book-running-chapter">{title}</span>
                </div>
                <div className="book-page-body">
                  {turningPage.to === 0 && (
                    <header className="chapter-head book-first-page-head">
                      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
                      <h1 className="display">{title}</h1>
                    </header>
                  )}
                  <div className="prose">
                    {(pages[turningPage.to] || []).map((b, i) => renderBlock(b, i))}
                  </div>
                  {turningPage.to === totalPages - 1 && (
                    <p className="end-mark" aria-hidden="true">❦</p>
                  )}
                </div>
                <div className="book-running-footer">
                  <span className="book-footer-percent muted small">
                    {Math.round(((turningPage.to + 1) / totalPages) * 100)}%
                  </span>
                  <span className="book-footer-number">— {turningPage.to + 1} —</span>
                  <span className="book-footer-count muted small">
                    {turningPage.to + 1} / {totalPages}
                  </span>
                </div>
              </div>
            )}

            {/* Active / Turning Sheet */}
            <div
              className={`book-paper-sheet book-active-sheet${hoverEdge && !flipStatus ? ' hover-' + hoverEdge : ''}${flipStatus ? ' ' + flipStatus : ''}`}
              ref={sheetRef}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              {/* Spine Crease / Gutter */}
              <div className="book-spine-gutter" aria-hidden="true" />

              {/* Real Paper Corner Dog-Ear Curl on Hover */}
              <div className="page-curl-corner" aria-hidden="true" />

              {/* Dynamic Page Turn Shadow Sheen */}
              <div className="page-curl-shadow" aria-hidden="true" />

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
                onMouseEnter={() => (!isFirstPage || prevId || onPrevChapter) && setHoverEdge('prev')}
                onMouseLeave={() => setHoverEdge(null)}
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
                onMouseEnter={() => (!isLastPage || nextId || onNextChapter) && setHoverEdge('next')}
                onMouseLeave={() => setHoverEdge(null)}
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
                onMouseEnter={() => !isFirstPage && setHoverEdge('prev')}
                onMouseLeave={() => setHoverEdge(null)}
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
                onMouseEnter={() => !isLastPage && setHoverEdge('next')}
                onMouseLeave={() => setHoverEdge(null)}
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
