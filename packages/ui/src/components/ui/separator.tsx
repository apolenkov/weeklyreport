"use client";

import { cn } from "@customreport/ui/lib/utils";
import { Separator as SeparatorPrimitive } from "radix-ui";
import type * as React from "react";

/**
 * Horizontal or vertical visual divider (Radix Separator).
 * @param props - The props argument.
 */
function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
        className,
      )}
      {...props}
    />
  );
}

export { Separator };
