import { STAGE } from "@customreport/shared";
export { riskCoversStage } from "@customreport/shared";

const STAGE_SPLIT_RE = /[,;]+/;

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
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    const canonical = canonicalStageName(id);
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    out.push(canonical);
  }
  return out;
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

export function splitStageNames(
  stageName: string | null | undefined,
): string[] {
  if (!stageName || stageName.trim() === "" || stageName.trim() === "—") {
    return [];
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of stageName.split(STAGE_SPLIT_RE)) {
    const value = raw.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

export function joinStageNames(stages: readonly string[]): string | null {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of stages) {
    const value = raw.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out.length > 0 ? out.join(", ") : null;
}

export function stageNameMatches(
  stageName: string | null | undefined,
  stage: string,
): boolean {
  // stage-label-canonicalization 1.3: the legacy CSV path must treat a stored
  // "Dev" as "Development", so canonicalize both the split tags and the target.
  const target = canonicalStageName(stage);
  const tags = splitStageNames(stageName).map(canonicalStageName);
  return tags.length === 0 || tags.includes(target);
}
