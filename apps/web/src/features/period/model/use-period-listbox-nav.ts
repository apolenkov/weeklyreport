import {
  type Dispatch,
  type KeyboardEvent as ReactKeyboardEvent,
  type SetStateAction,
  type TouchEvent as ReactTouchEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { useDialogFocus } from "../../../lib/use-dialog-focus";
import { useDismissOnOutsidePointer } from "../../../lib/use-dismiss-on-outside-pointer";
import {
  ANCHORED_PANEL_GAP_PX,
  useAnchoredPanelPosition,
} from "./use-anchored-panel-position";

const SWIPE_THRESHOLD_PX = 50;

// Left-anchored and width-matched so the panel lines up under the trigger.
const leftAnchoredPosition = (rect: DOMRect) => ({
  top: rect.bottom + ANCHORED_PANEL_GAP_PX,
  left: rect.left,
  width: rect.width,
});

interface PeriodListboxNavArgs {
  readonly instanceId: string;
  readonly currentIndex: number;
  readonly periodOptionIds: readonly string[];
  readonly selectedPeriodId: string | undefined;
  readonly navigateTo: (periodId: string) => void;
  readonly onPrev: () => void;
  readonly onNext: () => void;
}

// Open/highlight state plus the two ways a period gets chosen. `openListbox`
// stays out of the public surface — only the keyboard handlers need it.
function useListboxSelection({
  currentIndex,
  selectedPeriodId,
  navigateTo,
}: Pick<
  PeriodListboxNavArgs,
  "currentIndex" | "selectedPeriodId" | "navigateTo"
>) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(currentIndex);

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

  // Opening anchors the highlight on the currently selected option — done in
  // the open EVENT (openListbox/toggleOpen own every open transition), not in
  // a state-sync effect.
  const openListbox = useCallback(() => {
    setActiveIdx(currentIndex);
    setOpen(true);
  }, [currentIndex]);

  const toggleOpen = useCallback(() => {
    if (open) {
      setOpen(false);
      return;
    }
    openListbox();
  }, [open, openListbox]);

  return {
    selection: {
      open,
      setOpen,
      activeIdx,
      setActiveIdx,
      toggleOpen,
      selectOption,
    },
    openListbox,
  };
}

// Scroll active option into view; block: "nearest" avoids hover-driven panel jerks.
function useActiveOptionScroll(
  open: boolean,
  activeIdx: number,
  optionIdPrefix: string,
): void {
  useEffect(() => {
    if (!open) return;
    document
      .getElementById(`${optionIdPrefix}${activeIdx}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, activeIdx, optionIdPrefix]);
}

interface ListboxKeyHandlerArgs {
  readonly open: boolean;
  readonly activeIdx: number;
  readonly setActiveIdx: Dispatch<SetStateAction<number>>;
  readonly periodOptionIds: readonly string[];
  readonly selectOption: (periodId: string) => void;
  readonly openListbox: () => void;
}

function createListboxKeyHandlers({
  open,
  activeIdx,
  setActiveIdx,
  periodOptionIds,
  selectOption,
  openListbox,
}: ListboxKeyHandlerArgs) {
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
      openListbox();
    }
  }

  return { handleTriggerKeyDown, handleListKeyDown };
}

// Swipe gesture. Left = next week, right = previous week.
function useSwipeNavigation(onPrev: () => void, onNext: () => void) {
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

  return { handleTouchStart, handleTouchEnd };
}

// PeriodNavigator listbox + swipe: trigger + portaled panel (native <option>
// can't host badges). Focus stays on the trigger; highlight via aria-activedescendant.
/**
 * Use Period Listbox Nav.
 * @param props - The props argument.
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

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { selection, openListbox } = useListboxSelection({
    currentIndex,
    selectedPeriodId,
    navigateTo,
  });
  const { open, setOpen } = selection;
  const panelPos = useAnchoredPanelPosition(
    open,
    triggerRef,
    leftAnchoredPosition,
  );

  // containerRef = trigger (not panel): Escape/restore only; no focus into the list.
  useDialogFocus({
    open,
    onClose: () => setOpen(false),
    containerRef: triggerRef,
    triggerRef,
  });

  // The panel is portalled, so a press inside either the trigger or the panel
  // keeps the listbox open.
  useDismissOnOutsidePointer({
    open,
    refs: [triggerRef, panelRef],
    onDismiss: () => setOpen(false),
  });
  useActiveOptionScroll(open, selection.activeIdx, optionIdPrefix);

  const keyHandlers = createListboxKeyHandlers({
    open,
    activeIdx: selection.activeIdx,
    setActiveIdx: selection.setActiveIdx,
    periodOptionIds,
    selectOption: selection.selectOption,
    openListbox,
  });
  const swipeHandlers = useSwipeNavigation(onPrev, onNext);

  return {
    listboxId,
    optionIdPrefix,
    triggerRef,
    panelRef,
    panelPos,
    ...selection,
    ...keyHandlers,
    ...swipeHandlers,
  };
}
