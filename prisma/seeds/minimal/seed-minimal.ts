import "dotenv/config";

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

import { assertE2eRuntimeDestructive } from "../../guards/_destructive-guard.js";
import { isEntrypoint } from "../../guards/_entrypoint.js";
import { requireEnv } from "../../guards/_require-env.js";
import { DEMO_LEADS, DEMO_PRODUCTS } from "../demo/seed-demo.demo-cast.js";
import { seedScaffold } from "../demo/seed-demo.scaffold.js";
import type { SeedDataset } from "../demo/seed-demo.types.js";
import {
  LEAD_MARIA_ID,
  SEED_REPORTS,
  SEED_STAGES,
} from "../support/seed-constants.js";
import { wipeSeedData } from "../support/wipe-seed-data.js";

const ID = {
  assignment: "f0000000-0000-4000-8000-000000000001",
  item: "f0000000-0000-4000-8000-000000000002",
  itemStable: "f0000000-0000-4000-8000-000000000003",
  projectStatus: "f0000000-0000-4000-8000-000000000004",
  section: "f0000000-0000-4000-8000-000000000005",
  stageStatus: "f0000000-0000-4000-8000-000000000006",
} as const;

const requireFirst = <T>(values: readonly T[], label: string): T => {
  const value = values[0];
  if (!value) throw new Error(`Minimal seed requires ${label}`);
  return value;
};

export async function seedMinimal(prisma: PrismaClient): Promise<void> {
  const lead = requireFirst(DEMO_LEADS, "one canonical lead");
  const nonOwnerLead = requireFirst(
    DEMO_LEADS.filter(({ id }) => id === LEAD_MARIA_ID),
    "one canonical non-owner lead",
  );
  const product = requireFirst(DEMO_PRODUCTS, "one canonical product");
  const stage = requireFirst(SEED_STAGES, "one canonical stage");
  const dataset: SeedDataset = {
    leads: [lead, nonOwnerLead],
    products: [{ ...product, leadId: lead.id }],
  };
  const active = SEED_REPORTS.active;

  console.log("[seed-minimal] Wiping existing data...");
  await wipeSeedData(prisma);
  await seedScaffold(prisma, dataset);
  await prisma.report.create({
    data: {
      id: active.id,
      periodStart: new Date(active.periodStart),
      periodEnd: new Date(active.periodEnd),
      deadline: new Date(active.deadline),
      weekLabel: active.weekLabel,
      periodStatus: PeriodStatus.open,
      status: ReportStatus.draft,
      periodState: PeriodState.open,
    },
  });
  await prisma.stageAssignment.create({
    data: {
      id: ID.assignment,
      userId: lead.id,
      stageId: stage.id,
      projectId: product.id,
    },
  });
  await prisma.reportSection.create({
    data: {
      id: ID.section,
      reportId: active.id,
      authorId: lead.id,
      status: ReportSectionStatus.draft,
    },
  });
  await prisma.projectStatus.create({
    data: {
      id: ID.projectStatus,
      reportSectionId: ID.section,
      projectId: product.id,
      status: TrafficLightStatus.green,
    },
  });
  await prisma.stageStatus.create({
    data: {
      id: ID.stageStatus,
      reportSectionId: ID.section,
      projectId: product.id,
      stageId: stage.id,
      status: TrafficLightStatus.green,
    },
  });
  await prisma.item.create({
    data: {
      id: ID.item,
      stableId: ID.itemStable,
      reportSectionId: ID.section,
      projectId: product.id,
      type: ItemType.current,
      text: "Minimal editable report item",
      tag: "smoke",
      workflowStatus: ItemWorkflowStatus.in_progress,
      stageNames: [stage.name],
    },
  });
}

async function main(): Promise<void> {
  assertE2eRuntimeDestructive("seed-minimal");
  const databaseUrl = requireEnv("DATABASE_URL");
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    await seedMinimal(prisma);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

if (isEntrypoint(import.meta.url)) {
  void main().catch((error: unknown) => {
    console.error("[seed-minimal] Failed:", error);
    process.exitCode = 1;
  });
}
