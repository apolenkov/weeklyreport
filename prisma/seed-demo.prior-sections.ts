// One submitted prior-period section per lead so the published head view,
// archived history, and period switching have non-empty content (one done item
// per product).

import {
  ItemType,
  ItemWorkflowStatus,
  type PrismaClient,
  ReportSectionStatus,
  TrafficLightStatus,
} from "@prisma/client";

import { MAX_RANKED_PRODUCTS } from "./seed-demo.constants.js";
import { makeRowId, makeSectionId } from "./seed-demo.ids.js";
import type { DemoSection } from "./seed-demo.types.js";

const FALLBACK_STAGE = "Development";

async function writePriorContribution(
  prisma: PrismaClient,
  sectionId: string,
  index: number,
  c: DemoSection,
  productNames: ReadonlyMap<string, string>,
): Promise<void> {
  await prisma.projectStatus.create({
    data: {
      id: makeRowId(),
      reportSectionId: sectionId,
      projectId: c.productId,
      status: TrafficLightStatus.green,
    },
  });
  await prisma.item.create({
    data: {
      id: makeRowId(),
      reportSectionId: sectionId,
      type: ItemType.current,
      projectId: c.productId,
      text: `Закрыли цели прошлой недели по продукту «${productNames.get(c.productId) ?? c.productId}»`,
      tag: "feature",
      workflowStatus: ItemWorkflowStatus.done,
      carriedOver: false,
      stageNames: [c.ownedStages[0] ?? FALLBACK_STAGE],
      // The prior period keeps the same P1..P3 spread as the active one instead
      // of stamping P1 on every product.
      priorityRank: index < MAX_RANKED_PRODUCTS ? index + 1 : null,
    },
  });
}

export interface PriorSectionInput {
  reportId: string;
  submittedAt: Date;
  leadId: string;
  contributions: readonly DemoSection[];
  productNames: ReadonlyMap<string, string>;
}

export async function seedPriorLeadSection(
  prisma: PrismaClient,
  {
    reportId,
    submittedAt,
    leadId,
    contributions,
    productNames,
  }: PriorSectionInput,
): Promise<void> {
  const sectionId = makeSectionId();
  await prisma.reportSection.create({
    data: {
      id: sectionId,
      reportId,
      authorId: leadId,
      status: ReportSectionStatus.submitted,
      submittedAt,
    },
  });
  for (const [index, c] of contributions.entries()) {
    await writePriorContribution(prisma, sectionId, index, c, productNames);
  }
}
