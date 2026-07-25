import type { PrismaClient } from "@prisma/client";

export async function assertSeedCoverage(
  prisma: PrismaClient,
  label: string,
): Promise<void> {
  const REQUIRED_STATUSES = [
    "planned",
    "in_progress",
    "paused",
    "postponed",
    "done",
  ] as const;

  const statusGroups = await prisma.item.groupBy({
    by: ["workflowStatus"],
    _count: true,
  });
  const present = new Set(statusGroups.map((g) => g.workflowStatus));
  const missingStatuses = REQUIRED_STATUSES.filter((s) => !present.has(s));

  const severityGroups = await prisma.risk.groupBy({
    by: ["severity"],
    _count: true,
  });
  const severities = new Set(severityGroups.map((g) => g.severity));
  const missingSeverities = (["at-risk", "blocked"] as const).filter(
    (s) => !severities.has(s),
  );

  const spreadRanks = await prisma.item.count({
    where: { priorityRank: { gt: 1 } },
  });

  const problems = [
    ...missingStatuses.map((s) => `no item with workflowStatus '${s}'`),
    ...missingSeverities.map((s) => `no risk with severity '${s}'`),
    ...(spreadRanks === 0 ? ["no item with priorityRank above 1"] : []),
  ];
  if (problems.length > 0) {
    throw new Error(`[${label}] status coverage gap: ${problems.join("; ")}`);
  }
  console.log(`[${label}] Status coverage OK (statuses, alarms, ranks).`);
}
