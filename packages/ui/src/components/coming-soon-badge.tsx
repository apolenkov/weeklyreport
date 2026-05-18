import type { HTMLAttributes } from "react";
import { cn } from "@customreport/ui/lib/utils";

type ComingSoonBadgeProps = HTMLAttributes<HTMLSpanElement>;

export function ComingSoonBadge({ className, ...props }: ComingSoonBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-full",
        "bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700",
        className,
      )}
      data-state="coming-soon"
      {...props}
    >
      Coming Soon
    </span>
  );
}
