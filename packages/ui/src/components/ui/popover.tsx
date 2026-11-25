"use client";
import { cn } from "@weeklyreport/ui/lib/utils";
import { Popover as Primitive } from "radix-ui";
import type { ComponentProps } from "react";

/** Controls an anchored overlay. */
export const Popover = Primitive.Root;
/** Positions the overlay against an existing element. */
export const PopoverAnchor = Primitive.Anchor;
/** Opens the associated overlay. */
export const PopoverTrigger = Primitive.Trigger;
/** Portals the floating panel below its anchor. */
export function PopoverContent({
  className,
  ...props
}: ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        align="start"
        side="bottom"
        sideOffset={4}
        collisionPadding={8}
        className={cn(
          "z-(--layer-popover) max-w-[calc(100vw-1rem)] rounded-lg border bg-popover p-3 text-popover-foreground shadow-md",
          className,
        )}
        {...props}
      />
    </Primitive.Portal>
  );
}
