import type { Prisma, PrismaClient, ReportStatus } from "@prisma/client";

import { parseSeedPublishedSnapshot } from "../support/published-snapshot.js";
import {
  SEED_PROFILE_MANIFESTS,
  type SeedCountDimension,
  type SeedProfile,
} from "./seed-profile-contract.js";
import { runProfileJourney } from "./seed-profile-journeys.js";
import {
  collectScopedSeedCounts,
  SEED_PROFILE_SCOPES,
  type SeedProfileCounts,
} from "./seed-profile-scope.js";

export interface SeedProfileSnapshot {
  readonly profile: SeedProfile;
  readonly counts: SeedProfileCounts;
  readonly userIds: readonly string[];
  readonly projectIds: readonly string[];
  readonly reportIds: readonly string[];
  readonly itemRecords: readonly SeedItemIdentity[];
  readonly riskRecords: readonly SeedRiskIdentity[];
  readonly decisionRecords: readonly SeedDecisionIdentity[];
  readonly stableText: readonly string[];
}

interface SeedRecordIdentity {
  readonly reportSectionId: string;
  readonly id: string;
  readonly stableId: string;
}

interface SeedItemIdentity extends SeedRecordIdentity {
  readonly text: string;
}

interface SeedRiskIdentity extends SeedRecordIdentity {
  readonly risk: string;
  readonly impact: string;
  readonly mitigation: string;
}

interface SeedDecisionIdentity extends SeedRecordIdentity {
  readonly text: string;
}

interface ScopedUserGroup {
  readonly id: string;
  readonly reportingGroupId: string | null;
}

interface ScopedProjectGroup {
  readonly id: string;
  readonly leadId: string;
  readonly groupProducts: readonly { readonly groupId: string }[];
}

interface ScopedReportSnapshot {
  readonly id: string;
  readonly status: ReportStatus;
  readonly publishedSnapshot: Prisma.JsonValue | null;
  readonly sections: readonly { readonly id: string }[];
}

export function assertPublishedSnapshotIntegrity(
  profile: SeedProfile,
  reports: readonly ScopedReportSnapshot[],
): void {
  const problems = reports.flatMap((report) => {
    if (report.status !== "published") return [];

    let snapshot;
    try {
      snapshot = parseSeedPublishedSnapshot(report.publishedSnapshot);
    } catch {
      return [`${report.id}: snapshot is absent or malformed`];
    }
    if (!snapshot) {
      return [`${report.id}: snapshot is absent or malformed`];
    }
    if (snapshot.reportId !== report.id) {
      return [`${report.id}: snapshot identifies report ${snapshot.reportId}`];
    }

    const liveSectionIds = report.sections
      .map(({ id }) => id)
      .sort((a, b) => a.localeCompare(b));
    const snapshotSectionIds = snapshot.sections
      .map(({ reportSectionId }) => reportSectionId)
      .sort((a, b) => a.localeCompare(b));
    return JSON.stringify(snapshotSectionIds) === JSON.stringify(liveSectionIds)
      ? []
      : [`${report.id}: snapshot sections do not match live seeded sections`];
  });

  if (problems.length > 0) {
    throw new Error(
      `Seed profile ${profile} published-snapshot integrity failed: ${problems.join("; ")}`,
    );
  }
}

export function assertProjectGroupIntegrity(
  profile: SeedProfile,
  users: readonly ScopedUserGroup[],
  projects: readonly ScopedProjectGroup[],
): void {
  const groupByUserId = new Map(
    users.map((user) => [user.id, user.reportingGroupId] as const),
  );
  const problems = projects.flatMap((project) => {
    const expectedGroupId = groupByUserId.get(project.leadId);
    const actualGroupIds = project.groupProducts.map(({ groupId }) => groupId);
    return expectedGroupId !== undefined &&
      expectedGroupId !== null &&
      actualGroupIds.length === 1 &&
      actualGroupIds[0] === expectedGroupId
      ? []
      : [
          `${project.id}: lead ${project.leadId} expects ${expectedGroupId ?? "no group"}, got ${actualGroupIds.join(",") || "no product group"}`,
        ];
  });
  if (problems.length > 0) {
    throw new Error(
      `Seed profile ${profile} product-group integrity failed: ${problems.join("; ")}`,
    );
  }
}

