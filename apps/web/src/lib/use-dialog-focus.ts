import { type RefObject, useEffect, useState } from "react";

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

  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

interface DialogFocusOptions {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly containerRef: RefObject<HTMLElement | null>;
  /**
   * Optional caller-managed trigger for always-mounted dialogs whose
   * first-render opener capture is stale. Remount-on-open dialogs need none.
   */
  readonly triggerRef?: RefObject<HTMLElement | null>;
}

// Shared non-Radix modal focus: trap Tab, Escape-close, restore to opener.
/**
 * Use Dialog Focus.
 * @param props - The props argument.
 */
export function useDialogFocus({
  open,
  onClose,
  containerRef,
  triggerRef,
}: DialogFocusOptions): void {
  // Capture opener on first render before autoFocus moves focus inside on commit.
  // These dialogs mount on open, so first render === open and activeElement is the trigger.
  const [capturedOpener] = useState<HTMLElement | null>(
    () => document.activeElement as HTMLElement | null,
  );

  useEffect(() => {
    if (!open) return;
    const container = containerRef.current;
    const focusIsInside = container?.contains(document.activeElement) ?? false;

    // triggerRef wins. When autoFocus already sits inside the container, the
    // captured opener is the only remaining outside anchor.
    const openerOutside =
      capturedOpener && container && !container.contains(capturedOpener)
        ? capturedOpener
        : null;
    const restoreTarget: HTMLElement | null =
      triggerRef?.current ??
      (focusIsInside
        ? openerOutside
        : (document.activeElement as HTMLElement | null));

    // Respect an inner autoFocus: only pull focus in when nothing inside holds it yet.
    if (container && !focusIsInside) {
      (focusableWithin(container)[0] ?? container).focus();
    }

    return () => {
      restoreTarget?.focus();
    };
  }, [open, containerRef, triggerRef, capturedOpener]);

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
