'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { WeeklyReportPage } from '../weekly-report/weekly-report-page';

type Props = {
  readonly reportId: string;
};

/**
 * UFB-NEW-A34: Keyboard-navigable presentation wrapper around WeeklyReportPage.
 *
 * Navigation:
 *   ← / K  — previous section (scrolls to its accordion toggle)
 *   → / J  — next section
 *   F       — toggle browser fullscreen on the wrapper element
 *   Escape  — exits fullscreen (browser handles natively)
 *
 * Sections are discovered from `[data-product-accordion-toggle]` elements
 * rendered inside the report — no separate API call needed.
 */
export function HeadPresentClient({ reportId }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sectionCount, setSectionCount] = useState(0);

  const getSections = useCallback((): Element[] => {
    if (!wrapperRef.current) return [];
    return Array.from(
      wrapperRef.current.querySelectorAll('[data-product-accordion-toggle]'),
    );
  }, []);

  const scrollToSection = useCallback((idx: number) => {
    const sections = getSections();
    if (!sections.length) return;
    const clamped = Math.max(0, Math.min(idx, sections.length - 1));
    setCurrentIndex(clamped);
    setSectionCount(sections.length);
    sections[clamped]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [getSections]);

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => {
      const count = getSections().length;
      const next = Math.min(prev + 1, count - 1);
      scrollToSection(next);
      return next;
    });
  }, [getSections, scrollToSection]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => {
      const next = Math.max(prev - 1, 0);
      scrollToSection(next);
      return next;
    });
  }, [scrollToSection]);

  const toggleFullscreen = useCallback(() => {
    const el = wrapperRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {/* ignore if denied */});
    } else {
      document.exitFullscreen().catch(() => {/* ignore */});
    }
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowRight' || e.key === 'j') goNext();
      else if (e.key === 'ArrowLeft' || e.key === 'k') goPrev();
      else if (e.key === 'f' || e.key === 'F') toggleFullscreen();
    }
    function onFullscreenChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, [goNext, goPrev, toggleFullscreen]);

  // Discover sections after report renders.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSectionCount(getSections().length);
    }, 500);
    return () => clearTimeout(timer);
  }, [getSections]);

  return (
    <div
      ref={wrapperRef}
      data-testid="head-present-wrapper"
      className={isFullscreen ? 'overflow-auto bg-white p-8' : undefined}
    >
      {sectionCount > 1 && (
        <div className="mb-4 flex items-center gap-3">
          <button
            type="button"
            onClick={goPrev}
            disabled={currentIndex === 0}
            aria-label="Previous section"
            data-testid="present-prev"
            className="rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] px-3 py-1 text-sm font-medium disabled:opacity-40"
          >
            ←
          </button>
          <span className="text-sm text-[var(--color-muted-foreground)]" data-testid="present-counter">
            {currentIndex + 1} / {sectionCount}
          </span>
          <button
            type="button"
            onClick={goNext}
            disabled={currentIndex === sectionCount - 1}
            aria-label="Next section"
            data-testid="present-next"
            className="rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] px-3 py-1 text-sm font-medium disabled:opacity-40"
          >
            →
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label="Toggle fullscreen"
            data-testid="present-fullscreen"
            className="ml-auto rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] px-3 py-1 text-sm font-medium"
          >
            {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          </button>
        </div>
      )}
      <WeeklyReportPage reportId={reportId} />
    </div>
  );
}
