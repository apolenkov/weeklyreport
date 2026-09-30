import assert from "node:assert/strict";

import { PrismaPg } from "@prisma/adapter-pg";
import {
  ItemType,
  ItemWorkflowStatus,
  PeriodState,
  PeriodStatus,
  PrismaClient,
  ReportSectionStatus,
  ReportStatus,
  TrafficLightStatus,
} from "@prisma/client";
import pg from "pg";

import { PROD_PORTAL } from "../../prisma/seeds/demo/seed-demo.demo-cast.js";
import {
  plusDaysUTC,
  SUBMIT_DAY_OFFSET,
} from "../../prisma/seeds/simple/seed-simple.period.js";
import {
  finalizePublishedSnapshots,
  provisionalPublishedSnapshot,
} from "../../prisma/seeds/support/published-snapshot.js";
import { SEED_STAGES } from "../../prisma/seeds/support/seed-catalog.js";
import {
  HEAD_USER_ID,
  LEAD_1_ID,
} from "../../prisma/seeds/support/seed-identifiers.js";
import { SEED_REPORTS } from "../../prisma/seeds/support/seed-periods.js";
import { ARCHIVED_FILL_FIXTURE } from "./fixture-data.js";
import { validateE2eRuntimeTarget } from "./runtime-target.js";

const SCRIPT_NAME = "e2e-archived-fill-fixture";
const SECTION_ID = "e2e00000-0000-4000-8000-0000000000f1";
const ITEM_ID = "e2e00000-0000-4000-8000-0000000000f2";

async function createArchivedSource(prisma: PrismaClient): Promise<void> {
  const period = SEED_REPORTS.published;
  const stage = SEED_STAGES.find(
    ({ name }) => name === ARCHIVED_FILL_FIXTURE.stageName,
  );
  assert(stage, "Planning stage is required for the archived Fill fixture");
  const head = await prisma.user.findUniqueOrThrow({
    where: { id: HEAD_USER_ID },
  });
  const dates = {
    periodStart: new Date(period.periodStart),
    periodEnd: new Date(period.periodEnd),
    deadline: new Date(period.deadline),
    publishedAt: new Date(period.publishedAt),
  };
  await prisma.report.create({
    data: {
      id: period.id,
      ...dates,
      weekLabel: period.weekLabel,
      status: ReportStatus.published,
      periodStatus: PeriodStatus.published,
      periodState: PeriodState.archived,
      archived: true,
      autoPublished: false,
      autoArchived: false,
      reopenedAt: null,
      publishedById: head.id,
      publishedSnapshot: provisionalPublishedSnapshot({
        reportId: period.id,
        ...dates,
        publishedById: head.id,
        publishedByName: head.name,
      }),
      sections: {
        create: {
          id: SECTION_ID,
          authorId: LEAD_1_ID,
          status: ReportSectionStatus.submitted,
          submittedAt: plusDaysUTC(dates.periodStart, SUBMIT_DAY_OFFSET),
          late: false,
          projectStatuses: {
            create: {
              projectId: PROD_PORTAL,
              status: TrafficLightStatus.green,
            },
          },
          stageStatuses: {
            create: {
              projectId: PROD_PORTAL,
              stageId: stage.id,
              status: TrafficLightStatus.green,
            },
          },
          items: {
            create: {
              id: ITEM_ID,
              stableId: ARCHIVED_FILL_FIXTURE.sourceStableId,
              projectId: PROD_PORTAL,
              type: ItemType.next,
              text: ARCHIVED_FILL_FIXTURE.sourceText,
              tag: "e2e",
              workflowStatus: ItemWorkflowStatus.planned,
              stageNames: [stage.name],
            },
          },
        },
      },
    },
  });
}

export async function applyArchivedFillFixture(): Promise<void> {
  const target = validateE2eRuntimeTarget(SCRIPT_NAME);
  const pool = new pg.Pool({ connectionString: target.e2eDatabaseUrl });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    validateE2eRuntimeTarget(SCRIPT_NAME);
    await createArchivedSource(prisma);
    validateE2eRuntimeTarget(SCRIPT_NAME);
    await finalizePublishedSnapshots(prisma);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}
