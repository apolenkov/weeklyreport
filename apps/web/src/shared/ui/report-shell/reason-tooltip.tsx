"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@customreport/ui/components/ui/tooltip";
import {
  cloneElement,
  type MouseEvent,
  type ReactElement,
  useId,
  useState,
} from "react";

interface ReasonTooltipProps {
  readonly reason: string | undefined;
  readonly children: ReactElement<{
    "aria-describedby"?: string | undefined;
    onClick?: (event: MouseEvent) => void;
  }>;
}

// Explains why an aria-disabled control is blocked. The reason opens on hover
// and focus, and on click/tap (controlled open, because Radix ignores touch);
// preventDefault keeps Radix's own click handler from closing it again. The
// sr-only copy supplies the description while closed; the open tooltip supplies
// its own description so assistive tech receives the reason once. Callers supply
// the TooltipProvider.
export function ReasonTooltip({ reason, children }: ReasonTooltipProps) {
  const reasonId = useId();
  const [open, setOpen] = useState(false);
  if (!reason) return children;
  return (
    <>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          {cloneElement(children, {
            "aria-describedby": open ? undefined : reasonId,
            onClick: (event) => {
              event.preventDefault();
              setOpen(true);
            },
          })}
        </TooltipTrigger>
        <TooltipContent>{reason}</TooltipContent>
      </Tooltip>
      <span id={reasonId} className="sr-only">
        {reason}
      </span>
    </>
  );
}
