"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type TouchEvent as ReactTouchEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { ReportPeriod } from "./mock-data";
import {
  ArchivedBadge,
  PERIOD_LISTBOX_ID,
  PERIOD_OPTION_ID_PREFIX,
  periodLabel,
  PeriodListboxPanel,
} from "./period-listbox-panel";

const SWIPE_THRESHOLD_PX = 50;
// 35-07: lead-form addressable URL base. Period nav now emits path-segment
// URLs (`/lead/report/<reportId>`) so each week is bookmarkable.
const LEAD_REPORT_BASE = "/lead/report";
const PERIOD_SELECT_WIDTH_CH = 24;
// Gap between the trigger and the portaled listbox panel (D3).
const PERIOD_PANEL_GAP_PX = 4;

interface PeriodNavigatorProps {
  readonly periods: ReportPeriod[];
  /**
   * Optional URL builder for navigation. When provided, replaces the default
   * lead-specific `/lead/report/<periodId>` path construction so the navigator
   * can be reused by other roles via a custom addressed-path scheme.
   * Receives the target periodId; must return the full href to push.
   */
  readonly urlBuilder?: (periodId: string) => string;
}

function ChevronLeft() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

export const PERIOD_NAV_ARROW_BUTTON_CLASS =
  "inline-flex min-h-8 items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-white px-3 py-1.5 text-[var(--color-foreground)] transition-colors hover:border-[var(--color-starbucks-accent)] hover:text-[var(--color-starbucks-accent)] focus-visible:shadow-[0_0_0_3px_rgba(0,98,65,0.3)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-35";

