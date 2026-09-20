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

function insideClosedDisclosure(element: HTMLElement): boolean {
  const parent = element.parentElement;
  if (parent === null) return false;
  if (
    parent.tagName === "DETAILS" &&
    element.tagName !== "SUMMARY" &&
    !(parent as HTMLDetailsElement).open
  )
    return true;
  return insideClosedDisclosure(parent);
}

function isVisibleAction(button: HTMLButtonElement): boolean {
  return (
    !button.disabled &&
    !button.closest("[hidden], [inert]") &&
    !insideClosedDisclosure(button) &&
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

export function useOverviewFocusReturn(
  open: boolean,
): (explicitOriginKey?: string) => void {
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

  return (explicitOriginKey?: string) => {
    const origin = document.activeElement;
    originKey.current =
      explicitOriginKey ??
      (origin instanceof HTMLElement
        ? (origin.dataset.overviewFocus ?? null)
        : null);
    fallbackKey.current =
      explicitOriginKey === undefined && origin instanceof HTMLElement
        ? (origin.dataset.overviewFocusFallback ?? null)
        : null;
  };
}
