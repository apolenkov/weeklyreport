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
  if (focusable.length === 0) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
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
  /** Whether the dialog is currently mounted/visible. */
  readonly open: boolean;
  /** Called on Escape (and, for the caller's own close paths). */
  readonly onClose: () => void;
  /** The dialog surface whose focus is trapped. */
  readonly containerRef: RefObject<HTMLElement | null>;
  /**
   * Optional caller-managed trigger element to restore focus to on close.
   * Rarely needed: the hook self-captures the opener at first render (before an
   * inner `autoFocus` fires). Pass this only for an always-mounted dialog — one
   * that does not remount on open — where the render-time capture is stale.
   */
  readonly triggerRef?: RefObject<HTMLElement | null>;
}

/**
 * Shared modal focus management for every non-Radix dialog: while `open`, it
 * captures the trigger element, moves focus inside (unless the surface already
 * owns focus via an inner `autoFocus`), traps Tab within the surface, closes on
 * Escape, and restores focus to the trigger when the dialog closes or unmounts.
 * The opener is captured at first render, so restore works even for a surface
 * that `autoFocus`es a field. One implementation so no dialog silently ships a
 * half-built focus trap.
 */
export function useDialogFocus({
  open,
  onClose,
  containerRef,
  triggerRef,
}: DialogFocusOptions): void {
  // Capture the opener during the FIRST render — before an inner `autoFocus`
  // moves focus inside on commit — so an auto-focusing dialog still restores
  // focus to its trigger. These dialogs mount on open (content is null until
  // then), so first render === open and document.activeElement is the trigger.
  const [capturedOpener] = useState<HTMLElement | null>(
    () => document.activeElement as HTMLElement | null,
  );

  useEffect(() => {
    if (!open) return;
    const container = containerRef.current;
    const focusIsInside = container?.contains(document.activeElement) ?? false;

    // Element to restore focus to on close. A caller-managed triggerRef wins.
    // When focus already moved inside (an inner autoFocus fired before this
    // effect), the effect can no longer read the trigger, so fall back to the
    // opener captured at render — but only if it is outside the surface.
    // Otherwise capture the current, still-outside trigger.
    const openerOutside =
      capturedOpener && container && !container.contains(capturedOpener)
        ? capturedOpener
        : null;
    const restoreTarget: HTMLElement | null =
      triggerRef?.current ??
      (focusIsInside
        ? openerOutside
        : (document.activeElement as HTMLElement | null));

    // Respect an inner `autoFocus`: only pull focus in when nothing inside the
    // surface holds it yet, so a field-level autofocus is never overridden.
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