const COUNT_DIMENSIONS = [
  "users",
  "projects",
  "reports",
  "sections",
  "items",
] as const satisfies readonly SeedCountDimension[];

function assertCountBounds(
  profile: SeedProfile,
  counts: SeedProfileCounts,
): void {
  const bounds = SEED_PROFILE_MANIFESTS[profile].counts;
  const problems = COUNT_DIMENSIONS.flatMap((dimension) => {
    const count = counts[dimension];
    const bound = bounds[dimension];
    return count < bound.min || count > bound.max
      ? [`${dimension}=${count}, expected ${bound.min}..${bound.max}`]
      : [];
  });
  if (problems.length > 0) {
    throw new Error(
      `Seed profile ${profile} count bounds failed: ${problems.join("; ")}`,
    );
  }
}

function loadProfileRecords(prisma: PrismaClient, profile: SeedProfile) {
  const scope = SEED_PROFILE_SCOPES[profile];
  return Promise.all([
    collectScopedSeedCounts(prisma, profile),
    prisma.user.findMany({
      where: { id: { in: [...scope.userIds] } },
      orderBy: { id: "asc" },
      select: {
        id: true,
        email: true,
        name: true,
        reportingGroupId: true,
      },
    }),
    prisma.project.findMany({
      where: { id: { in: [...scope.projectIds] } },
      orderBy: { id: "asc" },
      select: {
        id: true,
        name: true,
        leadId: true,
        groupProducts: { select: { groupId: true } },
      },
    }),
    prisma.report.findMany({
      where: { id: { in: [...scope.reportIds] } },
      orderBy: { id: "asc" },
      select: {
        id: true,
        weekLabel: true,
        status: true,
        publishedSnapshot: true,
        sections: { select: { id: true } },
      },
    }),
    prisma.item.findMany({
      where: { reportSection: { reportId: { in: [...scope.reportIds] } } },
      orderBy: [{ reportSectionId: "asc" }, { stableId: "asc" }],
      select: {
        reportSectionId: true,
        id: true,
        stableId: true,
        text: true,
      },
    }),
    prisma.risk.findMany({
      where: { reportSection: { reportId: { in: [...scope.reportIds] } } },
      orderBy: [{ reportSectionId: "asc" }, { stableId: "asc" }],
      select: {
        reportSectionId: true,
        id: true,
        stableId: true,
        risk: true,
        impact: true,
        mitigation: true,
      },
    }),
    prisma.decision.findMany({
      where: { reportSection: { reportId: { in: [...scope.reportIds] } } },
      orderBy: [{ reportSectionId: "asc" }, { stableId: "asc" }],
      select: { reportSectionId: true, id: true, stableId: true, text: true },
    }),
  ]);
}

export async function validateSeedProfile(
  prisma: PrismaClient,
  profile: SeedProfile,
): Promise<SeedProfileSnapshot> {
  const [
    counts,
    users,
    projects,
    reports,
    itemRecords,
    riskRecords,
    decisionRecords,
  ] = await loadProfileRecords(prisma, profile);

  assertCountBounds(profile, counts);
  assertProjectGroupIntegrity(profile, users, projects);
  assertPublishedSnapshotIntegrity(profile, reports);
  await runProfileJourney(prisma, profile);

  return {
    profile,
    counts,
    userIds: users.map(({ id }) => id),
    projectIds: projects.map(({ id }) => id),
    reportIds: reports.map(({ id }) => id),
    itemRecords,
    riskRecords,
    decisionRecords,
    stableText: [
      ...users.flatMap(({ email, name }) => [email, name]),
      ...projects.map(({ name }) => name),
      ...reports.map(({ weekLabel }) => weekLabel ?? ""),
    ],
  };
}
