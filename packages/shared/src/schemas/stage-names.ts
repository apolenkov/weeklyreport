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

const STAGE_NAME_SEPARATOR = /[,;]+/;

export function splitStageNames(
  stageName: string | null | undefined,
): string[] {
  const trimmedStageName = stageName?.trim();
  if (!trimmedStageName || trimmedStageName === "—") return [];

  return [
    ...new Set(
      trimmedStageName
        .split(STAGE_NAME_SEPARATOR)
        .map((name) => name.trim())
        .filter((name) => name.length > 0),
    ),
  ];
}

// Whether a risk applies to a stage: prefers the structured stage-id list
// (empty means "covers everything"), falling back to the legacy CSV
// stageName field (absent/blank/"—" also means "covers everything") when
// stageIds itself is absent.
export function riskCoversStage(
  risk: { stageName?: string | null; stageIds?: readonly string[] },
  stageName: string,
): boolean {
  if (risk.stageIds !== undefined) {
    return (
      risk.stageIds.length === 0 ||
      risk.stageIds.some((id) => stageNamesMatch(id, stageName))
    );
  }

  // Wildcard is ONLY absent/blank/"—". A non-wildcard string that yields no
  // tokens (e.g. ";;") covers NOTHING — an empty token list must not widen
  // into covers-everything.
  const trimmed = risk.stageName?.trim();
  if (!trimmed || trimmed === "—") return true;

  return splitStageNames(trimmed).some((name) =>
    stageNamesMatch(name, stageName),
  );
}
