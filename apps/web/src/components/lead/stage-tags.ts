"use client";

const STAGE_SPLIT_RE = /[,;]+/;

/** UI chip label → DB canonical stage name. "Dev" is the chip; "Development" is stored in stageIds. */
const STAGE_ALIAS: Record<string, string> = {
  dev: "Development",
};

/** Normalize a stage name to its canonical DB form (resolves UI chip aliases). */
export function canonicalStageName(name: string): string {
  return STAGE_ALIAS[name.toLowerCase()] ?? name;
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
  const tags = splitStageNames(stageName);
  return tags.length === 0 || tags.includes(stage);
}

/**
 * Returns true when a risk (or decision/item) covers the given stage name.
 *
 * Prefers `stageIds` (new format) over the deprecated `stageName` CSV field.
 * This is the canonical matcher — always use it instead of raw stageNameMatches
 * when the object may carry stageIds.
 *
 * stageIds = []  → risk applies to all assigned stages → always true
 * stageIds = ["Testing"]  → only true for "Testing"
 * stageIds = undefined  → fall back to stageName CSV (legacy)
 */
export function riskCoversStage(
  risk: { stageName?: string | null; stageIds?: readonly string[] },
  stageName: string,
): boolean {
  if (risk.stageIds !== undefined) {
    if (risk.stageIds.length === 0) return true;
    const canonical = canonicalStageName(stageName);
    return risk.stageIds.some((id) => canonicalStageName(id) === canonical);
  }
  return stageNameMatches(risk.stageName, stageName);
}
