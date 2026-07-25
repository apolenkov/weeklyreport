import * as React from "react";

const MOBILE_BREAKPOINT = 768;

function subscribeToViewport(onStoreChange: () => void): () => void {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
  mql.addEventListener("change", onStoreChange);
  return () => mql.removeEventListener("change", onStoreChange);
}

/** True when viewport is below the mobile breakpoint; false during SSR. */
export function useIsMobile() {
  // External viewport state read via useSyncExternalStore: correct on the
  // first client render (no undefined->value flash) and false during SSR.
  return React.useSyncExternalStore(
    subscribeToViewport,
    () => window.innerWidth < MOBILE_BREAKPOINT,
    () => false,
  );
}
