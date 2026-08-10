"use client";

import { Button } from "@customreport/ui/components/ui/button";
import { cn } from "@customreport/ui/lib/utils";
import { XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import * as React from "react";

/** Owns open state shared by a dialog trigger and content panel. */
function Dialog({
  ...props
}: Readonly<React.ComponentProps<typeof DialogPrimitive.Root>>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

/** Control that opens its associated dialog. */
function DialogTrigger({
  ...props
}: Readonly<React.ComponentProps<typeof DialogPrimitive.Trigger>>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

/** Mounts dialog surfaces outside ancestor stacking and overflow contexts. */
function DialogPortal({
  ...props
}: Readonly<React.ComponentProps<typeof DialogPrimitive.Portal>>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

/** Control that dismisses its associated dialog. */
function DialogClose({
  ...props
}: Readonly<React.ComponentProps<typeof DialogPrimitive.Close>>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
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

const focusedElement = (): HTMLElement | null =>
  document.activeElement instanceof HTMLElement ? document.activeElement : null;

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
  const previousFocusRef = React.useRef<HTMLElement | null>(null);

  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay className={overlayClassName} testId={overlayTestId} />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-(--layer-overlay) grid w-full max-w-[calc(100%-var(--spacing)*8)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border border-border bg-background p-6 shadow-lg duration-200 outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:max-w-lg",
          className,
        )}
        onOpenAutoFocus={(event) => {
          previousFocusRef.current = restoreFocusToPrevious
            ? focusedElement()
            : null;
          onOpenAutoFocus?.(event);
          if (event.defaultPrevented) return;
          if (!initialFocusRef?.current) return;
          event.preventDefault();
          initialFocusRef.current.focus();
        }}
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event);
          if (event.defaultPrevented) return;
          const target =
            restoreFocusRef?.current ??
            (restoreFocusToPrevious ? previousFocusRef.current : null);
          if (!target) return;
          event.preventDefault();
          target.focus();
        }}
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

/**
 * Layout shell for dialog title and description.
 */
function DialogHeader({
  className,
  ...props
}: Readonly<React.ComponentProps<"div">>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  );
}

/**
 * Action row for dialog buttons; optional outline Close (default off).
 */
function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: Readonly<
  React.ComponentProps<"div"> & {
    showCloseButton?: boolean;
  }
>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
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

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
