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
  /** One honest reveal line per hidden stage (name + owner + status). */
  readonly reveal: readonly string[];
  /**
   * The effective status of each hidden stage, aligned 1:1 with `reveal`, so a
   * blocked/at-risk row stands out in the popover. Falls back to neutral when a
   * row has no matching status.
   */
  readonly statuses: readonly StageStatus[];
  /** Border + text colour derived from the worst hidden status. */
  readonly colors: { readonly border: string; readonly text: string };
  /** Number of stages the Mine filter collapsed. */
  readonly count: number;
}

/**
 * Collapsed Stages Indicator.
 * @param props - The props argument.
 */
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
