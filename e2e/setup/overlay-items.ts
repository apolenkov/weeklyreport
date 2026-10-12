import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";

import {
  ItemType,
  ItemWorkflowStatus,
  Prisma,
  type PrismaClient,
  type ReportSection,
} from "@prisma/client";
import {
  itemOutcomeEventSchema,
  itemOutcomeStateSchema,
  itemResolutionSchema,
  MAX_RECORDS_PER_SECTION_SAVE,
} from "@weeklyreport/shared";

import { PROJECT_ACTIVITY_IDS } from "../../prisma/seeds/simple/seed-simple.activities.js";
import {
  LEAD_1,
  REPORT_ACTIVE,
} from "../../prisma/seeds/simple/seed-simple.ids.js";
import { OPEN_WORK_FIXTURE } from "./fixture-data.js";
import { validateE2eRuntimeTarget } from "./runtime-target.js";

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

export function buildSectionItemLimitData(
  sectionId: string,
  existingCount: number,
): Prisma.ItemCreateManyInput[] {
  assert(
    Number.isSafeInteger(existingCount) &&
      existingCount >= 0 &&
      existingCount <= MAX_RECORDS_PER_SECTION_SAVE,
    "E2E section item-limit baseline item count must be within the canonical cap",
  );
  return Array.from(
    { length: MAX_RECORDS_PER_SECTION_SAVE - existingCount },
    (_, index) => {
      const stableId = randomUUID();
      return {
        id: stableId,
        stableId,
        reportSectionId: sectionId,
        activityId: ACTIVITY_ID,
        projectId: null,
        type: ItemType.current,
        text: `E2E section limit filler ${index + 1}`,
        tag: "feature",
        workflowStatus: ItemWorkflowStatus.in_progress,
        carriedOver: false,
        stageNames: [],
        priorityRank: null,
        pausedReason: null,
        nextStepText: null,
        resolution: Prisma.DbNull,
      };
    },
  );
}

export async function fillSectionItemLimit(
  prisma: PrismaClient,
  section: ReportSection,
): Promise<void> {
  const scriptName = "e2e-section-item-limit";
  validateE2eRuntimeTarget(scriptName);
  assert(
    section.reportId === REPORT_ACTIVE && section.authorId === LEAD_1,
    "E2E section item-limit fixture requires the expected owning Lead section",
  );
  const where = { reportSectionId: section.id };
  const existingCount = await prisma.item.count({ where });
  const continuation = OPEN_WORK_ITEMS.find(
    ({ text }) => text === OPEN_WORK_FIXTURE.continue,
  );
  assert(continuation, "E2E historical Continue fixture is required");
  assert.equal(
    await prisma.item.count({
      where: { ...where, stableId: continuation.id },
    }),
    0,
    "E2E historical Continue work must be absent from the active owning section",
  );
  const data = buildSectionItemLimitData(section.id, existingCount);
  if (data.length > 0) {
    validateE2eRuntimeTarget(scriptName);
    const created = await prisma.item.createMany({ data });
    assert.equal(
      created.count,
      data.length,
      "E2E item-limit filler count changed",
    );
  }
  assert.equal(
    await prisma.item.count({ where }),
    MAX_RECORDS_PER_SECTION_SAVE,
    "E2E owning section must contain exactly the canonical item limit",
  );
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
