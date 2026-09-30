import { useEffect, useRef } from "react";

// A decided request leaves the queue together with the button that was focused.
// Land on the queue region, or on the page when that was the last request.
export function useFocusQueueAfterDecision(
  requests: readonly { readonly id: string }[],
) {
  const queueRef = useRef<HTMLElement>(null);
  const decidedIdRef = useRef<string | null>(null);

  useEffect(() => {
    const decidedId = decidedIdRef.current;
    if (decidedId === null || requests.some((r) => r.id === decidedId)) return;
    decidedIdRef.current = null;
    (queueRef.current ?? document.getElementById("main-content"))?.focus();
  }, [requests]);

  return {
    queueRef,
    markDecided: (id: string) => {
      decidedIdRef.current = id;
    },
  };
}
