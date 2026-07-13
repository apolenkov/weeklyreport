import {
  type KeyboardEvent as ReactKeyboardEvent,
  type TouchEvent as ReactTouchEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { useDialogFocus } from "../../../lib/use-dialog-focus";

const SWIPE_THRESHOLD_PX = 50;
// Gap between the trigger and the portaled listbox panel.
const PERIOD_PANEL_GAP_PX = 4;

interface PeriodListboxNavArgs {
  readonly instanceId: string;
  readonly currentIndex: number;
  readonly periodOptionIds: readonly string[];
  readonly selectedPeriodId: string | undefined;
  readonly navigateTo: (periodId: string) => void;
  readonly onPrev: () => void;
  readonly onNext: () => void;
}

/**
 * Custom listbox + swipe-gesture behaviour for PeriodNavigator, kept out of
 * the component so it focuses on rendering. Native <option> cannot render
 * badge markup, so the select is replaced by a trigger + portaled listbox:
 * focus stays on the trigger and the highlighted option is tracked via
 * aria-activedescendant (roving without DOM focus).
 */
export function usePeriodListboxNav({
  instanceId,
  currentIndex,
  periodOptionIds,
  selectedPeriodId,
  navigateTo,
  onPrev,
  onNext,
}: PeriodListboxNavArgs) {
  // Per-instance scoped listbox/option ids so two navigators on one page
  // never collide on the DOM ids that aria-controls / aria-activedescendant
  // reference.
  const listboxId = `period-listbox-${instanceId}`;
  const optionIdPrefix = `period-option-${instanceId}-`;

  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(currentIndex);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelPos, setPanelPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  // Combobox pattern: focus stays on the trigger and the active option is
  // tracked via aria-activedescendant, so only the primitive's Escape-to-close
  // and focus-restore-to-trigger apply — containerRef points at the trigger
  // (never the panel) so focus is never pulled into the option list, and the
  // panel has no focusable descendants for the Tab-trap to act on.
  useDialogFocus({
    open,
    onClose: () => setOpen(false),
    containerRef: triggerRef,
    triggerRef,
  });

  const selectOption = useCallback(
    (periodId: string) => {
      // Re-selecting the current period is a no-op (matches native <select>
      // semantics). This also keeps a single-option fallback navigator inert
      // so a head urlBuilder never jumps a viewer/lead surface to /head/report.
      if (periodId !== selectedPeriodId) navigateTo(periodId);
      setOpen(false);
    },
    [navigateTo, selectedPeriodId],
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

  // Keep the active option visible: scroll it into view whenever the highlight
  // moves (Arrow/Home/End), so keyboard navigation never runs off the panel's
  // visible edge. block: "nearest" no-ops when the option is already visible,
  // so hover-driven activeIdx changes don't jerk the panel.
  useEffect(() => {
    if (!open) return;
    document
      .getElementById(`${optionIdPrefix}${activeIdx}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, activeIdx, optionIdPrefix]);

  function handleListKeyDown(
    e: ReactKeyboardEvent<HTMLButtonElement | HTMLDivElement>,
  ) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, periodOptionIds.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveIdx(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveIdx(periodOptionIds.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const id = periodOptionIds.at(activeIdx);
      if (id) selectOption(id);
    }
  }

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

  // Swipe gesture. Left = next week, right = previous week.
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
    if (deltaX < 0) onNext();
    else onPrev();
  }

  return {
    listboxId,
    optionIdPrefix,
    open,
    setOpen,
    activeIdx,
    setActiveIdx,
    triggerRef,
    panelRef,
    panelPos,
    selectOption,
    handleTriggerKeyDown,
    handleListKeyDown,
    handleTouchStart,
    handleTouchEnd,
  };
}
