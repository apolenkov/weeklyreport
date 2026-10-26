import { shortNameFromName } from "@weeklyreport/shared";
import { useRef } from "react";

import { useSdlcTooltip } from "../../../shared/ui/feedback/sdlc-tooltip";
import { STAGE_ICONS } from "../../report-sections";
import type { GridAuthor, GridTone } from "../model/slide-grid-model";
import { SLIDE_AUTHOR_BADGE_CLASS } from "./slide-layout";

export function useHoverTooltip<T extends HTMLElement = HTMLSpanElement>(
  content: string,
) {
  const ref = useRef<T | null>(null);
  const tooltip = useSdlcTooltip();
  return {
    ref,
    onMouseEnter: () => {
      const el = ref.current;
      if (el) tooltip.show(el.getBoundingClientRect(), content);
    },
    onMouseLeave: () => {
      tooltip.hide();
    },
  };
}

// Cycled CSS tokens; owner is always slot 0.
export function authorSlotBackground(author: GridAuthor): string {
  return `var(--slide-author-${String(author.colorIndex)})`;
}

export function AuthorBadge({
  author,
}: {
  readonly author: GridAuthor | undefined;
}) {
  // The tooltip label mirrors the footer legend entry for pointer users
  // inspecting the persistent row marker.
  const unknown = author === undefined;
  const label = unknown
    ? "Unknown author"
    : author.role === undefined
      ? shortNameFromName(author.name)
      : `${shortNameFromName(author.name)} · ${author.role}`;
  const tooltip = useHoverTooltip(label);
  // A missing author still surfaces the foreign-record marker as unknown.
  return (
    <span
      {...tooltip}
      data-testid="slide-author-badge"
      className={SLIDE_AUTHOR_BADGE_CLASS}
      style={
        unknown
          ? { background: "var(--color-muted)" }
          : { background: authorSlotBackground(author) }
      }
    >
      <span aria-hidden="true">{unknown ? "?" : author.initials}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

// Frame is the status: dashed = in flight; tint-only = done/at-risk/blocked.
// Postponed also mutes text (deprioritized, not alarmed).
export const TONE_BORDER: Record<GridTone, string> = {
  neutral: "border-dashed border-[var(--color-border-strong)]",
  note: "border-[var(--card-surface-border)]",
  completed: "border-transparent bg-[var(--color-chip-on-track-bg)]",
  "at-risk": "border-transparent bg-[var(--color-status-at-risk-bg)]",
  blocked: "border-transparent bg-[var(--color-chip-blocked-bg)]",
  paused: "border-dashed border-[var(--color-border-strong)]",
  postponed:
    "border-dashed border-[var(--color-border-strong)] text-[var(--color-muted-foreground)]",
};

// The hidden label gives screen readers the status conveyed by the frame tint.
export const TONE_SR_LABEL: Record<GridTone, string | null> = {
  neutral: null,
  note: null,
  completed: "Completed",
  "at-risk": "At risk",
  blocked: "Blocked",
  paused: "Paused",
  postponed: "Postponed",
};

function StageWatermark({ stageName }: { readonly stageName: string }) {
  const tooltip = useHoverTooltip(stageName);
  const Icon = STAGE_ICONS[stageName];
  if (!Icon) return null;
  return (
    <span {...tooltip} className="inline-flex shrink-0">
      <Icon className="h-4 w-4" />
    </span>
  );
}

export function StageWatermarks({
  stageNames,
}: {
  readonly stageNames: readonly string[];
}) {
  // A stage outside the icon catalogue has no watermark to show; an
  // unknown-only input must not leave an empty testid'd rail behind (C5182).
  const renderable = stageNames.filter(
    (stageName) => STAGE_ICONS[stageName] !== undefined,
  );
  if (renderable.length === 0) return null;
  return (
    <span
      aria-hidden="true"
      data-testid="slide-stage-watermarks"
      className="inline-flex min-w-0 max-w-full flex-wrap items-center justify-end gap-0.5 opacity-[0.28]"
    >
      {renderable.map((stageName) => (
        <StageWatermark key={stageName} stageName={stageName} />
      ))}
    </span>
  );
}

// Only stages that appear on the slide, in canonical pipeline order.
export function StageLegend({
  stageNames,
}: {
  readonly stageNames: readonly string[];
}) {
  if (stageNames.length === 0) return null;
  return (
    <div
      data-testid="slide-stage-legend"
      className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-muted-foreground)]"
    >
      {stageNames.map((stageName) => {
        const Icon = STAGE_ICONS[stageName];
        // The legend names every stage on the slide; only a catalogued stage
        // has an icon, so an unknown name keeps its text and drops the icon
        // instead of disappearing (C5182).
        return (
          <span key={stageName} className="inline-flex items-center gap-1">
            {Icon ? <Icon aria-hidden="true" className="h-4 w-4" /> : null}
            {stageName}
          </span>
        );
      })}
    </div>
  );
}
