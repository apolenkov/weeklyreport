import { useEffect, useRef } from "react";

function hasVisibleAncestors(element: HTMLElement): boolean {
  const style = getComputedStyle(element);
  if (
    style.display === "none" ||
    style.visibility === "hidden" ||
    style.visibility === "collapse"
  )
    return false;
  const parent = element.parentElement;
  return parent === null || hasVisibleAncestors(parent);
}

function isVisibleAction(button: HTMLButtonElement): boolean {
  return (
    !button.disabled &&
    !button.closest("[hidden], [inert]") &&
    hasVisibleAncestors(button)
  );
}

function findFocusTarget(
  buttons: readonly HTMLButtonElement[],
  key: string | null,
) {
  if (key === null) return undefined;
  return buttons.find((element) => element.dataset.overviewFocus === key);
}

export function useOverviewFocusReturn(open: boolean): () => void {
  const originKey = useRef<string | null>(null);
  const fallbackKey = useRef<string | null>(null);
  const previouslyOpen = useRef(false);
  useEffect(() => {
    const closing = previouslyOpen.current && !open;
    previouslyOpen.current = open;
    if (!closing) return;
    const key = originKey.current;
    const identity = key?.slice(key.lastIndexOf(":") + 1);
    const fallback = fallbackKey.current;
    originKey.current = null;
    const buttons = [
      ...document.querySelectorAll<HTMLButtonElement>("[data-overview-focus]"),
    ].filter(isVisibleAction);
    const origin =
      findFocusTarget(buttons, key) ??
      findFocusTarget(buttons, fallback) ??
      (identity === undefined
        ? undefined
        : buttons.find((button) =>
            button.dataset.overviewFocus?.endsWith(`:${identity}`),
          ));
    fallbackKey.current = null;
    const destination =
      origin ??
      document.querySelector<HTMLElement>("[data-overview-focus-heading]");
    destination?.focus({ preventScroll: true });
  }, [open]);

  return () => {
    const origin = document.activeElement;
    originKey.current =
      origin instanceof HTMLElement
        ? (origin.dataset.overviewFocus ?? null)
        : null;
    fallbackKey.current =
      origin instanceof HTMLElement
        ? (origin.dataset.overviewFocusFallback ?? null)
        : null;
  };
}
