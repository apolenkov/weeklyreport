import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

import { finalizePublishedSnapshots } from "../../prisma/seeds/support/published-snapshot.js";
import { HEAD_USER_ID } from "../../prisma/seeds/support/seed-identifiers.js";
import { LEAD_FORM_FIXTURE, OPEN_WORK_FIXTURE } from "./fixture-data.js";
import { ACTIVITY_ID } from "./overlay-items.js";
import { validateE2eRuntimeTarget } from "./runtime-target.js";

export const RETAINED_COPY_FIXTURE = {
  riskText: "E2E retained source risk",
  decisionText: "E2E retained source decision",
  riskStableId: "e2e00000-0000-4000-8000-0000000000c1",
  decisionStableId: "e2e00000-0000-4000-8000-0000000000c2",
  comment: "E2E source-only comment",
  activityId: ACTIVITY_ID,
} as const;

async function withDatabase<T>(
  read: (prisma: PrismaClient) => Promise<T>,
): Promise<T> {
  const target = validateE2eRuntimeTarget("e2e-retained-copy");
  const masked = new URL(target.e2eDatabaseUrl);
  masked.username = "***";
  masked.password = "***";
  masked.search = "";
  masked.hash = "";
  console.info(
    `[e2e-retained-copy] PostgreSQL target: ${masked.href}; Redis DB ${target.redisDb}`,
  );
  const pool = new pg.Pool({ connectionString: target.e2eDatabaseUrl });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    return await read(prisma);
  } finally {
    try {
      await prisma.$disconnect();
    } finally {
      await pool.end();
    }
  }
}

export async function prepareRetainedCopySource(): Promise<void> {
  await withDatabase(async (prisma) => {
    const section = await prisma.reportSection.findUniqueOrThrow({
      where: {
        reportId_authorId: {
          reportId: OPEN_WORK_FIXTURE.archiveReportId,
          authorId: LEAD_FORM_FIXTURE.leadId,
        },
      },
    });
    validateE2eRuntimeTarget("e2e-retained-copy-create");
    await prisma.$transaction([
      prisma.risk.create({
        data: {
          reportSectionId: section.id,
          activityId: ACTIVITY_ID,
          stableId: RETAINED_COPY_FIXTURE.riskStableId,
          risk: RETAINED_COPY_FIXTURE.riskText,
          impact: null,
          mitigation: "Retained mitigation",
          severity: "blocked",
          stageNames: [],
          recordComments: {
            create: {
              reviewerId: HEAD_USER_ID,
              text: RETAINED_COPY_FIXTURE.comment,
            },
          },
        },
      }),
      prisma.decision.create({
        data: {
          reportSectionId: section.id,
          activityId: ACTIVITY_ID,
          stableId: RETAINED_COPY_FIXTURE.decisionStableId,
          text: RETAINED_COPY_FIXTURE.decisionText,
          impact: null,
          owner: "Historical source owner",
          resolvedAt: new Date("2026-01-01T00:00:00Z"),
          stageNames: [],
          recordComments: {
            create: {
              reviewerId: HEAD_USER_ID,
              text: RETAINED_COPY_FIXTURE.comment,
            },
          },
        },
      }),
    ]);
    // Complete the synthetic publication fixture before recording its pre-state.
    validateE2eRuntimeTarget("e2e-retained-copy-freeze");
    await finalizePublishedSnapshots(prisma);
  });
}

export function readRetainedCopyState() {
  return withDatabase(async (prisma) => {
    const source = await prisma.report.findUniqueOrThrow({
      where: { id: OPEN_WORK_FIXTURE.archiveReportId },
      select: {
        publishedSnapshot: true,
        sections: {
          where: { authorId: LEAD_FORM_FIXTURE.leadId },
          include: {
            risks: { include: { recordComments: true } },
            decisions: { include: { recordComments: true } },
          },
        },
      },
    });
    const target = await prisma.reportSection.findUniqueOrThrow({
      where: {
        reportId_authorId: {
          reportId: LEAD_FORM_FIXTURE.reportId,
          authorId: LEAD_FORM_FIXTURE.leadId,
        },
      },
      include: {
        risks: { include: { recordComments: true } },
        decisions: { include: { recordComments: true } },
      },
    });
    return { source, target };
  });
}
