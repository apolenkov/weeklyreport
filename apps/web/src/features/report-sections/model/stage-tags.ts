import { STAGE } from "@customreport/shared";
export { riskCoversStage, splitStageNames } from "@customreport/shared";

// "Dev" is a UI chip alias; the DB form is the full stage name.
export function canonicalStageName(name: string): string {
  return name.toLowerCase() === "dev" ? STAGE.DEVELOPMENT : name;
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
