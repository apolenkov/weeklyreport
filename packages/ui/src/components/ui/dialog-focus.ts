"use client";

import { Dialog as DialogPrimitive } from "radix-ui";
import * as React from "react";

type DialogContentProps = React.ComponentProps<typeof DialogPrimitive.Content>;
type DialogAutoFocusEvent = Parameters<
  NonNullable<DialogContentProps["onOpenAutoFocus"]>
>[0];

interface DialogFocusOptions {
  readonly initialFocusRef?: React.RefObject<HTMLElement | null> | undefined;
  readonly restoreFocusRef?: React.RefObject<HTMLElement | null> | undefined;
  readonly restoreFocusToPrevious: boolean;
  readonly onOpenAutoFocus?:
    ((event: DialogAutoFocusEvent) => void) | undefined;
  readonly onCloseAutoFocus?:
    ((event: DialogAutoFocusEvent) => void) | undefined;
}

const focusedElement = (): HTMLElement | null =>
  document.activeElement instanceof HTMLElement ? document.activeElement : null;

/** Composes caller focus handlers with dialog initial and restore targets. */
export function useDialogFocus({
  initialFocusRef,
  restoreFocusRef,
  restoreFocusToPrevious,
  onOpenAutoFocus,
  onCloseAutoFocus,
}: DialogFocusOptions) {
  const previousFocusRef = React.useRef<HTMLElement | null>(null);

  function handleOpenAutoFocus(event: DialogAutoFocusEvent) {
    previousFocusRef.current = restoreFocusToPrevious ? focusedElement() : null;
    onOpenAutoFocus?.(event);
    if (event.defaultPrevented || !initialFocusRef?.current) return;
    event.preventDefault();
    initialFocusRef.current.focus();
  }

  function handleCloseAutoFocus(event: DialogAutoFocusEvent) {
    onCloseAutoFocus?.(event);
    if (event.defaultPrevented) return;
    // A trigger can be gone by the time the dialog closes (its row was
    // removed): fall back to the opener, and when both are gone leave focus
    // where it is instead of inventing a destination.
    const explicit = restoreFocusRef?.current;
    const target = explicit?.isConnected
      ? explicit
      : restoreFocusToPrevious
        ? previousFocusRef.current
        : null;
    if (!target?.isConnected) return;
    event.preventDefault();
    target.focus();
  }

  return {
    onOpenAutoFocus: handleOpenAutoFocus,
    onCloseAutoFocus: handleCloseAutoFocus,
  };
}
