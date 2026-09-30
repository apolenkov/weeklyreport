import { useEffect, useRef } from "react";

// A row (or form) that held focus leaves the DOM and takes the focused button
// with it. Land on the stable container, or on the page when the container is
// gone too. Only acts when focus was actually lost, so a refetch that drops a
// foreign row never pulls focus away from a control the user is still using.
export function useFocusAfterRowRemoved<T extends HTMLElement>(
  rowCount: number,
) {
  const containerRef = useRef<T>(null);
  const previousCount = useRef(rowCount);
  useEffect(() => {
    const active = document.activeElement;
    const focusLost = !active || active === document.body;
    if (rowCount < previousCount.current && focusLost) {
      (
        containerRef.current ?? document.getElementById("main-content")
      )?.focus();
    }
    previousCount.current = rowCount;
  }, [rowCount]);
  return containerRef;
}
