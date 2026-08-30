export { riskCoversStage } from "@customreport/shared";

// Stage values are canonical when they reach the UI. Kept as a direct helper
// for consumers that need a single-value normal form.
export function canonicalStageName(name: string): string {
  return name;
}

// Preserve the selected canonical values while removing duplicates.
export function canonicalStageNames(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

export function stageShortLabel(name: string): string {
  return name;
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
    stageTagsLabel:
      stageTags.length === 0 ? "No stage set" : stageTags.join(", "),
    visibleStageTags,
    hiddenStageCount: Math.max(stageTags.length - visibleStageTags.length, 0),
    isActivityItem: false,
  };
}
