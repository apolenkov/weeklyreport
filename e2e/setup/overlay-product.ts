import {
  ItemType,
  ItemWorkflowStatus,
  type PrismaClient,
  type ReportSection,
  TrafficLightStatus,
} from "@prisma/client";

import {
  DEFAULT_REPORTING_GROUP_ID,
  HEAD_ID,
  LEAD_1,
  PROD_CRM_DATA,
  STAGE_DEV,
} from "../../prisma/seeds/simple/seed-simple.ids.js";
import { LEAD_FORM_FIXTURE } from "./fixture-data.js";

const E2E_PRODUCT_ID = "e2e00000-0000-4000-8000-0000000000a1";
const E2E_GROUP_PRODUCT_ID = "e2e00000-0000-4000-8000-0000000000a2";
const E2E_STAGE_ASSIGNMENT_ID = "e2e00000-0000-4000-8000-0000000000a3";
const E2E_PROJECT_STATUS_ID = "e2e00000-0000-4000-8000-0000000000a4";
const E2E_STAGE_STATUS_ID = "e2e00000-0000-4000-8000-0000000000a5";

const E2E_FOREIGN_COMMENT_ID = "e2e00000-0000-4000-8000-0000000000c1";
const E2E_OWN_COMMENT_ID = "e2e00000-0000-4000-8000-0000000000c2";

export async function addExplicitNextCommitment(
  prisma: PrismaClient,
  section: ReportSection,
): Promise<void> {
  const carriedItem = await prisma.item.findFirst({
    where: {
      reportSectionId: section.id,
      text: LEAD_FORM_FIXTURE.carriedText,
      type: ItemType.current,
    },
  });
  if (
    carriedItem?.projectId !== PROD_CRM_DATA ||
    carriedItem.workflowStatus !== ItemWorkflowStatus.in_progress ||
    !carriedItem.carriedOver ||
    carriedItem.nextStepText !== null ||
    carriedItem.resolution !== null
  ) {
    throw new Error("E2E overlay: carried Current item baseline is invalid");
  }

  await prisma.item.update({
    where: { id: carriedItem.id },
    data: { nextStepText: LEAD_FORM_FIXTURE.explicitNextText },
  });
}

export async function addPrivacySentinels(
  prisma: PrismaClient,
  ownSection: ReportSection,
  foreignSection: ReportSection,
): Promise<void> {
  const foreignItem = await prisma.item.findFirst({
    where: {
      reportSectionId: foreignSection.id,
      text: LEAD_FORM_FIXTURE.foreignText,
    },
  });
  if (!foreignItem) {
    throw new Error("E2E overlay: foreign privacy item not found");
  }

  await prisma.item.update({
    where: { id: foreignItem.id },
    data: {
      workflowStatus: ItemWorkflowStatus.paused,
      pausedReason: LEAD_FORM_FIXTURE.privateStrings.pausedReason,
    },
  });

  await prisma.recordComment.create({
    data: {
      id: E2E_FOREIGN_COMMENT_ID,
      reviewerId: HEAD_ID,
      text: LEAD_FORM_FIXTURE.privateStrings.headComment,
      itemId: foreignItem.id,
    },
  });

  const ownItem = await prisma.item.findFirst({
    where: {
      reportSectionId: ownSection.id,
      text: LEAD_FORM_FIXTURE.currentText,
    },
  });
  if (!ownItem) {
    throw new Error("E2E overlay: own current item not found");
  }

  await prisma.recordComment.create({
    data: {
      id: E2E_OWN_COMMENT_ID,
      reviewerId: HEAD_ID,
      text: LEAD_FORM_FIXTURE.ownReviewComment,
      itemId: ownItem.id,
    },
  });
}

export async function addSingleStageProduct(
  prisma: PrismaClient,
  section: ReportSection,
): Promise<void> {
  await prisma.project.create({
    data: {
      id: E2E_PRODUCT_ID,
      name: LEAD_FORM_FIXTURE.singleStageProductName,
      archived: false,
      leadId: LEAD_1,
    },
  });

  await prisma.groupProduct.create({
    data: {
      id: E2E_GROUP_PRODUCT_ID,
      groupId: DEFAULT_REPORTING_GROUP_ID,
      productId: E2E_PRODUCT_ID,
    },
  });

  await prisma.stageAssignment.create({
    data: {
      id: E2E_STAGE_ASSIGNMENT_ID,
      userId: LEAD_1,
      stageId: STAGE_DEV,
      projectId: E2E_PRODUCT_ID,
    },
  });

  await prisma.projectStatus.create({
    data: {
      id: E2E_PROJECT_STATUS_ID,
      reportSectionId: section.id,
      projectId: E2E_PRODUCT_ID,
      status: TrafficLightStatus.green,
    },
  });

  await prisma.stageStatus.create({
    data: {
      id: E2E_STAGE_STATUS_ID,
      reportSectionId: section.id,
      projectId: E2E_PRODUCT_ID,
      stageId: STAGE_DEV,
      status: TrafficLightStatus.green,
    },
  });
}
