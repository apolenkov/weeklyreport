export type StageName =
  | "Planning"
  | "Analysis"
  | "Design"
  | "Development"
  | "Testing"
  | "DevOps"
  | "Support";

/**
 * Canonical per-stage constants — the single source for SDLC stage names.
 * Reference these (e.g. `STAGE.DEVELOPMENT`) instead of bare string literals in
 * logic so the names live in exactly one place. This file is that one place.
 */
export const STAGE = {
  PLANNING: "Planning",
  ANALYSIS: "Analysis",
  DESIGN: "Design",
  DEVELOPMENT: "Development",
  TESTING: "Testing",
  DEVOPS: "DevOps",
  SUPPORT: "Support",
} as const satisfies Record<string, StageName>;

export const STAGE_NAMES: readonly StageName[] = [
  STAGE.PLANNING,
  STAGE.ANALYSIS,
  STAGE.DESIGN,
  STAGE.DEVELOPMENT,
  STAGE.TESTING,
  STAGE.DEVOPS,
  STAGE.SUPPORT,
] as const;

// Folds a stage name to a comparison key: lower-cased, with the historical
// "Development" ↔ "Dev" alias collapsed onto a single slot. The single source of
// the alias rule — the server ownership guard and the client dialog scoping both
// canonicalize through here so they never disagree on whether two names refer to
// the same pipeline stage.
export function normalizeStageName(stageName: string): string {
  const lower = stageName.toLowerCase();
  return lower === "development" ? "dev" : lower;
}

// True when two stage names refer to the same pipeline slot (handles the
// "Development" ↔ "Dev" alias).
export function stageNamesMatch(a: string, b: string): boolean {
  return normalizeStageName(a) === normalizeStageName(b);
}
