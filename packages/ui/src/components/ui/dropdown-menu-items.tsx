"use client";

import { cn } from "@weeklyreport/ui/lib/utils";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import type * as React from "react";

const ITEM_LAYOUT =
  "relative flex cursor-default items-center gap-2 rounded-sm py-1.5 text-sm outline-hidden select-none";
const ITEM_STATE =
  "focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50";
const ITEM_ICONS =
  "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";
const ITEM_PADDING = "px-2 data-[inset]:pl-8";
const ITEM_MUTED_ICON_TEXT =
  "[&_svg:not([class*='text-'])]:text-muted-foreground";
const DESTRUCTIVE_VARIANT =
  "data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive data-[variant=destructive]:*:[svg]:text-destructive!";

/** Selectable dropdown row with optional inset and destructive treatment. */
function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: Readonly<
  React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean;
    variant?: "default" | "destructive";
  }
>) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset ? true : undefined}
      data-variant={variant}
      className={cn(
        ITEM_LAYOUT,
        ITEM_STATE,
        ITEM_ICONS,
        ITEM_PADDING,
        ITEM_MUTED_ICON_TEXT,
        DESTRUCTIVE_VARIANT,
        className,
      )}
      {...props}
    />
  );
}

/** Non-interactive section label inside a dropdown. */
function DropdownMenuLabel({
  className,
  inset,
  ...props
}: Readonly<
  React.ComponentProps<typeof DropdownMenuPrimitive.Label> & {
    inset?: boolean;
  }
>) {
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      data-inset={inset ? true : undefined}
      className={cn(
        "px-2 py-1.5 text-sm font-medium data-[inset]:pl-8",
        className,
      )}
      {...props}
    />
  );
}

/** Visual separator between dropdown sections. */
function DropdownMenuSeparator({
  className,
  ...props
}: Readonly<React.ComponentProps<typeof DropdownMenuPrimitive.Separator>>) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

export { DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator };
