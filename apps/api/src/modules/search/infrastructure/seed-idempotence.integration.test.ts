import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
} from "../../../test-utils/prisma-test-helper.js";

const execFileAsync = promisify(execFile);
const prisma = createTestPrisma();
const repoRoot = resolve(import.meta.dirname, "../../../../../..");

type SeedTier = "canonical" | "small" | "middle" | "huge";

const seed = async (tier: SeedTier): Promise<void> => {
  await execFileAsync("pnpm", [`db:seed:${tier}`], {
    cwd: repoRoot,
    env: process.env,
  });
};

const snapshot = async () =>
  Promise.all([
    prisma.report.findMany({
      select: {
        id: true,
        periodStart: true,
        periodEnd: true,
        deadline: true,
        status: true,
        periodStatus: true,
        periodState: true,
        archived: true,
        publishedAt: true,
        publishedById: true,
        publishedSnapshot: true,
      },
      orderBy: { id: "asc" },
    }),
    prisma.reportSection.findMany({
      select: {
        id: true,
        reportId: true,
        authorId: true,
        status: true,
        submittedAt: true,
      },
      orderBy: { id: "asc" },
    }),
    prisma.item.findMany({
      select: {
        id: true,
        stableId: true,
        reportSectionId: true,
        projectId: true,
        type: true,
        text: true,
        tag: true,
        workflowStatus: true,
        carriedOver: true,
        priorityRank: true,
        stageNames: true,
      },
      orderBy: { id: "asc" },
    }),
    prisma.risk.findMany({
      select: {
        id: true,
        stableId: true,
        reportSectionId: true,
        projectId: true,
        risk: true,
        impact: true,
        mitigation: true,
        severity: true,
      },
      orderBy: { id: "asc" },
    }),
    prisma.decision.findMany({
      select: {
        id: true,
        stableId: true,
        reportSectionId: true,
        productId: true,
        text: true,
      },
      orderBy: { id: "asc" },
    }),
  ]);

beforeEach(async () => {
  await cleanDatabase(prisma);
});

afterAll(async () => {
  await cleanDatabase(prisma);
  await disconnectTestPrisma();
});

describe("supported seed determinism (integration)", () => {
  it.each<readonly [SeedTier]>([
    ["canonical"],
    ["small"],
    ["middle"],
    ["huge"],
  ])(
    "keeps %s fixture identities and content stable across same-week runs",
    async (tier) => {
      await seed(tier);
      const first = await snapshot();

      await seed(tier);

      await expect(snapshot()).resolves.toEqual(first);
    },
    120_000,
  );
});
