"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@customreport/ui/components/ui/tooltip";

import type { StageStatus } from "../../report-sections/model/mock-data";
import {
  STAGE_CHIP_BOX_HEIGHT,
  STATUS_CONFIG,
} from "../../report-sections/model/stage-chip-config";

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
      {/*
        Softer surface than the shared dark default: the lead found the
        white-on-black "+N more" reveal harsher than the rest of the UI. Scoped
        to THIS indicator via a className override (the same light popover tokens
        as dropdown-menu/select) — the shared dark TooltipContent (stage chips,
        sidebar) is left untouched. `hideArrow` drops the dark Radix arrow that
        would clash with the light surface.
      */}
      <TooltipContent
        hideArrow
        className="border bg-popover text-left text-popover-foreground shadow-md"
      >
        {reveal.map((line, idx) => {
          // pipeline-tooltip-and-indicator: colour each row by its stage status
          // (reuse STATUS_CONFIG tokens, no new token) with a leading status
          // dot, so a blocked/at-risk hidden stage stands out. The status is
          // already announced in the text/aria-label, so the dot is decorative.
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
