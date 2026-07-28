import { canonicalStageName, splitStageNames } from "../model/stage-tags";
import type { KanbanItem } from "../model/types";

export type ItemCardStageTags =
  | {
      // Activity-parented rows are legitimately stage-less — no tags, no warning.
      isActivityItem: true;
    }
  | {
      stageTags: string[];
      stageTagsLabel: string;
      visibleStageTags: string[];
      hiddenStageCount: number;
      isActivityItem: false;
    };

// Cap visible stage pills; remainder collapses into a "+N" overflow chip.
const MAX_VISIBLE_STAGE_TAGS = 2;

export function deriveItemCardStageTags(
  item: Pick<KanbanItem, "stageNames" | "stageName" | "activityId">,
): ItemCardStageTags {
  // Activities carry no SDLC stage by design — never the "No stage set" warning.
  if (item.activityId != null) {
    return {
      isActivityItem: true,
    };
  }
  const rawStageTags =
    item.stageNames && item.stageNames.length > 0
      ? item.stageNames
      : // eslint-disable-next-line @typescript-eslint/no-deprecated -- intentional legacy-data read; replacement noted in the deprecation comment
        splitStageNames(item.stageName);
  // Heal legacy short "Dev" at render so the card matches seeded canonical names.
  const stageTags = [...new Set(rawStageTags.map(canonicalStageName))];
  // Stage-less product item is a legacy anomaly (not "all stages") — mirror risk row.
  const stageTagsLabel =
    stageTags.length === 0 ? "No stage set" : stageTags.join(", ");
  const visibleStageTags = stageTags.slice(0, MAX_VISIBLE_STAGE_TAGS);
  const hiddenStageCount = Math.max(
    stageTags.length - visibleStageTags.length,
    0,
  );
  return {
    stageTags,
    stageTagsLabel,
    visibleStageTags,
    hiddenStageCount,
    isActivityItem: false,
  };
}

export function ItemCardStageTagsRow(props: ItemCardStageTags) {
  if (props.isActivityItem) return null;
  const { stageTags, stageTagsLabel, visibleStageTags, hiddenStageCount } =
    props;
  return (
    <span
      role="img"
      className="inline-flex min-w-0 flex-wrap items-center justify-end gap-1"
      aria-label={`Item stages: ${stageTagsLabel}`}
      title={stageTagsLabel}
    >
      {stageTags.length === 0 ? (
        // Warning tokens match the risk row's "no-stage-warning" chip
        // (at-risk bg/fg tokens) so a stage-less item reads as an anomaly.
        <span className="inline-flex w-fit items-center rounded-[var(--radius-pill)] bg-[var(--color-status-at-risk-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-status-at-risk-fg)]">
          No stage set
        </span>
      ) : (
        visibleStageTags.map((stage) => (
          <span
            key={stage}
            className="inline-flex max-w-[92px] items-center truncate rounded-[var(--radius-pill)] border border-[var(--color-primary)]/40 px-2 py-0.5 text-[11px] font-semibold text-[var(--color-primary)]"
            title={stage}
          >
            {stage}
          </span>
        ))
      )}
      {hiddenStageCount > 0 && (
        <span
          className="inline-flex w-fit items-center rounded-[var(--radius-pill)] bg-[var(--color-muted)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-muted-foreground)]"
          title={stageTagsLabel}
        >
          +{hiddenStageCount}
        </span>
      )}
    </span>
  );
}
