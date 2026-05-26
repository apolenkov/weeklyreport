export type StageName =
  | "Planning"
  | "Analysis"
  | "Design"
  | "Development"
  | "Testing"
  | "DevOps"
  | "Support";

export const STAGE_NAMES: readonly StageName[] = [
  "Planning",
  "Analysis",
  "Design",
  "Development",
  "Testing",
  "DevOps",
  "Support",
] as const;

