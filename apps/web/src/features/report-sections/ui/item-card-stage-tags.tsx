import type { ItemCardStageTags } from "../model/stage-tags";

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
        // Warning tokens mark an invalid product row without a stage.
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
