"use client";

import { cn } from "@customreport/ui/lib/utils";
import { Progress as ProgressPrimitive } from "radix-ui";
import type * as React from "react";

// Radix reports progress as a 0-100 percentage; the indicator is a full-width bar
// slid left by the remaining share, so 100 is the "complete" end of that scale.
const PROGRESS_COMPLETE_PERCENT = 100;

/**
 * Determinate progress bar; value drives the indicator transform.
 */
function Progress({
  className,
  value,
  ...props
}: Readonly<
  React.ComponentProps<typeof ProgressPrimitive.Root> & {
    /** Determinate fill 0-100; absent value is a compile error. */
    value: number;
  }
>) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-primary/20",
        className,
      )}
      {...props}
      value={value}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="h-full w-full flex-1 bg-primary transition-all"
        style={{
          transform: `translateX(-${PROGRESS_COMPLETE_PERCENT - value}%)`,
        }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
