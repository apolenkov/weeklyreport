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
import { DEMO_STAGE_ASSIGNMENTS } from "./seed-simple.stages.js";

// Offset the next-week rotation within the author's available assignments.
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

function assignmentsFor(
  leadId: string,
  projectId?: string,
): typeof DEMO_STAGE_ASSIGNMENTS {
  return DEMO_STAGE_ASSIGNMENTS.filter(
    (assignment) =>
      assignment.userId === leadId &&
      (projectId === undefined || assignment.projectId === projectId),
  );
}

/**
 * The lead's assignment on the preferred product (falling back to any product),
 * so every authored row carries a stage its author owns there.
 */
export function requireAssignment(
  leadId: string,
  preferredProjectId: string,
  index: number,
): (typeof DEMO_STAGE_ASSIGNMENTS)[number] {
  const preferred = assignmentsFor(leadId, preferredProjectId);
  const candidates = preferred.length > 0 ? preferred : assignmentsFor(leadId);
  const assignment = candidates[index % candidates.length];
  if (assignment === undefined) {
    throw new Error(`No demo stage assignment found for lead ${leadId}.`);
  }
  return assignment;
}

// Vasily uses his own extra products as secondaries so his items and statuses
// reference PROD_CRM_SALES / PROD_CRM_DATA rather than another lead's product.
const secondaryProductsFor = (lead: LeadCfg): readonly string[] =>
  lead.id === LEAD_1
    ? [PROD_CRM_SALES, PROD_CRM_DATA]
    : ALL_PRODUCT_IDS.filter((p) => p !== lead.productId).slice(0, 2);

// Vasily's section covers his primary product and three auxiliary products;
// everyone else gets their primary product plus two secondaries.
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

// Keep Vasily's two populated status examples and one for every other lead;
// every row is selected from the same catalogue written as StageAssignment.
async function seedStageStatuses(
  prisma: PrismaClient,
  lead: LeadCfg,
  leadIdx: number,
  sectionId: string,
): Promise<void> {
  const ownedAssignments = assignmentsFor(lead.id, lead.productId).slice(
    0,
    lead.id === LEAD_1 ? 2 : 1,
  );
  if (ownedAssignments.length === 0) {
    throw new Error(
      `No primary-product demo stage assignment found for lead ${lead.id}.`,
    );
  }
  await prisma.stageStatus.createMany({
    data: ownedAssignments.map(({ stageId }, sIdx) => ({
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
    ...content.currentItems.map((it, idx) => {
      const preferredProjectId =
        idx === 0
          ? lead.productId
          : (secondary[(idx - 1) % secondary.length] ?? lead.productId);
      const assignment = requireAssignment(lead.id, preferredProjectId, idx);
      const stageNames =
        lead.id === LEAD_1 && idx === 0
          ? assignmentsFor(lead.id, assignment.projectId).map(
              (ownedAssignment) => ownedAssignment.stageName,
            )
          : [assignment.stageName];
      return {
        id: `a0000000-0000-4000-8000-00000005${leadIdx + 1}00${idx + 1}`,
        stableId: deterministicSeedRecordId("item", leadIdx, idx + 1),
        reportSectionId: sectionId,
        type: ItemType.current,
        projectId: assignment.projectId,
        text: it.text,
        tag: it.tag,
        workflowStatus: it.status,
        pausedReason: it.pausedReason ?? null,
        carriedOver: it.carriedOver ?? false,
        stageNames,
        priorityRank: idx < content.priorities.length ? idx + 1 : null,
      };
    }),
    ...content.nextItems.map((it, idx) => {
      const preferredProjectId =
        idx === 0
          ? lead.productId
          : (secondary[idx % secondary.length] ?? lead.productId);
      const assignment = requireAssignment(
        lead.id,
        preferredProjectId,
        idx + NEXT_ITEM_ROTATION_SHIFT,
      );
      return {
        id: `a0000000-0000-4000-8000-00000005${leadIdx + 1}01${idx + 1}`,
        stableId: deterministicSeedRecordId(
          "item",
          leadIdx,
          content.currentItems.length + idx + 1,
        ),
        reportSectionId: sectionId,
        type: ItemType.next,
        projectId: assignment.projectId,
        text: it.text,
        tag: it.tag,
        // The per-type CHECK constraint allows only planned or postponed here.
        workflowStatus: it.status ?? ItemWorkflowStatus.planned,
        carriedOver: false,
        stageNames: [assignment.stageName],
      };
    }),
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
    const assignment = requireAssignment(lead.id, lead.productId, 0);
    await prisma.risk.create({
      data: {
        id: `a0000000-0000-4000-8000-00000000090${leadIdx + 1}`,
        stableId: deterministicSeedRecordId("risk", leadIdx, 1),
        reportSectionId: sectionId,
        projectId: assignment.projectId,
        risk: content.risk.risk,
        impact: content.risk.impact,
        mitigation: content.risk.mitigation,
        severity: content.risk.severity,
        stageNames: [assignment.stageName],
      },
    });
  }
  await prisma.decision.createMany({
    data: content.decisions.map((d, dIdx) => {
      const assignment = requireAssignment(lead.id, lead.productId, dIdx);
      return {
        id: `a0000000-0000-4000-8000-0000000007${dIdx}${leadIdx + 1}`,
        stableId: deterministicSeedRecordId("decision", leadIdx, dIdx + 1),
        reportSectionId: sectionId,
        productId: assignment.projectId,
        text: d.text,
        owner: lead.name,
        impact: d.impact,
        deadline: d.deadline ?? null,
        stageNames: [assignment.stageName],
      };
    }),
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
