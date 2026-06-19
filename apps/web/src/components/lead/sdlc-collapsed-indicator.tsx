"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@customreport/ui/components/ui/tooltip";

import { STAGE_CHIP_BOX_HEIGHT } from "./stage-chip-config";

// lead-pipeline-mine-reveal-and-own-stage-label (affordance 2): in Mine mode the
// filter hides foreign-owned and vacant chips. This small inert indicator near
// the grid reports how many stages are collapsed. Its `aria-label` (non-visual)
// reveals each hidden stage's name and status; a Radix tooltip — the same shared
// `packages/ui` component the chips use — reveals the same lines on hover. It
// never un-hides the chips, nor touches health or completeness.
const HIDDEN_STAGES_ARIA_PREFIX = "Hidden stages —";

function collapsedStagesIndicatorLabel(count: number): string {
  return `+${count} more`;
}

interface CollapsedStagesIndicatorProps {
  /** One honest reveal line per hidden stage (name + owner + status). */
  readonly reveal: readonly string[];
  /** Border + text colour derived from the worst hidden status. */
  readonly colors: { readonly border: string; readonly text: string };
  /** Number of stages the Mine filter collapsed. */
  readonly count: number;
}

export function CollapsedStagesIndicator({
  reveal,
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
      <TooltipContent className="text-left">
        {reveal.map((line) => (
          <div key={line}>{line}</div>
        ))}
      </TooltipContent>
    </Tooltip>
  );
}
