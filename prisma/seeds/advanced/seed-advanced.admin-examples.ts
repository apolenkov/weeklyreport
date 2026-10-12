import type { PrismaClient } from "@prisma/client";
import { ReopenRequestStatus, Role, UserActionStatus } from "@prisma/client";

import {
  HEAD_USER_ID,
  LEAD_1_ID,
  SEED_REPORTS,
} from "../support/seed-constants.js";
import { LEAD_SLOT_PRIMARY } from "./seed-advanced.anchors.js";
import { ACTIVE_SUFFIX, sectionId } from "./seed-advanced.ids.js";

const REOPEN_REQUEST_ID = "a0000000-0000-4000-8000-000000000d01";
const ACTION_LOG_ID = "a0000000-0000-4000-8000-000000000e01";
const ACTION_LOG_DURATION_MS = 91;

const REOPEN_REASON =
  "Нужно уточнить перенос работ по авторизации после комментариев head review.";

// A pending reopen request keeps Admin -> Reopen from landing empty after a
// reset; re-seeding restores it to pending, clearing any earlier review.
async function seedReopenRequest(prisma: PrismaClient): Promise<void> {
  const identity = {
    reportSectionId: sectionId(ACTIVE_SUFFIX, LEAD_SLOT_PRIMARY),
    requestedById: LEAD_1_ID,
    reason: REOPEN_REASON,
    status: ReopenRequestStatus.pending,
  };
  await prisma.reopenRequest.upsert({
    where: { id: REOPEN_REQUEST_ID },
    update: {
      ...identity,
      reviewedById: null,
      reviewedAt: null,
      reviewNote: null,
    },
    create: { id: REOPEN_REQUEST_ID, ...identity },
  });
}

// One successful publish so Admin -> Actions has a row to render.
async function seedActionLog(prisma: PrismaClient): Promise<void> {
  const fields = {
    userId: HEAD_USER_ID,
    role: Role.head,
    procedure: "period.publish",
    targetId: SEED_REPORTS.published.id,
    status: UserActionStatus.success,
    reason: null,
    ip: "127.0.0.1",
    correlationId: "seed-advanced-publish",
    durationMs: ACTION_LOG_DURATION_MS,
  };
  await prisma.userActionLog.upsert({
    where: { id: ACTION_LOG_ID },
    update: fields,
    create: { id: ACTION_LOG_ID, ...fields },
  });
}

/** Seeds the review and action rows the admin tabs read. */
export async function seedAdminExamples(
  prisma: PrismaClient,
): Promise<{ readonly reopenRequests: number; readonly actionLogs: number }> {
  await seedReopenRequest(prisma);
  await seedActionLog(prisma);
  return { reopenRequests: 1, actionLogs: 1 };
}
