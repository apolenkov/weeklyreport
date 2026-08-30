import { canonicalStageName } from "../../report-sections";

export function canonicalRiskStageTags(risk: {
  readonly stageNames: readonly string[];
}): string[] {
  return risk.stageNames.map(canonicalStageName);
}
