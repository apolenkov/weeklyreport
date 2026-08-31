import { isDeepStrictEqual } from "node:util";

import {
  type AdminSnapshot,
  reminderQueuePayloadSchema,
} from "@customreport/shared";
import { Prisma } from "@prisma/client";

import { AdminSnapshotConflictError } from "../admin-errors.js";

type SnapshotExecution = AdminSnapshot["reminderExecutions"][number];
type StoredExecutionStatus = "pending" | "sending" | "sent" | "failed";

const executionStatusToStored: Record<
  SnapshotExecution["status"],
  StoredExecutionStatus
> = {
  queued: "pending",
  sending: "sending",
  sent: "sent",
  failed: "failed",
};

const isTerminal = (status: StoredExecutionStatus): boolean =>
  status === "sent" || status === "failed";

const allowedTransitions: Readonly<
  Record<StoredExecutionStatus, ReadonlySet<StoredExecutionStatus>>
> = {
  pending: new Set(["pending", "sending", "sent", "failed"]),
  sending: new Set(["sending", "sent", "failed"]),
  sent: new Set(["sent"]),
  failed: new Set(["failed"]),
};

function assertSameTimestampLifecycle(
  existingStatus: StoredExecutionStatus,
  snapshotStatus: StoredExecutionStatus,
  sameOutcome: boolean,
  executionId: string,
): void {
  if (snapshotStatus === existingStatus && sameOutcome) return;
  throw new AdminSnapshotConflictError(
    `Reminder execution ${executionId} has divergent lifecycle data at the same timestamp.`,
  );
}

function snapshotLifecycleWins(
  existing: {
    readonly status: StoredExecutionStatus;
    readonly sentAt: Date | null;
    readonly error: string | null;
    readonly updatedAt: Date;
  },
  snapshot: SnapshotExecution,
): boolean {
  const snapshotStatus = executionStatusToStored[snapshot.status];
  const sameSentAt =
    snapshot.sentAt?.getTime() === existing.sentAt?.getTime() &&
    (snapshot.sentAt !== null) === (existing.sentAt !== null);
  const sameOutcome = sameSentAt && snapshot.errorMessage === existing.error;
  const timestampDelta =
    snapshot.updatedAt.getTime() - existing.updatedAt.getTime();
  if (timestampDelta < 0) return false;
  if (timestampDelta === 0) {
    assertSameTimestampLifecycle(
      existing.status,
      snapshotStatus,
      sameOutcome,
      snapshot.id,
    );
    return false;
  }
  if (isTerminal(existing.status) && !sameOutcome) {
    throw new AdminSnapshotConflictError(
      `Reminder execution ${snapshot.id} has conflicting terminal outcome data.`,
    );
  }
  if (!allowedTransitions[existing.status].has(snapshotStatus)) {
    const conflict =
      isTerminal(existing.status) && isTerminal(snapshotStatus)
        ? "conflicting terminal states"
        : `forbidden ${existing.status} to ${snapshotStatus} recovery transition`;
    throw new AdminSnapshotConflictError(
      `Reminder execution ${snapshot.id} has ${conflict}.`,
    );
  }
  return true;
}

function assertExecutionIdentity(
  existing: {
    readonly id: string;
    readonly ruleId: string;
    readonly recipientEmail: string;
    readonly dedupeKey: string;
    readonly queuePayload: Prisma.JsonValue;
    readonly createdAt: Date;
  },
  snapshot: SnapshotExecution,
): void {
  const parsedPayload = reminderQueuePayloadSchema.safeParse(
    existing.queuePayload,
  );
  const conflict =
    existing.ruleId !== snapshot.ruleId ||
    existing.recipientEmail !== snapshot.recipientEmail ||
    existing.dedupeKey !== snapshot.dedupeKey ||
    existing.createdAt.getTime() !== snapshot.createdAt.getTime() ||
    !parsedPayload.success ||
    !isDeepStrictEqual(parsedPayload.data, snapshot.queuePayload);
  if (conflict) {
    throw new AdminSnapshotConflictError(
      `Reminder execution ${snapshot.id} conflicts with live identity or payload.`,
    );
  }
}

function assertDedupeOwnership(
  owner: { readonly id: string } | undefined,
  snapshot: SnapshotExecution,
): void {
  if (owner && owner.id !== snapshot.id) {
    throw new AdminSnapshotConflictError(
      `Reminder execution ${snapshot.id} conflicts with an existing dedupe identity.`,
    );
  }
}

async function lockExecutions(
  tx: Prisma.TransactionClient,
  executions: AdminSnapshot["reminderExecutions"],
): Promise<void> {
  const ids = executions
    .map((execution) => execution.id)
    .sort((left, right) => left.localeCompare(right));
  const dedupeKeys = executions
    .map((execution) => execution.dedupeKey)
    .sort((left, right) => left.localeCompare(right));
  await tx.$queryRaw(
    Prisma.sql`
      SELECT "id"
      FROM "ReminderExecution"
      WHERE "id" IN (${Prisma.join(ids)})
         OR "dedupeKey" IN (${Prisma.join(dedupeKeys)})
      ORDER BY "id"
      FOR UPDATE
    `,
  );
}

/** Restores exact execution identity while advancing lifecycle monotonically. */
export async function upsertReminderExecutions(
  tx: Prisma.TransactionClient,
  reminderExecutions: AdminSnapshot["reminderExecutions"],
): Promise<void> {
  if (reminderExecutions.length === 0) return;
  await lockExecutions(tx, reminderExecutions);
  const existingRows = await tx.reminderExecution.findMany({
    where: {
      OR: [
        { id: { in: reminderExecutions.map((execution) => execution.id) } },
        {
          dedupeKey: {
            in: reminderExecutions.map((execution) => execution.dedupeKey),
          },
        },
      ],
    },
  });
  const existingById = new Map(existingRows.map((row) => [row.id, row]));
  const existingByDedupe = new Map(
    existingRows.map((row) => [row.dedupeKey, row]),
  );

  for (const execution of reminderExecutions) {
    assertDedupeOwnership(existingByDedupe.get(execution.dedupeKey), execution);
    const existing = existingById.get(execution.id);
    const data = {
      ruleId: execution.ruleId,
      recipientEmail: execution.recipientEmail,
      dedupeKey: execution.dedupeKey,
      status: executionStatusToStored[execution.status],
      sentAt: execution.sentAt,
      error: execution.errorMessage,
      queuePayload: execution.queuePayload as Prisma.InputJsonValue,
      createdAt: execution.createdAt,
      updatedAt: execution.updatedAt,
    };
    if (!existing) {
      await tx.reminderExecution.create({
        data: { id: execution.id, ...data },
      });
      continue;
    }

    assertExecutionIdentity(existing, execution);
    if (!snapshotLifecycleWins(existing, execution)) continue;
    const update = await tx.reminderExecution.updateMany({
      where: {
        id: execution.id,
        status: existing.status,
        updatedAt: existing.updatedAt,
      },
      data: {
        status: data.status,
        sentAt: data.sentAt,
        error: data.error,
        updatedAt: data.updatedAt,
      },
    });
    if (update.count !== 1) {
      throw new AdminSnapshotConflictError(
        `Reminder execution ${execution.id} changed during recovery.`,
      );
    }
  }
}
