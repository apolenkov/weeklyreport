import type { PrismaClient } from "@prisma/client";

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
  readonly itemRecords: readonly SeedRecordIdentity[];
  readonly riskRecords: readonly SeedRecordIdentity[];
  readonly decisionRecords: readonly SeedDecisionIdentity[];
  readonly stableText: readonly string[];
}

interface SeedRecordIdentity {
  readonly reportSectionId: string;
  readonly id: string;
  readonly stableId: string;
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

export async function validateSeedProfile(
  prisma: PrismaClient,
  profile: SeedProfile,
): Promise<SeedProfileSnapshot> {
  const scope = SEED_PROFILE_SCOPES[profile];
  const [
    counts,
    users,
    projects,
    reports,
    itemRecords,
    riskRecords,
    decisionRecords,
  ] = await Promise.all([
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
      select: { id: true, weekLabel: true },
    }),
    prisma.item.findMany({
      where: { reportSection: { reportId: { in: [...scope.reportIds] } } },
      orderBy: [{ reportSectionId: "asc" }, { stableId: "asc" }],
      select: { reportSectionId: true, id: true, stableId: true },
    }),
    prisma.risk.findMany({
      where: { reportSection: { reportId: { in: [...scope.reportIds] } } },
      orderBy: [{ reportSectionId: "asc" }, { stableId: "asc" }],
      select: { reportSectionId: true, id: true, stableId: true },
    }),
    prisma.decision.findMany({
      where: { reportSection: { reportId: { in: [...scope.reportIds] } } },
      orderBy: [{ reportSectionId: "asc" }, { stableId: "asc" }],
      select: { reportSectionId: true, id: true, stableId: true, text: true },
    }),
  ]);

  assertCountBounds(profile, counts);
  assertProjectGroupIntegrity(profile, users, projects);
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
