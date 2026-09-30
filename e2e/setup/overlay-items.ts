import { createHash } from "node:crypto";

import {
  itemOutcomeEventSchema,
  itemOutcomeStateSchema,
  itemResolutionSchema,
} from "@customreport/shared";
import {
  ItemType,
  ItemWorkflowStatus,
  Prisma,
  type PrismaClient,
  type ReportSection,
} from "@prisma/client";

import { PROJECT_ACTIVITY_IDS } from "../../prisma/seeds/simple/seed-simple.activities.js";
import { LEAD_1 } from "../../prisma/seeds/simple/seed-simple.ids.js";
import { OPEN_WORK_FIXTURE } from "./fixture-data.js";

const activityId = PROJECT_ACTIVITY_IDS[0];
if (!activityId) {
  throw new Error("E2E overlay: missing Activity00 from seed constants");
}
export const ACTIVITY_ID = activityId;

const E2E_CANCELLED_ITEM_ID = "e2e00000-0000-4000-8000-000000000006";
const E2E_CANCEL_EVENT_ID = "e2e00000-0000-4000-8000-0000000000e1";
const E2E_COMPLETED_EVENT_ID = "e2e00000-0000-4000-8000-0000000000e2";

const OPEN_WORK_ITEMS = [
  {
    id: "e2e00000-0000-4000-8000-000000000001",
    text: OPEN_WORK_FIXTURE.paused,
    workflowStatus: ItemWorkflowStatus.paused,
    pausedReason: "E2E pause reason",
    type: ItemType.current,
  },
  {
    id: "e2e00000-0000-4000-8000-000000000002",
    text: OPEN_WORK_FIXTURE.deferred,
    workflowStatus: ItemWorkflowStatus.postponed,
    pausedReason: null,
    type: ItemType.current,
  },
  {
    id: "e2e00000-0000-4000-8000-000000000003",
    text: OPEN_WORK_FIXTURE.continue,
    workflowStatus: ItemWorkflowStatus.in_progress,
    pausedReason: null,
    type: ItemType.current,
  },
  {
    id: "e2e00000-0000-4000-8000-000000000004",
    text: OPEN_WORK_FIXTURE.planned,
    workflowStatus: ItemWorkflowStatus.planned,
    pausedReason: null,
    type: ItemType.next,
  },
  {
    id: "e2e00000-0000-4000-8000-000000000005",
    text: OPEN_WORK_FIXTURE.completed,
    workflowStatus: ItemWorkflowStatus.done,
    pausedReason: null,
    type: ItemType.current,
  },
  {
    id: E2E_CANCELLED_ITEM_ID,
    text: OPEN_WORK_FIXTURE.cancelled,
    workflowStatus: ItemWorkflowStatus.in_progress,
    pausedReason: null,
    type: ItemType.current,
  },
  {
    id: "e2e00000-0000-4000-8000-000000000007",
    text: OPEN_WORK_FIXTURE.automaticPaused,
    workflowStatus: ItemWorkflowStatus.planned,
    pausedReason: null,
    type: ItemType.current,
  },
] as const;

function requestHash(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function buildOpenWorkItemData(sectionId: string) {
  return OPEN_WORK_ITEMS.map((item) => ({
    id: item.id,
    stableId: item.id,
    reportSectionId: sectionId,
    activityId: ACTIVITY_ID,
    projectId: null,
    type: item.type,
    text: item.text,
    tag: "feature",
    workflowStatus: item.workflowStatus,
    carriedOver: false,
    stageNames: [],
    priorityRank: null,
    pausedReason: item.pausedReason,
    nextStepText: null,
    resolution: Prisma.DbNull,
  }));
}

async function createItemOutcomeEvent(
  prisma: PrismaClient,
  section: ReportSection,
  requestHashValue: string,
  payload: ReturnType<typeof itemOutcomeEventSchema.parse>,
): Promise<void> {
  await prisma.itemOutcomeEvent.create({
    data: {
      ...payload,
      reportSectionId: section.id,
      requestHash: requestHashValue,
      occurredAt: new Date(payload.occurredAt),
    },
  });
}

export async function createCancelledEvent(
  prisma: PrismaClient,
  section: ReportSection,
  occurredAt: string,
  actorName: string,
): Promise<void> {
  const beforeState = itemOutcomeStateSchema.parse({
    type: "current",
    workflowStatus: "in_progress",
    pausedReason: null,
    nextStepText: null,
    text: OPEN_WORK_FIXTURE.cancelled,
  });

  const resolution = itemResolutionSchema.parse({
    kind: "wont_do",
    eventId: E2E_CANCEL_EVENT_ID,
    reason: "E2E cancellation reason",
    actorId: LEAD_1,
    actorName,
    occurredAt,
    previousState: beforeState,
  });

  await prisma.item.update({
    where: { id: E2E_CANCELLED_ITEM_ID },
    data: { resolution },
  });

  await createItemOutcomeEvent(
    prisma,
    section,
    requestHash(E2E_CANCEL_EVENT_ID),
    itemOutcomeEventSchema.parse({
      id: E2E_CANCEL_EVENT_ID,
      stableId: E2E_CANCELLED_ITEM_ID,
      outcome: "wont_do",
      reason: "E2E cancellation reason",
      actorId: LEAD_1,
      actorName,
      occurredAt,
      beforeState,
      afterState: beforeState,
      reversesEventId: null,
    }),
  );
}

export async function createCompletedEvent(
  prisma: PrismaClient,
  section: ReportSection,
  occurredAt: string,
  actorName: string,
): Promise<void> {
  await createItemOutcomeEvent(
    prisma,
    section,
    requestHash(E2E_COMPLETED_EVENT_ID),
    itemOutcomeEventSchema.parse({
      id: E2E_COMPLETED_EVENT_ID,
      stableId: "e2e00000-0000-4000-8000-000000000005",
      outcome: "done",
      reason: null,
      actorId: LEAD_1,
      actorName,
      occurredAt,
      beforeState: {
        type: "current",
        workflowStatus: "in_progress",
        pausedReason: null,
        nextStepText: null,
        text: OPEN_WORK_FIXTURE.completed,
      },
      afterState: {
        type: "current",
        workflowStatus: "done",
        pausedReason: null,
        nextStepText: null,
        text: OPEN_WORK_FIXTURE.completed,
      },
      reversesEventId: null,
    }),
  );
}
