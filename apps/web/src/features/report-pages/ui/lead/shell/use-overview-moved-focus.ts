import { useEffect, useState } from "react";

const MOVED_TARGET_KEY = "more:next:";

function isVisibleControl(element: HTMLElement): boolean {
  return (
    !(element as HTMLButtonElement).disabled &&
    !element.closest("[hidden], [inert]") &&
    getComputedStyle(element).visibility !== "hidden"
  );
}

function findMovedControl(identity: string): HTMLElement | null {
  const controls = [
    ...document.querySelectorAll<HTMLElement>("[data-overview-focus]"),
  ].filter(isVisibleControl);
  return (
    controls.find(
      (control) =>
        control.dataset.overviewFocus === `${MOVED_TARGET_KEY}${identity}`,
    ) ??
    controls.find((control) =>
      control.dataset.overviewFocus?.endsWith(`:${identity}`),
    ) ??
    null
  );
}

// A direct move removes the item from its source lane, so the control that
// opened the menu leaves the tree. After the move renders, focus goes to the
// moved item's own control in the Next lane, or to the Overview heading. Each
// request is a fresh object, so the effect re-runs per move without a reset.
export function useOverviewMovedFocus(): (identity: string | null) => void {
  const [request, setRequest] = useState<{
    readonly identity: string | null;
  } | null>(null);
  useEffect(() => {
    if (request === null) return;
    const destination =
      (request.identity === null ? null : findMovedControl(request.identity)) ??
      document.querySelector<HTMLElement>("[data-overview-focus-heading]");
    destination?.focus();
  }, [request]);
  return (identity) => setRequest({ identity });
}
