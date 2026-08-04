"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@customreport/ui/components/ui/tooltip";

import type { StageStatus } from "../../report-sections";
import { STAGE_CHIP_BOX_HEIGHT, STATUS_CONFIG } from "../../report-sections";

// Mine-mode inert indicator for collapsed foreign/vacant stages. aria-label
// and a shared Radix tooltip reveal names/statuses; never un-hides chips or
// touches health/completeness.
const HIDDEN_STAGES_ARIA_PREFIX = "Hidden stages —";

function collapsedStagesIndicatorLabel(count: number): string {
  return `+${count} more`;
}

interface CollapsedStagesIndicatorProps {
  readonly reveal: readonly string[];
  // Align statuses with reveal so blocked/at-risk rows stand out; missing rows
  // fall back to neutral.
  readonly statuses: readonly StageStatus[];
  readonly colors: { readonly border: string; readonly text: string };
  readonly count: number;
}

export function CollapsedStagesIndicator({
  reveal,
  statuses,
  colors,
  count,
}: CollapsedStagesIndicatorProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="img"
          data-testid="collapsed-stages-indicator"
          aria-label={`${HIDDEN_STAGES_ARIA_PREFIX} ${reveal.join(", ")}`}
          className="inline-flex cursor-default items-center rounded-[var(--radius-pill)] border border-dashed px-2 text-[12px] font-medium"
          style={{
            height: STAGE_CHIP_BOX_HEIGHT,
            borderColor: colors.border,
            color: colors.text,
          }}
        >
          {collapsedStagesIndicatorLabel(count)}
        </span>
      </TooltipTrigger>
      {/* Light popover surface (scoped override); hideArrow avoids the dark default arrow. */}
      <TooltipContent
        hideArrow
        className="border bg-popover text-left text-popover-foreground shadow-md"
      >
        {reveal.map((line, idx) => {
          // Colour each row by stage status (STATUS_CONFIG); status is already
          // in text/aria-label, so the leading dot is decorative.
          const status = statuses[idx] ?? "empty";
          const color = STATUS_CONFIG[status].text;
          return (
            <div key={line} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span style={{ color }}>{line}</span>
            </div>
          );
        })}
      </TooltipContent>
    </Tooltip>
  );
}
