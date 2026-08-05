import type { PrismaClient } from "@prisma/client";

const DEFAULT_PRIMARY_LEAD_ID = "a0000000-0000-4000-8000-000000000011";

export type SeedCoverageOptions = Readonly<{
  primaryLeadId?: string;
  now?: Date;
}>;

type SeedRecordIdentity = Readonly<{ id: string; stableId: string }>;

const hasPopulatedSnapshot = (
  value: unknown,
  primaryLeadId: string,
): boolean => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const sections = (value as { sections?: unknown }).sections;
  if (!Array.isArray(sections) || sections.length === 0) return false;
  return sections.some(
    (section) =>
      section !== null &&
      typeof section === "object" &&
      (section as { authorId?: unknown }).authorId === primaryLeadId,
  );
};

const recordsAreStable = (records: readonly SeedRecordIdentity[]): boolean =>
  records.every(({ id, stableId }) => id === stableId);

async function assertAssistantFixtureCoverage(
  prisma: PrismaClient,
  label: string,
  options: SeedCoverageOptions,
): Promise<void> {
  const primaryLeadId = options.primaryLeadId ?? DEFAULT_PRIMARY_LEAD_ID;
  const now = options.now ?? new Date();
  const current = await prisma.report.findFirst({
    where: {
      archived: false,
      periodStatus: { in: ["open", "reopened"] },
      periodStart: { lte: now },
    },
    orderBy: [{ periodStart: "desc" }, { id: "desc" }],
    select: { id: true },
  });
  const currentSection = current
    ? await prisma.reportSection.findUnique({
        where: {
          reportId_authorId: { reportId: current.id, authorId: primaryLeadId },
        },
        select: {
          id: true,
          _count: {
            select: {
              items: true,
              risks: true,
              decisions: true,
              projectStatuses: true,
              stageStatuses: true,
              activityStatuses: true,
            },
          },
        },
      })
    : null;
  const currentCount = currentSection
    ? Object.values(currentSection._count).reduce(
        (sum, count) => sum + count,
        0,
      )
    : 0;
  const future = await prisma.report.findMany({
    where: {
      archived: false,
      periodStatus: { in: ["open", "reopened"] },
      periodStart: { gt: now },
    },
    orderBy: [{ periodStart: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  const futureSections = await prisma.reportSection.findMany({
    where: {
      authorId: primaryLeadId,
      reportId: { in: future.map(({ id }) => id) },
    },
    select: {
      reportId: true,
      _count: {
        select: {
          items: true,
          risks: true,
          decisions: true,
          projectStatuses: true,
          stageStatuses: true,
          activityStatuses: true,
        },
      },
    },
  });
  const futureByReport = new Map(
    futureSections.map((section) => [
      section.reportId,
      Object.values(section._count).reduce((sum, count) => sum + count, 0),
    ]),
  );
  const published = await prisma.report.findMany({
    where: { periodStatus: "published" },
    orderBy: [{ periodStart: "asc" }, { id: "asc" }],
    select: { id: true, publishedSnapshot: true },
  });
  const [items, risks, decisions] = await Promise.all([
    prisma.item.findMany({ select: { id: true, stableId: true } }),
    prisma.risk.findMany({ select: { id: true, stableId: true } }),
    prisma.decision.findMany({ select: { id: true, stableId: true } }),
  ]);
  const stable = [...items, ...risks, ...decisions];
  const problems = [
    ...(!current || !currentSection
      ? [`current report ${current?.id ?? "none"} has no primary-Lead section`]
      : []),
    ...(currentCount === 0
      ? [`current report ${current?.id ?? "none"} has no candidate rows`]
      : []),
    ...future.flatMap(({ id }) => {
      const count = futureByReport.get(id) ?? 0;
      return count > 0
        ? []
        : [`future report ${id} has no primary-Lead candidate rows`];
    }),
    ...published.flatMap(({ id, publishedSnapshot }) =>
      hasPopulatedSnapshot(publishedSnapshot, primaryLeadId)
        ? []
        : [`published report ${id} has no populated primary-Lead snapshot`],
    ),
    ...(recordsAreStable(stable) ? [] : ["record stable identifiers drift"]),
  ];
  if (problems.length > 0) {
    throw new Error(
      `[${label}] assistant fixture coverage gap: ${problems.join("; ")}`,
    );
  }
  console.log(
    `[${label}] Assistant fixture coverage OK (${current?.id ?? "none"}, ${published.length} published, ${future.length} future).`,
  );
}

export async function stabilizeSeedRecordIdentities(
  prisma: PrismaClient,
): Promise<void> {
  const [items, risks, decisions] = await Promise.all([
    prisma.item.findMany({ select: { id: true } }),
    prisma.risk.findMany({ select: { id: true } }),
    prisma.decision.findMany({ select: { id: true } }),
  ]);
  await Promise.all([
    ...items.map(({ id }) =>
      prisma.item.update({ where: { id }, data: { stableId: id } }),
    ),
    ...risks.map(({ id }) =>
      prisma.risk.update({ where: { id }, data: { stableId: id } }),
    ),
    ...decisions.map(({ id }) =>
      prisma.decision.update({ where: { id }, data: { stableId: id } }),
    ),
  ]);
}

/**
 * Post-seed sanity check: every demo dataset must exercise the full status
 * vocabulary so the UI's status treatments are all visible out of the box —
 * every stored Progress value, both derived Alarm severities (an at-risk and
 * a blocked-severity risk), and a priority spread beyond P1. Throws (and so
 * fails the seed run loudly) when a treatment has no example.
 */
export async function assertSeedCoverage(
  prisma: PrismaClient,
  label: string,
  options: SeedCoverageOptions = {},
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
  await assertAssistantFixtureCoverage(prisma, label, options);
}
