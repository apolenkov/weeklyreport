import { canonicalStageName, splitStageNames } from "../../report-sections";

export function canonicalRiskStageTags(risk: {
  readonly stageNames?: readonly string[] | null | undefined;
  readonly stageName?: string | null | undefined;
}): string[] {
  const raw =
    risk.stageNames && risk.stageNames.length > 0
      ? risk.stageNames
      : splitStageNames(risk.stageName);
  return raw.map(canonicalStageName);
}
