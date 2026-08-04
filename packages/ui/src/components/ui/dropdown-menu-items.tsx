"use client";

import { cn } from "@customreport/ui/lib/utils";
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react";
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
  "data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 data-[variant=destructive]:*:[svg]:text-destructive!";
const SUBTRIGGER_OPEN_STATE =
  "data-[state=open]:bg-accent data-[state=open]:text-accent-foreground";
const INSET_ITEM = cn(ITEM_LAYOUT, ITEM_STATE, ITEM_ICONS, "pr-2 pl-8");
const INDICATOR_SLOT =
  "pointer-events-none absolute left-2 flex size-3.5 items-center justify-center";

/** Groups related dropdown items. */
function DropdownMenuGroup({
  ...props
}: Readonly<React.ComponentProps<typeof DropdownMenuPrimitive.Group>>) {
  return (
    <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
  );
}

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
      data-inset={inset}
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

/** Dropdown item with a checkbox indicator. */
function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: Readonly<React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>>) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      className={cn(INSET_ITEM, className)}
      {...(checked === undefined ? {} : { checked })}
      {...props}
    >
      <span className={INDICATOR_SLOT}>
        <DropdownMenuPrimitive.ItemIndicator>
          <CheckIcon className="size-4" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  );
}

/** Radio group scoped to the dropdown. */
function DropdownMenuRadioGroup({
  ...props
}: Readonly<React.ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>>) {
  return (
    <DropdownMenuPrimitive.RadioGroup
      data-slot="dropdown-menu-radio-group"
      {...props}
    />
  );
}

/** Dropdown radio option with an indicator. */
function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: Readonly<React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>>) {
  return (
    <DropdownMenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      className={cn(INSET_ITEM, className)}
      {...props}
    >
      <span className={INDICATOR_SLOT}>
        <DropdownMenuPrimitive.ItemIndicator>
          <CircleIcon className="size-2 fill-current" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
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
      data-inset={inset}
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

/** Trailing keyboard-shortcut hint in a dropdown item. */
function DropdownMenuShortcut({
  className,
  ...props
}: Readonly<React.ComponentProps<"span">>) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(
        "ml-auto text-xs tracking-widest text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

/** Item that opens a nested submenu. */
function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: Readonly<
  React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & {
    inset?: boolean;
  }
>) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        ITEM_LAYOUT,
        ITEM_STATE,
        ITEM_ICONS,
        ITEM_PADDING,
        ITEM_MUTED_ICON_TEXT,
        SUBTRIGGER_OPEN_STATE,
        className,
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto size-4" />
    </DropdownMenuPrimitive.SubTrigger>
  );
}

export {
  DropdownMenuCheckboxItem,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSubTrigger,
};
