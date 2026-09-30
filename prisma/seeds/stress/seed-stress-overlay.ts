import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import {
  ItemType,
  ItemWorkflowStatus,
  PrismaClient,
  TrafficLightStatus,
} from "@prisma/client";
import pg from "pg";

import { assertE2eRuntimeDestructive } from "../../guards/_destructive-guard.js";
import { isEntrypoint } from "../../guards/_entrypoint.js";
import { requireEnv } from "../../guards/_require-env.js";
import {
  ACTIVE_REPORT_ID,
  DEFAULT_REPORTING_GROUP_ID,
  LEAD_1_ID,
  SEED_STAGES,
} from "../support/seed-constants.js";
import {
  STRESS_ID_KIND,
  STRESS_PROJECT_IDS,
  stressId,
} from "./seed-stress-ids.js";

const ITEMS_PER_STRESS_PROJECT = 3;

async function seedStressItems(
  prisma: PrismaClient,
  sectionId: string,
  {
    projectId,
    projectIndex,
  }: {
    readonly projectId: string;
    readonly projectIndex: number;
  },
  stageName: string,
): Promise<void> {
  for (const itemOffset of Array.from(
    { length: ITEMS_PER_STRESS_PROJECT },
    (_, offset) => offset + 1,
  )) {
    const itemIndex =
      (projectIndex - 1) * ITEMS_PER_STRESS_PROJECT + itemOffset;
    const itemId = stressId(STRESS_ID_KIND.item, itemIndex);
    const text = `Stress product ${projectIndex}, deterministic row ${itemOffset}`;
    const isNext = itemOffset === ITEMS_PER_STRESS_PROJECT;
    await prisma.item.upsert({
      where: { id: itemId },
      update: {
        stableId: stressId(STRESS_ID_KIND.itemStable, itemIndex),
        projectId,
        text,
        stageNames: [stageName],
      },
      create: {
        id: itemId,
        stableId: stressId(STRESS_ID_KIND.itemStable, itemIndex),
        reportSectionId: sectionId,
        projectId,
        type: isNext ? ItemType.next : ItemType.current,
        text,
        tag: "stress",
        workflowStatus: isNext
          ? ItemWorkflowStatus.planned
          : ItemWorkflowStatus.in_progress,
        stageNames: [stageName],
      },
    });
  }
}

async function seedStressProject(
  prisma: PrismaClient,
  sectionId: string,
  index: number,
): Promise<void> {
  const projectId = stressId(STRESS_ID_KIND.project, index);
  const stage = SEED_STAGES[(index - 1) % SEED_STAGES.length];
  if (!stage) throw new Error("Stress overlay requires at least one stage");
  const name = `Stress product ${index}`;

  await prisma.project.upsert({
    where: { id: projectId },
    update: { name, leadId: LEAD_1_ID },
    create: { id: projectId, name, leadId: LEAD_1_ID },
  });
  await prisma.groupProduct.upsert({
    where: { productId: projectId },
    update: { groupId: DEFAULT_REPORTING_GROUP_ID },
    create: {
      id: stressId(STRESS_ID_KIND.groupProduct, index),
      groupId: DEFAULT_REPORTING_GROUP_ID,
      productId: projectId,
    },
  });
  await prisma.stageAssignment.upsert({
    where: { stageId_projectId: { stageId: stage.id, projectId } },
    update: { userId: LEAD_1_ID },
    create: {
      id: stressId(STRESS_ID_KIND.stageAssignment, index),
      userId: LEAD_1_ID,
      stageId: stage.id,
      projectId,
    },
  });
  await prisma.projectStatus.upsert({
    where: {
      reportSectionId_projectId: { reportSectionId: sectionId, projectId },
    },
    update: { status: TrafficLightStatus.green },
    create: {
      id: stressId(STRESS_ID_KIND.projectStatus, index),
      reportSectionId: sectionId,
      projectId,
      status: TrafficLightStatus.green,
    },
  });
  await prisma.stageStatus.upsert({
    where: {
      reportSectionId_projectId_stageId: {
        reportSectionId: sectionId,
        projectId,
        stageId: stage.id,
      },
    },
    update: { status: TrafficLightStatus.green },
    create: {
      id: stressId(STRESS_ID_KIND.stageStatus, index),
      reportSectionId: sectionId,
      projectId,
      stageId: stage.id,
      status: TrafficLightStatus.green,
    },
  });
  await seedStressItems(
    prisma,
    sectionId,
    { projectId, projectIndex: index },
    stage.name,
  );
}

export async function seedStressOverlay(prisma: PrismaClient): Promise<void> {
  const section = await prisma.reportSection.findUnique({
    where: {
      reportId_authorId: {
        reportId: ACTIVE_REPORT_ID,
        authorId: LEAD_1_ID,
      },
    },
    select: { id: true },
  });
  if (!section) {
    throw new Error("Stress overlay requires the full active lead section");
  }

  for (const [offset] of STRESS_PROJECT_IDS.entries()) {
    const index = offset + 1;
    await seedStressProject(prisma, section.id, index);
  }
}

async function main(): Promise<void> {
  assertE2eRuntimeDestructive("seed-stress-overlay");
  const databaseUrl = requireEnv("DATABASE_URL");
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    await seedStressOverlay(prisma);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

if (isEntrypoint(import.meta.url)) {
  void main().catch((error: unknown) => {
    console.error("[seed-stress-overlay] Failed:", error);
    process.exitCode = 1;
  });
}
