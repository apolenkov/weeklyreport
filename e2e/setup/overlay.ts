import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, TrafficLightStatus } from "@prisma/client";
import pg from "pg";

import {
  LEAD_1,
  LEAD_MOBILE_PM,
  REPORT_ACTIVE,
} from "../../prisma/seeds/simple/seed-simple.ids.js";
import { finalizePublishedSnapshots } from "../../prisma/seeds/support/published-snapshot.js";
import { LEAD_FORM_FIXTURE, OPEN_WORK_FIXTURE } from "./fixture-data.js";
import {
  ACTIVITY_ID,
  buildOpenWorkItemData,
  createCancelledEvent,
  createCompletedEvent,
  fillSectionItemLimit,
} from "./overlay-items.js";
import {
  addExplicitNextCommitment,
  addPrivacySentinels,
  addSingleStageProduct,
} from "./overlay-product.js";
import { validateE2eRuntimeTarget } from "./runtime-target.js";

const OVERLAY_SCRIPT_NAME = "e2e-fixture-overlay";

async function upsertActivityStatus(
  prisma: PrismaClient,
  sectionId: string,
): Promise<void> {
  await prisma.activityStatus.upsert({
    where: {
      reportSectionId_activityId: {
        reportSectionId: sectionId,
        activityId: ACTIVITY_ID,
      },
    },
    create: {
      reportSectionId: sectionId,
      activityId: ACTIVITY_ID,
      status: TrafficLightStatus.green,
    },
    update: { status: TrafficLightStatus.green },
  });
}

export async function applyE2eFixtureOverlay(
  scenario?: "section-item-limit",
): Promise<void> {
  const target = validateE2eRuntimeTarget(OVERLAY_SCRIPT_NAME);
  const pool = new pg.Pool({ connectionString: target.e2eDatabaseUrl });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const [ownSection, foreignSection, archiveSection] = await Promise.all([
      prisma.reportSection.findUniqueOrThrow({
        where: {
          reportId_authorId: { reportId: REPORT_ACTIVE, authorId: LEAD_1 },
        },
      }),
      prisma.reportSection.findUniqueOrThrow({
        where: {
          reportId_authorId: {
            reportId: REPORT_ACTIVE,
            authorId: LEAD_MOBILE_PM,
          },
        },
      }),
      prisma.reportSection.findUniqueOrThrow({
        where: {
          reportId_authorId: {
            reportId: OPEN_WORK_FIXTURE.archiveReportId,
            authorId: LEAD_1,
          },
        },
      }),
    ]);

    if (archiveSection.submittedAt === null) {
      throw new Error("E2E overlay: archived section submittedAt is required");
    }
    const occurredAt = archiveSection.submittedAt.toISOString();
    const actorName = LEAD_FORM_FIXTURE.leadName;

    await addExplicitNextCommitment(prisma, ownSection);
    await addPrivacySentinels(prisma, ownSection, foreignSection);
    await addSingleStageProduct(prisma, ownSection);
    await upsertActivityStatus(prisma, archiveSection.id);
    await prisma.item.createMany({
      data: buildOpenWorkItemData(archiveSection.id),
    });
    await createCancelledEvent(prisma, archiveSection, occurredAt, actorName);
    await createCompletedEvent(prisma, archiveSection, occurredAt, actorName);

    await finalizePublishedSnapshots(prisma);
    if (scenario === "section-item-limit") {
      await fillSectionItemLimit(prisma, ownSection);
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}
