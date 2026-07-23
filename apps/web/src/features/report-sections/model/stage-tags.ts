import { STAGE } from "@customreport/shared";
export { riskCoversStage, splitStageNames } from "@customreport/shared";

/** Normalize a stage name to its canonical DB form (resolves UI chip aliases). */
export function canonicalStageName(name: string): string {
  return name.toLowerCase() === "dev" ? STAGE.DEVELOPMENT : name;
}

/**
 * Canonicalize a stored stageIds list, dropping duplicates that collapse after
 * aliasing (a legacy `["Dev", "Development"]` → `["Development"]`). Record
 * dialogs run saved selections through this so a record always persists the
 * canonical stage name (stage-label-canonicalization spec 1.2).
 */
export function canonicalStageIds(ids: readonly string[]): string[] {
  return [...new Set(ids.map(canonicalStageName))];
}

/**
 * Display-only short labels for the SDLC pipeline chip, where seven chips share
 * one row. Keyed by canonical name; the short form is NEVER stored or matched.
 * Only "Development" shortens today ("Dev"); all other stages display in full.
 */
const STAGE_SHORT_LABEL: Record<string, string> = {
  [STAGE.DEVELOPMENT]: "Dev",
};

/** The short pipeline-chip label for a (canonical) stage name; full name if none. */
export function stageShortLabel(name: string): string {
  return STAGE_SHORT_LABEL[canonicalStageName(name)] ?? name;
}
