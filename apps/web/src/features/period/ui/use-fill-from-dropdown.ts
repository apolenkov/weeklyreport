"use client";

import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

const DROPDOWN_OFFSET_PX = 4;

// Position the dropdown via portal to escape the toolbar's overflow clip; the
// trigger moves with scroll/resize, so the position is re-read on both.
function useDropdownPosition(
  open: boolean,
  triggerRef: RefObject<HTMLButtonElement | null>,
) {
  const [dropdownPos, setDropdownPos] = useState<{
    top: number;
    right: number;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      setDropdownPos({
        top: r.bottom + DROPDOWN_OFFSET_PX,
        right: window.innerWidth - r.right,
      });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, triggerRef]);

  return dropdownPos;
}

// The panel is portalled out of the trigger's subtree, so a press only counts
// as outside when it misses BOTH the trigger wrapper and the panel.
function useCloseOnOutsidePress(
  open: boolean,
  close: () => void,
  wrapRef: RefObject<HTMLDivElement | null>,
  panelRef: RefObject<HTMLDivElement | null>,
) {
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      const wrapContains = wrapRef.current?.contains(target);
      const panelContains = panelRef.current?.contains(target);
      if (!wrapContains && !panelContains) {
        close();
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, close, wrapRef, panelRef]);
}

function useCloseOnEscape(open: boolean, close: () => void) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    if (open) document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, close]);
}

export function useFillFromDropdown() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pos = useDropdownPosition(open, triggerRef);

  // Every close path clears the leftover query too, so reopening always starts
  // unfiltered rather than pre-filtered by whatever was typed before.
  const close = useCallback(() => {
    setOpen(false);
    setSearch("");
  }, []);

  useCloseOnOutsidePress(open, close, wrapRef, panelRef);
  useCloseOnEscape(open, close);

  return {
    open,
    search,
    setSearch,
    pos,
    wrapRef,
    triggerRef,
    panelRef,
    close,
    toggle: () => (open ? close() : setOpen(true)),
  };
}
