import { type RefObject, useEffect, useMemo } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function focusableWithin(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)];
}

function trapTab(event: KeyboardEvent, container: HTMLElement): void {
  const focusable = focusableWithin(container);
  const first = focusable.at(0);
  const last = focusable.at(-1);
  if (first === undefined || last === undefined) return;
  const active = document.activeElement;

  const focusMovedToFirst =
    (!event.shiftKey && active === last) ||
    (active !== null && !container.contains(active));
  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (focusMovedToFirst) {
    // Wrap forward from the last element, or pull focus back in after a
    // content swap dropped it to the body — both land on the first element.
    event.preventDefault();
    first.focus();
  }
}

interface DialogFocusOptions {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly containerRef: RefObject<HTMLElement | null>;
  readonly triggerRef?: RefObject<HTMLElement | null> | undefined;
}

const getActiveElement = (): HTMLElement | null =>
  typeof document === "undefined"
    ? null
    : (document.activeElement as HTMLElement | null);

const activeElementForDialog = (open: boolean): HTMLElement | null =>
  open ? getActiveElement() : null;

function resolveRestoreTarget(
  container: HTMLElement | null,
  activeElement: HTMLElement | null,
  opener: HTMLElement | null,
  trigger: HTMLElement | null,
): HTMLElement | null {
  if (trigger) return trigger;
  if (!container?.contains(activeElement)) return activeElement;
  return container.contains(opener) ? null : opener;
}

function focusDialogSurface(
  container: HTMLElement | null,
  activeElement: HTMLElement | null,
): void {
  if (!container || container.contains(activeElement)) return;
  (focusableWithin(container)[0] ?? container).focus();
}

// Shared non-Radix modal focus: trap Tab, Escape-close, restore to opener.
export function useDialogFocus({
  open,
  onClose,
  containerRef,
  triggerRef,
}: DialogFocusOptions): void {
  const opener = useMemo(() => activeElementForDialog(open), [open]);

  useEffect(() => {
    if (!open) return;
    const container = containerRef.current;
    const activeElement = getActiveElement();
    const restoreTarget = resolveRestoreTarget(
      container,
      activeElement,
      opener,
      triggerRef?.current ?? null,
    );
    focusDialogSurface(container, activeElement);

    return () => {
      restoreTarget?.focus();
    };
  }, [open, containerRef, triggerRef, opener]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      const container = containerRef.current;
      if (event.key === "Tab" && container) {
        trapTab(event, container);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose, containerRef]);
}
