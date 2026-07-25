import { cn } from "@customreport/ui/lib/utils";
import type { HTMLAttributes } from "react";

type ComingSoonBadgeProps = HTMLAttributes<HTMLSpanElement>;

/**
 * Amber deferred-feature pill with a visible label — never a hidden flag.
 * Place on an inert control to mark UI that is deferred (not shipped).
 * @param props - The props argument.
 */
export function ComingSoonBadge({ className, ...props }: ComingSoonBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-full",
        "bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700",
        className,
      )}
      {...props}
      data-state="coming-soon"
    >
      Coming Soon
    </span>
  );
}
