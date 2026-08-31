"use client";

import { cn } from "@customreport/ui/lib/utils";
import { XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import * as React from "react";

import { useDialogFocus } from "./dialog-focus";

/** Owns open state shared by a dialog trigger and content panel. */
function Dialog({
  ...props
}: Readonly<React.ComponentProps<typeof DialogPrimitive.Root>>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

/** Mounts dialog surfaces outside ancestor stacking and overflow contexts. */
function DialogPortal({
  ...props
}: Readonly<React.ComponentProps<typeof DialogPrimitive.Portal>>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

type DialogOverlayProps = React.ComponentProps<
  typeof DialogPrimitive.Overlay
> & {
  readonly testId?: string | undefined;
};

/** Full-screen dimming overlay behind dialog content. */
function DialogOverlay({
  className,
  testId,
  ...props
}: Readonly<DialogOverlayProps>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      data-testid={testId}
      className={cn(
        "fixed inset-0 z-(--layer-overlay) bg-overlay data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
        className,
      )}
      {...props}
    />
  );
}

type DialogContentProps = React.ComponentProps<
  typeof DialogPrimitive.Content
> & {
  readonly showCloseButton?: boolean | undefined;
  readonly overlayClassName?: string | undefined;
  readonly overlayTestId?: string | undefined;
  readonly initialFocusRef?: React.RefObject<HTMLElement | null> | undefined;
  readonly restoreFocusRef?: React.RefObject<HTMLElement | null> | undefined;
  readonly restoreFocusToPrevious?: boolean | undefined;
};

/**
 * Dialog panel with owned portal, overlay, focus targets, and optional close control.
 */
function DialogContent({
  className,
  children,
  showCloseButton = true,
  overlayClassName,
  overlayTestId,
  initialFocusRef,
  restoreFocusRef,
  restoreFocusToPrevious = false,
  onOpenAutoFocus,
  onCloseAutoFocus,
  ...props
}: Readonly<DialogContentProps>) {
  const focus = useDialogFocus({
    initialFocusRef,
    restoreFocusRef,
    restoreFocusToPrevious,
    onOpenAutoFocus,
    onCloseAutoFocus,
  });

  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay className={overlayClassName} testId={overlayTestId} />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-(--layer-overlay) grid w-full max-w-[calc(100%-var(--spacing)*8)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border border-border bg-background p-6 shadow-lg duration-200 outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:max-w-lg",
          className,
        )}
        onOpenAutoFocus={focus.onOpenAutoFocus}
        onCloseAutoFocus={focus.onCloseAutoFocus}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

/** Accessible heading for its associated dialog. */
function DialogTitle({
  className,
  ...props
}: Readonly<React.ComponentProps<typeof DialogPrimitive.Title>>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  );
}

/** Accessible supporting description for its associated dialog. */
function DialogDescription({
  className,
  ...props
}: Readonly<React.ComponentProps<typeof DialogPrimitive.Description>>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export { Dialog, DialogContent, DialogDescription, DialogTitle };
