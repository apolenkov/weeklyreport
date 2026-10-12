"use client";

import { cn } from "@weeklyreport/ui/lib/utils";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import type * as React from "react";

const CONTENT_MOTION =
  "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95";
const CONTENT_SURFACE =
  "z-(--layer-popover) min-w-(--dropdown-menu-min-width) origin-(--radix-dropdown-menu-content-transform-origin) rounded-md border border-border bg-popover p-1 text-popover-foreground";
const DROPDOWN_SIDE_OFFSET_PX = 4;

/** Owns open state for a dropdown trigger and content panel. */
function DropdownMenu({
  ...props
}: Readonly<React.ComponentProps<typeof DropdownMenuPrimitive.Root>>) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

/** Control that opens the dropdown menu. */
function DropdownMenuTrigger({
  ...props
}: Readonly<React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>>) {
  return (
    <DropdownMenuPrimitive.Trigger
      data-slot="dropdown-menu-trigger"
      {...props}
    />
  );
}

/** Positioned dropdown panel with a small trigger-edge offset. */
function DropdownMenuContent({
  className,
  sideOffset = DROPDOWN_SIDE_OFFSET_PX,
  ...props
}: Readonly<React.ComponentProps<typeof DropdownMenuPrimitive.Content>>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        className={cn(
          CONTENT_SURFACE,
          CONTENT_MOTION,
          "max-h-(--radix-dropdown-menu-content-available-height) overflow-x-hidden overflow-y-auto shadow-md",
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

export { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger };

export {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "./dropdown-menu-items";
