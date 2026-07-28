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
  readonly stableText: readonly string[];
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
  const [counts, users, projects, reports] = await Promise.all([
    collectScopedSeedCounts(prisma, profile),
    prisma.user.findMany({
      where: { id: { in: [...scope.userIds] } },
      orderBy: { id: "asc" },
      select: { id: true, email: true, name: true },
    }),
    prisma.project.findMany({
      where: { id: { in: [...scope.projectIds] } },
      orderBy: { id: "asc" },
      select: { id: true, name: true },
    }),
    prisma.report.findMany({
      where: { id: { in: [...scope.reportIds] } },
      orderBy: { id: "asc" },
      select: { id: true, weekLabel: true },
    }),
  ]);

  assertCountBounds(profile, counts);
  await runProfileJourney(prisma, profile);

  return {
    profile,
    counts,
    userIds: users.map(({ id }) => id),
    projectIds: projects.map(({ id }) => id),
    reportIds: reports.map(({ id }) => id),
    stableText: [
      ...users.flatMap(({ email, name }) => [email, name]),
      ...projects.map(({ name }) => name),
      ...reports.map(({ weekLabel }) => weekLabel ?? ""),
    ],
  };
}
