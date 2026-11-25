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

// The item a plain create save just confirmed. Its controls are keyed
// `<action>:<week>:<stableId>`, so the week suffix excludes Previous copies.
export interface OverviewCreatedFocus {
  readonly identity: string;
  readonly week: "current" | "next";
}

function findCreatedControl(
  buttons: readonly HTMLButtonElement[],
  created: OverviewCreatedFocus,
) {
  const suffix = `:${created.week}:${created.identity}`;
  return buttons.find((element) =>
    element.dataset.overviewFocus?.endsWith(suffix),
  );
}

export function useOverviewFocusReturn(
  open: boolean,
  createdFocusRef?: { current: OverviewCreatedFocus | null },
  keepOutsideFocusRef?: { current: boolean },
): (explicitOriginKey?: string) => void {
  const originKey = useRef<string | null>(null);
  const fallbackKey = useRef<string | null>(null);
  const previouslyOpen = useRef(false);
  useEffect(() => {
    const closing = previouslyOpen.current && !open;
    previouslyOpen.current = open;
    if (!closing) return;
    if (keepOutsideFocusRef?.current) {
      keepOutsideFocusRef.current = false;
      return;
    }
    const key = originKey.current;
    const identity = key?.slice(key.lastIndexOf(":") + 1);
    const fallback = fallbackKey.current;
    const createdTarget = createdFocusRef?.current ?? null;
    originKey.current = null;
    if (createdFocusRef) createdFocusRef.current = null;
    const buttons = [
      ...document.querySelectorAll<HTMLButtonElement>("[data-overview-focus]"),
    ].filter(isVisibleAction);
    const createdControl =
      createdTarget === null
        ? undefined
        : findCreatedControl(buttons, createdTarget);
    // After a create save the opener key ends in a week, not an item identity,
    // so the lineage match would pick another unit's Add: exact opener only.
    const lineageIdentity = createdTarget === null ? identity : undefined;
    const origin =
      findFocusTarget(buttons, key) ??
      findFocusTarget(buttons, fallback) ??
      (lineageIdentity === undefined
        ? undefined
        : buttons.find((button) =>
            button.dataset.overviewFocus?.endsWith(`:${lineageIdentity}`),
          ));
    fallbackKey.current = null;
    if (createdControl) {
      createdControl.focus({ preventScroll: true });
      (
        createdControl.closest<HTMLElement>("[data-overview-item-preview]") ??
        createdControl
      ).scrollIntoView({ block: "nearest" });
      return;
    }
    const destination =
      origin ??
      document.querySelector<HTMLElement>("[data-overview-focus-heading]");
    destination?.focus();
  }, [open, createdFocusRef, keepOutsideFocusRef]);

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
