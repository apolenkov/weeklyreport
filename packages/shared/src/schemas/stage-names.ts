/** Canonical SDLC stage label stored on report records. */
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
export const STAGE = Object.freeze({
  PLANNING: "Planning",
  ANALYSIS: "Analysis",
  DESIGN: "Design",
  DEVELOPMENT: "Development",
  TESTING: "Testing",
  DEVOPS: "DevOps",
  SUPPORT: "Support",
} as const satisfies Record<string, StageName>);

/** Ordered canonical stage labels used to render an SDLC pipeline. */
export const STAGE_NAMES: readonly StageName[] = Object.freeze([
  STAGE.PLANNING,
  STAGE.ANALYSIS,
  STAGE.DESIGN,
  STAGE.DEVELOPMENT,
  STAGE.TESTING,
  STAGE.DEVOPS,
  STAGE.SUPPORT,
] as const);

/**
 * Canonical lower-case stage key with Development and Dev collapsed to one slot.
 */
export function normalizeStageName(stageName: string): string {
  const lower = stageName.toLowerCase();
  return lower === "development" ? "dev" : lower;
}

/** True when two stage labels refer to the same pipeline slot. */
export function stageNamesMatch(a: string, b: string): boolean {
  return normalizeStageName(a) === normalizeStageName(b);
}

const STAGE_NAME_SEPARATOR = /[,;]+/;

/** Splits a stage field into unique names; blank and em-dash values yield none. */
export function splitStageNames(
  stageName: string | null | undefined,
): readonly string[] {
  const trimmedStageName = stageName?.trim();
  if (!trimmedStageName || trimmedStageName === "—") return [];

  return Object.freeze([
    ...new Set(
      trimmedStageName
        .split(STAGE_NAME_SEPARATOR)
        .map((name) => name.trim())
        .filter((name) => name.length > 0),
    ),
  ]);
}

/**
 * Whether a risk covers a stage; structured names win and an empty set covers all.
 */
export function riskCoversStage(
  risk: {
    readonly stageName?: string | null | undefined;
    readonly stageNames?: readonly string[] | undefined;
  },
  stageName: string,
): boolean {
  if (risk.stageNames !== undefined) {
    return (
      risk.stageNames.length === 0 ||
      risk.stageNames.some((id) => stageNamesMatch(id, stageName))
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
