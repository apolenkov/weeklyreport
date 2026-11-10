import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import { createNullLogger } from "../../../lib/logger.js";
import { expectDefined } from "../../../test-utils/expect-defined.js";
import { createPauseGate } from "../../../test-utils/paused-prisma.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
} from "../../../test-utils/prisma-test-helper.js";
import { PeriodPrismaRepository } from "../../period/infrastructure/period.prisma-repository.js";
import { WeeklyReportPrismaRepository } from "../../weekly-report/weekly-report.prisma-repository.js";
import { SearchService } from "../application/search.service.js";
import { SearchPrismaRepository } from "./search.prisma-repository.js";

const QUERY = "observationtoken";

describe("search content and omissions share one observation (PostgreSQL)", () => {
  const prisma = createTestPrisma();
  const periods = new PeriodPrismaRepository(
    prisma as unknown as PrismaService,
    new WeeklyReportPrismaRepository(prisma as unknown as PrismaService),
  );
  let data: Awaited<ReturnType<typeof seedTestData>>;
  let riskId: string;

  const lifecycle = async () =>
    expectDefined(await periods.getReportById(data.report.id));
  const session = () => ({
    userId: data.head.id,
    email: "reviewer@test.local",
    name: "Head",
    role: "head" as const,
    reportingGroupId: data.head.reportingGroupId ?? undefined,
    viewerGroupAccess: [],
  });

  async function publish() {
    await prisma.reportSection.update({
      where: { id: data.section.id },
      data: { status: "submitted" },
    });
    await periods.publishPeriod(
      data.report.id,
      data.head.id,
      await lifecycle(),
    );
  }

  beforeEach(async () => {
    await cleanDatabase();
    data = await seedTestData(prisma);
    const risk = await prisma.risk.create({
      data: {
        reportSectionId: data.section.id,
        projectId: data.project.id,
        risk: `${QUERY} first`,
        impact: "Delay",
        mitigation: "Second vendor",
        severity: "at-risk",
        stageNames: ["Development"],
      },
    });
    riskId = risk.id;
  });

  afterAll(async () => {
    try {
      await cleanDatabase();
    } finally {
      await disconnectTestPrisma();
    }
  });

  it.each(["mine", "all", "published"] as const)(
    "does not mix %s hits with later omission totals",
    async (scope) => {
      if (scope === "published") await publish();
      const hitsRead = Promise.withResolvers<void>();
      const omissionsGate = createPauseGate();
      let statement = 0;
      const client = prisma.$extends({
        query: {
          async $queryRaw({ args, query }) {
            const current = ++statement;
            if (current === 2) await omissionsGate.pause();
            const result: unknown = await query(args);
            if (current === 1) hitsRead.resolve();
            return result;
          },
        },
      });
      const service = new SearchService(
        new SearchPrismaRepository(client as unknown as PrismaService),
        createNullLogger(),
      );
      const input = { q: QUERY, scope, limit: 20 };
      const actor =
        scope === "mine"
          ? { ...session(), userId: data.lead.id, role: "lead" as const }
          : session();
      const pending = service.query(input, actor);
      try {
        const timeout = Promise.withResolvers<never>();
        const timer = setTimeout(
          () =>
            timeout.reject(
              new Error("Search did not reach the omission barrier"),
            ),
          3000,
        );
        try {
          await Promise.race([
            Promise.all([hitsRead.promise, omissionsGate.paused]),
            pending.then(() => {
              throw new Error("Search completed without pausing");
            }),
            timeout.promise,
          ]);
        } finally {
          clearTimeout(timer);
        }
        if (scope === "published") {
          await periods.reopenPeriod(data.report.id, await lifecycle(), {
            enforceSingleReopen: false,
          });
        }
        await prisma.$transaction(async (tx) => {
          await tx.risk.update({
            where: { id: riskId },
            data: { risk: `${QUERY} second` },
          });
          const draftSection =
            scope === "mine"
              ? data.section
              : await tx.reportSection.create({
                  data: {
                    reportId: data.report.id,
                    authorId: data.head.id,
                    status: "draft",
                  },
                });
          await tx.risk.create({
            data: {
              reportSectionId: draftSection.id,
              projectId: data.project.id,
              risk: "Private new draft",
              impact: null,
              mitigation: null,
              severity: "at-risk",
              stageNames: ["Development"],
            },
          });
        });
        if (scope === "published") await publish();
        omissionsGate.release();
        const first = await pending;
        expect(first.hits.map((hit) => hit.title)).toEqual([`${QUERY} first`]);
        expect(first.omissions).toEqual({
          risks: 0,
          decisions: 0,
          unknown: false,
        });

        const next = await new SearchService(
          new SearchPrismaRepository(prisma as unknown as PrismaService),
          createNullLogger(),
        ).query(input, actor);
        expect(next.hits.map((hit) => hit.title)).toEqual([`${QUERY} second`]);
        expect(next.omissions).toEqual({
          risks: 1,
          decisions: 0,
          unknown: false,
        });
      } finally {
        omissionsGate.release();
        await Promise.allSettled([pending]);
      }
    },
  );
});
