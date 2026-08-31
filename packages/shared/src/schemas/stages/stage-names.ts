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

/** Whether an explicitly staged risk covers a stage. */
export function riskCoversStage(
  risk: {
    readonly stageNames?: readonly string[] | undefined;
  },
  stageName: string,
): boolean {
  return risk.stageNames?.includes(stageName) ?? false;
}
