import {
  SEED_PRODUCTS,
  SEED_REPORTING_GROUPS,
  SEED_STAGES,
  SEED_USERS,
} from "./seed-constants.js";

/** Rows written by one report generation, folded into the run summary. */
export interface SectionCounts {
  readonly sections: number;
  readonly items: number;
  readonly projectStatuses: number;
  readonly stageStatuses: number;
}

export const NO_SECTION_COUNTS: SectionCounts = {
  sections: 0,
  items: 0,
  projectStatuses: 0,
  stageStatuses: 0,
};

export const addSectionCounts = (
  a: SectionCounts,
  b: SectionCounts,
): SectionCounts => ({
  sections: a.sections + b.sections,
  items: a.items + b.items,
  projectStatuses: a.projectStatuses + b.projectStatuses,
  stageStatuses: a.stageStatuses + b.stageStatuses,
});

export const sumSectionCounts = (
  parts: readonly SectionCounts[],
): SectionCounts => parts.reduce(addSectionCounts, NO_SECTION_COUNTS);

interface SeedSummary {
  readonly stageAssignments: number;
  readonly sections: SectionCounts;
  readonly risks: number;
  readonly decisions: number;
  readonly reminderPolicies: number;
  readonly reminderRules: number;
}

/** Prints the one-line run report the seed has always ended with. */
export function logSeedSummary(summary: SeedSummary): void {
  const { sections } = summary;
  console.log(
    `Seeded: ${SEED_REPORTING_GROUPS.length + 1} groups, ${SEED_USERS.length} users, ${SEED_PRODUCTS.length} products, ` +
      `${SEED_STAGES.length} stages, ${summary.stageAssignments} assignments, ` +
      `2 reports, ${sections.sections} sections, ${sections.items} items, ` +
      `${sections.projectStatuses} project statuses, ${sections.stageStatuses} stage statuses, ${summary.risks} risks, ` +
      `${summary.decisions} decisions, ` +
      `${summary.reminderPolicies} reminder policies, ` +
      `${summary.reminderRules} reminder rules, ` +
      `2 viewer group accesses, 1 reopen request, 1 action log`,
  );
}
