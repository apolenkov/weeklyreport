import { splitStageNames, STAGE } from "@customreport/shared";
export { riskCoversStage, splitStageNames } from "@customreport/shared";

// "Dev" is a UI chip alias; the DB form is the full stage name.
export function canonicalStageName(name: string): string {
  return name.toLowerCase() === "dev" ? STAGE.DEVELOPMENT : name;
}

// Typed legacy-healing seam: rows written before structured stageNames carry a
// single stage field; this is the one place that reads it, so consumers never
// touch the deprecated property directly.
export function stageNamesFromLegacyField(item: {
  readonly stageNames?: readonly string[] | undefined;
  readonly stageName?: string | undefined;
}): readonly string[] {
  return item.stageNames && item.stageNames.length > 0
    ? item.stageNames
    : splitStageNames(item.stageName);
}

// Aliasing can collapse a legacy `["Dev", "Development"]` to one entry; record
// dialogs run saved selections through this so only canonical names persist
// (openspec/specs/stage-label-canonicalization 1.2).
export function canonicalStageNames(ids: readonly string[]): string[] {
  return [...new Set(ids.map(canonicalStageName))];
}

// Display-only, so seven chips fit one pipeline row; the short form is NEVER
// stored or matched. Unlisted stages display in full.
const STAGE_SHORT_LABEL: Record<string, string> = {
  [STAGE.DEVELOPMENT]: "Dev",
};

export function stageShortLabel(name: string): string {
  return STAGE_SHORT_LABEL[canonicalStageName(name)] ?? name;
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
  readonly stageNames?: readonly string[] | undefined;
  readonly stageName?: string | undefined;
  readonly activityId?: string | null | undefined;
}): ItemCardStageTags {
  if (item.activityId != null) return { isActivityItem: true };
  const stageTags = canonicalStageNames(stageNamesFromLegacyField(item));
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