export function PeriodNavigator({ periods, urlBuilder }: PeriodNavigatorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 35-07: the dropdown reflects the path-segment reportId when the page is
  // rendered under `/lead/report/[reportId]`. driver-findings-2026-06-11
  // finding 4: this navigator is also rendered on `/head/report/[reportId]`
  // (via HeadReportShell with a urlBuilder), so the regex must match the head
  // base too — otherwise currentIndex defaults to 0 and the trigger shows the
  // latest published period instead of the addressed week.
  const pathReportId = useMemo(() => {
    if (!pathname) return null;
    const match = /^\/(?:lead|head)\/report\/([^/]+)$/.exec(pathname);
    return match ? match[1] : null;
  }, [pathname]);

  const currentIndex = useMemo(() => {
    if (!pathReportId) return 0; // default to first (current) period
    const idx = periods.findIndex((p) => p.id === pathReportId);
    return idx !== -1 ? idx : 0;
  }, [pathReportId, periods]);

  const selectedPeriod = periods.at(currentIndex);
  const hasPrev = currentIndex < periods.length - 1;
  const hasNext = currentIndex > 0;
  // D3: options expose structured fields (not a flattened label string) so
  // archived/current markers render as badges inside the custom listbox.
  const periodOptions = useMemo(
    () =>
      periods.map((p) => ({
        id: p.id,
        dateRange: p.dateRange,
        isCurrent: p.isCurrent,
        archived: p.archived ?? false,
      })),
    [periods],
  );

  const navigateTo = useCallback(
    (periodId: string) => {
      if (urlBuilder) {
        router.push(urlBuilder(periodId));
        return;
      }
      // Default: lead path-segment URLs — bookmarkable, back-button-friendly.
      const next = new URLSearchParams(searchParams.toString());
      const query = next.toString();
      const suffix = query ? `?${query}` : "";
      router.push(`${LEAD_REPORT_BASE}/${periodId}${suffix}`);
    },
    [router, searchParams, urlBuilder],
  );

  function handlePrev() {
    const prev = periods.at(currentIndex + 1);
    if (hasPrev && prev) navigateTo(prev.id);
  }

  function handleNext() {
    const next = periods.at(currentIndex - 1);
    if (hasNext && next) navigateTo(next.id);
  }

  // ---- Custom listbox (D3) ----
  // Native <option> cannot render badge markup, so the select is replaced by a
  // trigger + portaled listbox. Focus stays on the trigger; the highlighted
  // option is tracked via aria-activedescendant (roving without DOM focus).
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(currentIndex);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelPos, setPanelPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const closeAndRefocus = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  const selectOption = useCallback(
    (periodId: string) => {
      navigateTo(periodId);
      closeAndRefocus();
    },
    [navigateTo, closeAndRefocus],
  );

  // Position the panel via portal to escape the toolbar's overflow clip.
  useEffect(() => {
    if (!open) return;
    const update = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      setPanelPos({
        top: r.bottom + PERIOD_PANEL_GAP_PX,
        left: r.left,
        width: r.width,
      });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  // Dual-ref outside click: trigger or panel keeps the listbox open.
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      const triggerContains = triggerRef.current?.contains(target);
      const panelContains = panelRef.current?.contains(target);
      if (!triggerContains && !panelContains) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // When opening, anchor the highlight on the currently selected option.
  useEffect(() => {
    if (open) setActiveIdx(currentIndex);
  }, [open, currentIndex]);

  function handleTriggerKeyDown(e: ReactKeyboardEvent<HTMLButtonElement>) {
    if (open) {
      handleListKeyDown(e);
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter") {
      e.preventDefault();
      setOpen(true);
    }
  }

  function handleListKeyDown(
    e: ReactKeyboardEvent<HTMLButtonElement | HTMLDivElement>,
  ) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeAndRefocus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, periodOptions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveIdx(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveIdx(periodOptions.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const opt = periodOptions.at(activeIdx);
      if (opt) selectOption(opt.id);
    }
  }

  // Phase 33-04: swipe gesture mirrors HeadPeriodNavigator. Left = next week,
  // right = previous week.
  const touchStartXRef = useRef<number | null>(null);
  function handleTouchStart(e: ReactTouchEvent<HTMLDivElement>) {
    const t = Array.from(e.touches).at(0);
    touchStartXRef.current = t ? t.clientX : null;
  }
  function handleTouchEnd(e: ReactTouchEvent<HTMLDivElement>) {
    const start = touchStartXRef.current;
    touchStartXRef.current = null;
    if (start === null) return;
    const t = Array.from(e.changedTouches).at(0);
    if (!t) return;
    const deltaX = t.clientX - start;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX) return;
    if (deltaX < 0) handleNext();
    else handlePrev();
  }

  return (
    <div
      className="flex min-w-0 items-center gap-3 px-3 py-2"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      role="group"
      aria-label="Period navigation (swipe left/right or use arrows)"
    >
      <button
        type="button"
        className={PERIOD_NAV_ARROW_BUTTON_CLASS}
        onClick={handlePrev}
        disabled={!hasPrev}
        title="Previous period"
        aria-label="Previous period"
      >
        <ChevronLeft />
        <span className="text-xs font-medium xl:hidden">Previous</span>
      </button>

      <div
        className="relative max-w-full flex-none"
        style={{ width: `${PERIOD_SELECT_WIDTH_CH}ch` }}
      >
        <button
          ref={triggerRef}
          type="button"
          role="combobox"
          aria-label="Select reporting period"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={PERIOD_LISTBOX_ID}
          aria-activedescendant={
            open ? `${PERIOD_OPTION_ID_PREFIX}${activeIdx}` : undefined
          }
          className="flex min-h-8 w-full cursor-pointer items-center gap-1.5 truncate rounded-[var(--radius)] border border-[var(--color-border)] bg-white px-2 pr-7 text-left text-[13px] font-semibold text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[rgba(0,117,74,0.16)]"
          onClick={() => setOpen((o) => !o)}
          onKeyDown={handleTriggerKeyDown}
        >
          <span className="truncate">
            {selectedPeriod ? periodLabel(selectedPeriod) : ""}
          </span>
          {selectedPeriod?.archived && <ArchivedBadge />}
        </button>
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-muted-foreground)]">
          <ChevronRight />
        </span>
      </div>

      <button
        type="button"
        className={PERIOD_NAV_ARROW_BUTTON_CLASS}
        onClick={handleNext}
        disabled={!hasNext}
        title={hasNext ? "Next period" : "Latest period"}
        aria-label="Next period"
      >
        <span className="text-xs font-medium xl:hidden">Next</span>
        <ChevronRight />
      </button>

      {open && panelPos && typeof document !== "undefined" && (
        <PeriodListboxPanel
          options={periodOptions}
          selectedId={selectedPeriod?.id}
          activeIdx={activeIdx}
          pos={panelPos}
          panelRef={panelRef}
          onHover={setActiveIdx}
          onSelect={selectOption}
          onKeyDown={handleListKeyDown}
        />
      )}
    </div>
  );
}
