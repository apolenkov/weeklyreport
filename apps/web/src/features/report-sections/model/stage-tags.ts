"use client";

import { STAGE } from "@customreport/shared";

const STAGE_SPLIT_RE = /[,;]+/;

/** UI chip label → DB canonical stage name. "Dev" is the chip; "Development" is stored in stageIds. */
const STAGE_ALIAS: Record<string, string> = {
  dev: STAGE.DEVELOPMENT,
};

/** Normalize a stage name to its canonical DB form (resolves UI chip aliases). */
export function canonicalStageName(name: string): string {
  return STAGE_ALIAS[name.toLowerCase()] ?? name;
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
