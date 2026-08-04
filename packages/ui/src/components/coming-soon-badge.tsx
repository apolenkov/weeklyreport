import { cn } from "@customreport/ui/lib/utils";
import type { HTMLAttributes } from "react";

type ComingSoonBadgeProps = Readonly<HTMLAttributes<HTMLSpanElement>>;

/**
 * Amber deferred-feature pill with a visible label — never a hidden flag.
 * Place on an inert control to mark UI that is deferred (not shipped).
 */
export function ComingSoonBadge({ className, ...props }: ComingSoonBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-full",
        "bg-coming-soon px-2 py-0.5 text-[length:var(--font-size-coming-soon)] font-semibold uppercase tracking-wide text-coming-soon-foreground",
        className,
      )}
      {...props}
      data-state="coming-soon"
    >
      Coming Soon
    </span>
  );
}
