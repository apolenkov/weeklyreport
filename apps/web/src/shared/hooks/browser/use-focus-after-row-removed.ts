import { useEffect, useRef } from "react";

// A row (or form) that held focus leaves the DOM and takes the focused button
// with it. Land on the stable container, or on the page when the container is
// gone too. Acts only when focus was inside the container before the removal
// and is now lost, so a refetch that drops a foreign row never pulls focus to
// the container for a user who is elsewhere on the page.
export function useFocusAfterRowRemoved<T extends HTMLElement>(
  rowCount: number,
) {
  const containerRef = useRef<T>(null);
  const previousCount = useRef(rowCount);
  const focusWasInside = useRef(false);
  useEffect(() => {
    // A click on empty page space blurs to body without a focusin, so the
    // pointer also says where the user is; the removal itself fires neither.
    const track = (event: Event) => {
      focusWasInside.current =
        event.target instanceof Node &&
        containerRef.current?.contains(event.target) === true;
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
    const focusLost = !active || active === document.body;
    if (
      rowCount < previousCount.current &&
      focusLost &&
      focusWasInside.current
    ) {
      (
        containerRef.current ?? document.getElementById("main-content")
      )?.focus();
    }
    previousCount.current = rowCount;
  }, [rowCount]);
  return containerRef;
}
