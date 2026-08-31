import {
  ItemType,
  ItemWorkflowStatus,
  type PrismaClient,
  ReportSectionStatus,
  TrafficLightStatus,
} from "@prisma/client";

import {
  LEAD_1,
  PROD_CRM,
  PROD_CRM_360,
  PROD_CRM_DATA,
  PROD_CRM_SALES,
  REPORT_ACTIVE,
  STAGE_DEV,
  STAGE_TEST,
} from "./seed-simple.ids.js";
import { CONTENT_BY_LEAD } from "./seed-simple.lead-content.js";
import {
  ALL_PRODUCT_IDS,
  type LeadCfg,
  type LeadContent,
  LEADS,
} from "./seed-simple.leads.js";
import {
  ACTIVE_MONDAY,
  plusDaysUTC,
  SUBMIT_DAY_OFFSET,
} from "./seed-simple.period.js";

// Every Item / Risk / Decision carries a stage label so the UI has an explicit
// stage for each record. Vasily rotates across his 7-stage CRM ownership to
// exercise per-stage scoping; every other lead sits on "Development", matching
// the seeded Stage.name and their single StageAssignment.
const SEED_STAGE_ROTATION = [
  "Development",
  "Testing",
  "Design",
  "DevOps",
  "Planning",
];

// Next-week rows start further along the rotation than current-week rows so a
// lead's two lists do not land on the same stage label.
const NEXT_ITEM_ROTATION_SHIFT = 100;
const HEX_RADIX = 16;
const SEQUENCE_HEX_WIDTH = 3;
const SEED_UUID_PREFIX = "a0000000-0000-4000-8000-";

const SEED_RECORD_KIND = {
  item: "5",
  risk: "9",
  decision: "7",
} as const;

export type SeedRecordKind = keyof typeof SEED_RECORD_KIND;

// Child rows must retain the same logical identity and ordering after every
// disposable database reseed. Keep the lead and ordinal fields padded so this
// stays a valid UUID and remains lexicographically sortable within a section.
export function deterministicSeedRecordId(
  kind: SeedRecordKind,
  leadIdx: number,
  ordinal: number,
): string {
  const lead = leadIdx.toString(HEX_RADIX).padStart(2, "0");
  const sequence = ordinal
    .toString(HEX_RADIX)
    .padStart(SEQUENCE_HEX_WIDTH, "0");
  return `${SEED_UUID_PREFIX}000000${SEED_RECORD_KIND[kind]}${lead}${sequence}`;
}

const stageFor = (leadId: string, idx: number) =>
  leadId === LEAD_1
    ? (SEED_STAGE_ROTATION[idx % SEED_STAGE_ROTATION.length] ?? "Development")
    : "Development";

// Vasily uses his own extra products as secondaries so his items and statuses
// reference PROD_CRM_SALES / PROD_CRM_DATA rather than another lead's product.
const secondaryProductsFor = (lead: LeadCfg): readonly string[] =>
  lead.id === LEAD_1
    ? [PROD_CRM_SALES, PROD_CRM_DATA]
    : ALL_PRODUCT_IDS.filter((p) => p !== lead.productId).slice(0, 2);

// Vasily's section shows a ProjectStatus for all 4 of his products; everyone
// else gets their primary product plus two secondaries.
const statusProductsFor = (
  lead: LeadCfg,
  secondary: readonly string[],
): readonly string[] =>
  lead.id === LEAD_1
    ? [PROD_CRM, PROD_CRM_SALES, PROD_CRM_DATA, PROD_CRM_360]
    : [lead.productId, ...secondary];

async function seedProjectStatuses(
  prisma: PrismaClient,
  lead: LeadCfg,
  leadIdx: number,
  sectionId: string,
  products: readonly string[],
): Promise<void> {
  for (const [pIdx, productId] of products.entries()) {
    await prisma.projectStatus.create({
      data: {
        id: `a0000000-0000-4000-8000-0000000006${leadIdx + 1}${pIdx + 1}`,
        reportSectionId: sectionId,
        projectId: productId,
        status:
          productId === lead.productId
            ? lead.lightStatus
            : TrafficLightStatus.green,
      },
    });
  }
}

// Vasily owns Dev+Test on PROD_CRM; Plan/Analysis/Design belong to Boris, so
// no StageStatus rows are seeded for those here.
async function seedStageStatuses(
  prisma: PrismaClient,
  lead: LeadCfg,
  leadIdx: number,
  sectionId: string,
): Promise<void> {
  const ownedStageIds =
    lead.id === LEAD_1 ? [STAGE_DEV, STAGE_TEST] : [STAGE_DEV];
  await prisma.stageStatus.createMany({
    data: ownedStageIds.map((stageId, sIdx) => ({
      id: `a0000000-0000-4000-8000-0000000f0${leadIdx + 1}1${sIdx + 1}`,
      reportSectionId: sectionId,
      projectId: lead.productId,
      stageId,
      status: sIdx === 0 ? lead.lightStatus : TrafficLightStatus.green,
    })),
  });
}

