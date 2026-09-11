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
  readonly groups: number;
  readonly users: number;
  readonly products: number;
  readonly stages: number;
  readonly stageAssignments: number;
  readonly reports: number;
  readonly sections: SectionCounts;
  readonly risks: number;
  readonly decisions: number;
  readonly reminderPolicies: number;
  readonly reminderRules: number;
  readonly viewerGroupAccesses: number;
  readonly reopenRequests: number;
  readonly actionLogs: number;
}

const countLabel = (count: number, singular: string): string =>
  `${count} ${singular}${count === 1 ? "" : "s"}`;

/** Prints the seed run counts in one line. */
export function logSeedSummary(summary: SeedSummary): void {
  const { sections } = summary;
  console.log(
    `Seeded: ${summary.groups} groups, ${summary.users} users, ${summary.products} products, ` +
      `${summary.stages} stages, ${summary.stageAssignments} assignments, ` +
      `${summary.reports} reports, ${sections.sections} sections, ${sections.items} items, ` +
      `${sections.projectStatuses} project statuses, ${sections.stageStatuses} stage statuses, ${summary.risks} risks, ` +
      `${summary.decisions} decisions, ` +
      `${summary.reminderPolicies} reminder policies, ` +
      `${summary.reminderRules} reminder rules, ` +
      `${summary.viewerGroupAccesses} viewer group accesses, ` +
      `${countLabel(summary.reopenRequests, "reopen request")}, ${countLabel(summary.actionLogs, "action log")}`,
  );
}
