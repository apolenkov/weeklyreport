import { cn } from "@weeklyreport/ui/lib/utils";
import type { ComponentProps } from "react";
/** Grows with its value up to three lines. */
export function GrowingTextarea({
  className,
  ...props
}: ComponentProps<"textarea">) {
  return (
    <textarea
      rows={1}
      className={cn(
        "field-sizing-content min-h-[1lh] max-h-[3lh] w-full resize-none",
        className,
      )}
      {...props}
    />
  );
}
