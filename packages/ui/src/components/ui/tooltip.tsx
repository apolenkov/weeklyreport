"use client";

import { cn } from "@customreport/ui/lib/utils";
import { Tooltip as TooltipPrimitive } from "radix-ui";
import type * as React from "react";

import { ComingSoonBadge } from "../coming-soon-badge";

/**
 * Radix tooltip provider (delay/shared config).
 * @param props - The props argument.
 */
function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  );
}

/**
 * Radix tooltip root for a trigger+content pair.
 * @param props - The props argument.
 */
function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}

/**
 * Element that shows the tooltip on hover/focus.
 * @param props - The props argument.
 */
function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

/**
 * Positioned tooltip panel.
 * @param props - The props argument.
 */
function TooltipContent({
  className,
  sideOffset = 0,
  hideArrow = false,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content> & {
  /** Omit the dark Radix arrow — used by the chromeless ComingSoonTooltip. */
  readonly hideArrow?: boolean;
}) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-fit origin-(--radix-tooltip-content-transform-origin) animate-in rounded-md bg-foreground px-3 py-1.5 text-xs text-balance text-background fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          className,
        )}
        {...props}
      >
        {children}
        {hideArrow ? null : (
          <TooltipPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground" />
        )}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

/**
 * Self-contained Coming Soon tooltip: own provider, portaled chromeless badge,
 * works without a shell TooltipProvider (deferred-feature controls).
 * @param options - The options argument.
 */
function ComingSoonTooltip({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent
          hideArrow
          side="bottom"
          align="center"
          sideOffset={6}
          // Whitespace blanking so Radix does not double the control's aria-label with the badge.
          aria-label=" "
          className="border-0 bg-transparent p-0 shadow-none"
        >
          <ComingSoonBadge />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export {
  ComingSoonTooltip,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
};
