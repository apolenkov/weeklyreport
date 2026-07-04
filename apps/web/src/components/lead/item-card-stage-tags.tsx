import type { KanbanItem } from "./mock-data";
import { canonicalStageName, splitStageNames } from "./stage-tags";

export interface ItemCardStageTags {
  stageTags: string[];
  stageTagsLabel: string;
  visibleStageTags: string[];
  hiddenStageCount: number;
}

/**
 * Derive the item card's stage-tag footer state from the raw item. Pure —
 * no rendering.
 */
export function deriveItemCardStageTags(
  item: Pick<KanbanItem, "stageIds" | "stageName">,
): ItemCardStageTags {
  const stageTags = (
    item.stageIds && item.stageIds.length > 0
      ? item.stageIds
      : // eslint-disable-next-line @typescript-eslint/no-deprecated -- intentional legacy-data read; replacement noted in the deprecation comment
        splitStageNames(item.stageName)
  )
    // stage-label-canonicalization: heal a legacy short "Dev" at render so the
    // card reads the canonical "Development" alongside seeded rows; the pipeline
    // chip keeps its own short label.
    .map(canonicalStageName);
  // enforce-item-decision-stage-schema: a stage-less item is a legacy anomaly,
  // never an implicit "all stages" scope — render the loud "No stage set"
  // warning, mirroring the risk row.
  const stageTagsLabel =
    stageTags.length === 0 ? "No stage set" : stageTags.join(", ");
  const visibleStageTags = stageTags.slice(0, 2);
  const hiddenStageCount = Math.max(
    stageTags.length - visibleStageTags.length,
    0,
  );
  return { stageTags, stageTagsLabel, visibleStageTags, hiddenStageCount };
}

/**
 * Footer stage-tag badges (extracted from ItemCard): the "No stage set"
 * warning chip, up to two visible stage-name pills, and a "+N" overflow pill.
 * Presentational only.
 */
export function ItemCardStageTagsRow({
  stageTags,
  stageTagsLabel,
  visibleStageTags,
  hiddenStageCount,
}: ItemCardStageTags) {
  return (
    <span
      role="img"
      className="inline-flex min-w-0 flex-wrap items-center justify-end gap-1"
      aria-label={`Item stages: ${stageTagsLabel}`}
      title={stageTagsLabel}
    >
      {stageTags.length === 0 ? (
        // Warning tokens match the risk row's "no-stage-warning" chip
        // (#fef3c7 / #8a6d1b) so a stage-less item reads as an anomaly.
        <span className="inline-flex w-fit items-center rounded-[var(--radius-pill)] bg-[#fef3c7] px-2 py-0.5 text-[10px] font-semibold text-[#8a6d1b]">
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
