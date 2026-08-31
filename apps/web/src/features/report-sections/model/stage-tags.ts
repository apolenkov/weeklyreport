export { riskCoversStage } from "@customreport/shared";

// Preserve the selected canonical values while removing duplicates.
export function canonicalStageNames(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

export function stageShortLabel(name: string): string {
  // The pipeline has seven fixed-width desktop columns. Keep the stored
  // canonical value intact while using the compact presentation label that
  // fits beside the stage icon and status glyph.
  return name === "Development" ? "Dev" : name;
}

export type ItemCardStageTags =
  | { readonly isActivityItem: true }
  | {
      readonly stageTags: readonly string[];
      readonly stageTagsLabel: string;
      readonly visibleStageTags: readonly string[];
      readonly hiddenStageCount: number;
      readonly isActivityItem: false;
    };

const MAX_VISIBLE_STAGE_TAGS = 2;

export function deriveItemCardStageTags(item: {
  readonly stageNames: readonly string[];
  readonly activityId?: string | null | undefined;
}): ItemCardStageTags {
  if (item.activityId != null) return { isActivityItem: true };
  const stageTags = canonicalStageNames(item.stageNames);
  const visibleStageTags = stageTags.slice(0, MAX_VISIBLE_STAGE_TAGS);
  return {
    stageTags,
    stageTagsLabel: stageTags.join(", "),
    visibleStageTags,
    hiddenStageCount: Math.max(stageTags.length - visibleStageTags.length, 0),
    isActivityItem: false,
  };
}
