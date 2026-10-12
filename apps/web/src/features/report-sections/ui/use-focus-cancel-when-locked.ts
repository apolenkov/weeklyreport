"use client";

import { useEffect, useRef } from "react";

// A save that locks the focused control makes the browser drop focus to the page,
// where the form's Escape handler no longer hears keys; Cancel stays enabled, so
// focus moves there and Escape keeps asking to discard. Acts only when focus was
// inside the editor before the lock, so a re-lock after the user moved on never
// pulls focus back. A click on empty page space blurs to body without a focusin,
// so the pointer also says where the user is.
export function useFocusCancelWhenLocked(locked: boolean) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const wasLocked = useRef(locked);
  const focusWasInside = useRef(false);
  useEffect(() => {
    const track = (event: Event) => {
      focusWasInside.current =
        event.target instanceof Node &&
        cancelRef.current?.closest("form")?.contains(event.target) === true;
    };
    document.addEventListener("focusin", track);
    document.addEventListener("pointerdown", track);
    return () => {
      document.removeEventListener("focusin", track);
      document.removeEventListener("pointerdown", track);
    };
  }, []);
  useEffect(() => {
    const active = document.activeElement;
    if (
      locked &&
      !wasLocked.current &&
      focusWasInside.current &&
      (active === document.body || active?.matches(":disabled") === true)
    ) {
      cancelRef.current?.focus();
    }
    wasLocked.current = locked;
  }, [locked]);
  return cancelRef;
}