function buildItemRows(
  lead: LeadCfg,
  content: LeadContent,
  leadIdx: number,
  sectionId: string,
  secondary: readonly string[],
) {
  return [
    ...content.currentItems.map((it, idx) => ({
      id: `a0000000-0000-4000-8000-00000005${leadIdx + 1}00${idx + 1}`,
      stableId: deterministicSeedRecordId("item", leadIdx, idx + 1),
      reportSectionId: sectionId,
      type: ItemType.current,
      projectId:
        idx === 0
          ? lead.productId
          : (secondary[(idx - 1) % secondary.length] ?? lead.productId),
      text: it.text,
      tag: it.tag,
      workflowStatus: it.status,
      pausedReason: it.pausedReason ?? null,
      carriedOver: it.carriedOver ?? false,
      stageNames: [stageFor(lead.id, idx)],
      priorityRank: idx < content.priorities.length ? idx + 1 : null,
    })),
    ...content.nextItems.map((it, idx) => ({
      id: `a0000000-0000-4000-8000-00000005${leadIdx + 1}01${idx + 1}`,
      stableId: deterministicSeedRecordId(
        "item",
        leadIdx,
        content.currentItems.length + idx + 1,
      ),
      reportSectionId: sectionId,
      type: ItemType.next,
      projectId:
        idx === 0
          ? lead.productId
          : (secondary[idx % secondary.length] ?? lead.productId),
      text: it.text,
      tag: it.tag,
      // The per-type CHECK constraint allows only planned or postponed here.
      workflowStatus: it.status ?? ItemWorkflowStatus.planned,
      carriedOver: false,
      stageNames: [stageFor(lead.id, idx + NEXT_ITEM_ROTATION_SHIFT)],
    })),
  ];
}

async function seedRiskAndDecisions(
  prisma: PrismaClient,
  lead: LeadCfg,
  content: LeadContent,
  leadIdx: number,
  sectionId: string,
): Promise<void> {
  if (content.risk) {
    await prisma.risk.create({
      data: {
        id: `a0000000-0000-4000-8000-00000000090${leadIdx + 1}`,
        stableId: deterministicSeedRecordId("risk", leadIdx, 1),
        reportSectionId: sectionId,
        projectId: lead.productId,
        risk: content.risk.risk,
        impact: content.risk.impact,
        mitigation: content.risk.mitigation,
        severity: content.risk.severity,
        stageNames: [stageFor(lead.id, 0)],
      },
    });
  }
  await prisma.decision.createMany({
    data: content.decisions.map((d, dIdx) => ({
      id: `a0000000-0000-4000-8000-0000000007${dIdx}${leadIdx + 1}`,
      stableId: deterministicSeedRecordId("decision", leadIdx, dIdx + 1),
      reportSectionId: sectionId,
      productId: lead.productId,
      text: d.text,
      owner: lead.name,
      impact: d.impact,
      deadline: d.deadline ?? null,
      stageNames: [stageFor(lead.id, dIdx)],
    })),
  });
}

async function seedLeadSection(
  prisma: PrismaClient,
  lead: LeadCfg,
  leadIdx: number,
): Promise<void> {
  const content = CONTENT_BY_LEAD.get(lead.id);
  if (!content) {
    throw new Error(`No seeded weekly content for lead ${lead.id}`);
  }
  const sectionId = `a0000000-0000-4000-8000-00000000040${(leadIdx + 1).toString(HEX_RADIX)}`;
  await prisma.reportSection.create({
    data: {
      id: sectionId,
      reportId: REPORT_ACTIVE,
      authorId: lead.id,
      status: lead.status,
      submittedAt:
        lead.status === ReportSectionStatus.submitted
          ? plusDaysUTC(ACTIVE_MONDAY, SUBMIT_DAY_OFFSET)
          : null,
    },
  });

  const secondary = secondaryProductsFor(lead);
  await seedProjectStatuses(
    prisma,
    lead,
    leadIdx,
    sectionId,
    statusProductsFor(lead, secondary),
  );
  await seedStageStatuses(prisma, lead, leadIdx, sectionId);
  await prisma.item.createMany({
    data: buildItemRows(lead, content, leadIdx, sectionId, secondary),
  });
  await seedRiskAndDecisions(prisma, lead, content, leadIdx, sectionId);
}

export async function seedActiveSections(prisma: PrismaClient): Promise<void> {
  console.log(
    "[seed-simple] Creating sections + items + risks + priorities (RU)...",
  );
  for (const [leadIdx, lead] of LEADS.entries()) {
    await seedLeadSection(prisma, lead, leadIdx);
  }
}
