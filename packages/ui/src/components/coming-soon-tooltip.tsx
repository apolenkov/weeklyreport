"use client";

import type * as React from "react";

import { ComingSoonBadge } from "./coming-soon-badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

/** Tooltip wrapper that remains usable without a shell-level provider. */
export function ComingSoonTooltip({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent
          hideArrow
          side="bottom"
          align="center"
          sideOffset={6}
          className="border-0 bg-transparent p-0 shadow-none"
        >
          <ComingSoonBadge />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
