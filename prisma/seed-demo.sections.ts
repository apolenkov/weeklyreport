// Active-period sections: one per lead, spanning all of that lead's products.

import {
  type PrismaClient,
  ReportSectionStatus,
  TrafficLightStatus,
} from "@prisma/client";

import { ACTIVE_REPORT_ID, SEED_REPORTS } from "./seed-constants.js";
import { makeRowId, makeSectionId, stageId } from "./seed-demo.ids.js";
import type { DemoSection } from "./seed-demo.types.js";

/**
 * Group per-product contributions by their owning lead. ReportSection is
 * `@@unique([reportId, authorId])`, so a lead authors exactly ONE section per
 * report — that section spans all of the lead's products.
 */
export function groupByLead(
  sections: readonly DemoSection[],
): Map<string, DemoSection[]> {
  return sections.reduce(
    (byLead, section) =>
      byLead.set(section.leadId, [
        ...(byLead.get(section.leadId) ?? []),
        section,
      ]),
    new Map<string, DemoSection[]>(),
  );
}

async function writeContributionStatuses(
  prisma: PrismaClient,
  sectionId: string,
  c: DemoSection,
): Promise<void> {
  await prisma.projectStatus.create({
    data: {
      id: makeRowId(),
      reportSectionId: sectionId,
      projectId: c.productId,
      status: c.productLight,
    },
  });
  // The first owned stage carries the product's colour; the rest stay green so
  // one product light never repaints every stage the lead owns.
  await prisma.stageStatus.createMany({
    data: c.ownedStages.map((stage, idx) => ({
      id: makeRowId(),
      reportSectionId: sectionId,
      projectId: c.productId,
      stageId: stageId(stage),
      status: idx === 0 ? c.productLight : TrafficLightStatus.green,
    })),
  });
}

async function writeContributionContent(
  prisma: PrismaClient,
  sectionId: string,
  c: DemoSection,
): Promise<void> {
  await prisma.item.createMany({
    data: c.items.map((item) => ({
      id: makeRowId(),
      reportSectionId: sectionId,
      type: item.type,
      projectId: c.productId,
      text: item.text,
      tag: item.tag,
      workflowStatus: item.status,
      carriedOver: false,
      stageNames: item.stages,
      priorityRank: item.priorityRank ?? null,
    })),
  });
  if (c.risk) {
    await prisma.risk.create({
      data: {
        id: makeRowId(),
        reportSectionId: sectionId,
        projectId: c.productId,
        risk: c.risk.risk,
        impact: c.risk.impact,
        mitigation: c.risk.mitigation,
        severity: c.risk.severity,
        stageNames: [c.risk.stage],
      },
    });
  }
  if (c.decision) {
    await prisma.decision.create({
      data: {
        id: makeRowId(),
        reportSectionId: sectionId,
        productId: c.productId,
        text: c.decision.text,
        owner: c.leadLabel,
        impact: c.decision.impact,
        stageNames: [c.decision.stage],
      },
    });
  }
}

export async function seedActiveLeadSection(
  prisma: PrismaClient,
  leadId: string,
  contributions: readonly DemoSection[],
): Promise<void> {
  const sectionId = makeSectionId();
  // A lead's single section is submitted only when EVERY contribution is.
  const allSubmitted = contributions.every(
    (c) => c.sectionStatus === ReportSectionStatus.submitted,
  );
  await prisma.reportSection.create({
    data: {
      id: sectionId,
      reportId: ACTIVE_REPORT_ID,
      authorId: leadId,
      status: allSubmitted
        ? ReportSectionStatus.submitted
        : ReportSectionStatus.draft,
      submittedAt: allSubmitted
        ? new Date(SEED_REPORTS.active.periodStart)
        : null,
    },
  });

  for (const c of contributions) {
    await writeContributionStatuses(prisma, sectionId, c);
    await writeContributionContent(prisma, sectionId, c);
  }
}
