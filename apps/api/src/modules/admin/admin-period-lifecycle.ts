import {
  currentPeriodLifecycleSchema,
  type DraftPeriodState,
  draftPeriodStateSchema,
  type PeriodState,
  type PeriodStatus,
} from "@customreport/shared";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import {
  buildTransition,
  PeriodLifecycleIntegrityError,
} from "../period/index.js";
import {
  lockAllReminderPolicies,
  pauseReminderRulesForReport,
  reconcileLockedPolicyForReport,
} from "../reminders/index.js";
import {
  AdminPeriodAlreadyArchivedError,
  AdminPeriodNotFoundError,
  AdminPeriodStaleStateError,
} from "./admin-shared.js";
import { periodOverlapGuarded } from "./period/overlap.js";
export { updatePeriodManual } from "./period/manual-update.js";

// Period (Report) lifecycle-transition writes for the Admin Periods tab.

// Create the complete scheduled/open lifecycle tuple with the supplied dates.
// The caller applies reminder rules after creating the report.
export async function createPeriodManual(
  prisma: PrismaService,
  input: {
    periodStart: Date;
    periodEnd: Date;
    deadline: Date;
    weekLabel: string | null;
    periodState: DraftPeriodState;
  },
): Promise<{
  id: string;
  periodStart: Date;
  periodEnd: Date;
  deadline: Date;
  periodState: DraftPeriodState;
}> {
  const periodState = draftPeriodStateSchema.parse(input.periodState);
  const created = await periodOverlapGuarded(() =>
    prisma.report.create({
      data: {
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        deadline: input.deadline,
        weekLabel: input.weekLabel,
        // Lifecycle fields (periodState plus the companion status/archive fields) come
        // from the transition builder, never hand-assembled: both draft states
        // map to the draft/false companion values the schedule/open transitions produce.
        ...buildTransition(
          periodState === "scheduled" ? "schedule" : "open",
          {},
        ),
      },
      select: {
        id: true,
        periodStart: true,
        periodEnd: true,
        deadline: true,
        periodState: true,
      },
    }),
  );
  // The insert above always writes a deadline (creation is never
  // deadline-less); a null read-back would mean schema drift — fail loud
  // rather than widen the create contract.
  if (created.deadline === null) {
    throw new Error("Created period unexpectedly has no deadline.");
  }
  return {
    id: created.id,
    periodStart: created.periodStart,
    periodEnd: created.periodEnd,
    deadline: created.deadline,
    periodState: draftPeriodStateSchema.parse(created.periodState),
  };
}

// Manual archive: a guarded `updateMany` is mutually exclusive with a concurrent
// reopen (not-yet-archived, not-reopened rows only; zero-row match fails closed)
// and writes both the archive flag and `periodState` in one statement.
export async function archivePeriod(
  prisma: PrismaService,
  periodId: string,
): Promise<void> {
  const count = await prisma.$transaction(async (tx) => {
    await lockAllReminderPolicies(tx);
    const result = await tx.report.updateMany({
      where: {
        id: periodId,
        archived: false,
        periodStatus: { not: "reopened" },
      },
      data: buildTransition("archive", {}),
    });
    if (result.count === 1) {
      await pauseReminderRulesForReport(tx, periodId);
    }
    return result.count;
  });
  if (count === 0) {
    throw new AdminPeriodAlreadyArchivedError(
      `Period ${periodId} can no longer be archived — it was already archived or reopened by a concurrent action.`,
    );
  }
}

// Un-archive: flips `archived=false` and derives the next draft state from the
// persisted period start at the operation's exact clock instant. The archived
// marker replaces periodState, so a future draft must be scheduled again while
// an elapsed (or boundary) draft becomes open.
export async function unarchivePeriod(
  prisma: PrismaService,
  periodId: string,
  now: Date,
): Promise<{ nextPeriodState: PeriodState; nextPeriodStatus: PeriodStatus }> {
  return periodOverlapGuarded(() =>
    prisma.$transaction(async (tx) => {
      // Reminder writers share policy -> report -> rule ordering. Lock policies
      // before restoring an editable Report so no active rule can retain the
      // archived deadline or policy contract.
      const policies = await lockAllReminderPolicies(tx);
      const row = await tx.report.findUnique({
        where: { id: periodId },
        select: {
          periodStart: true,
          deadline: true,
          status: true,
          periodState: true,
          periodStatus: true,
          archived: true,
          autoPublished: true,
          autoArchived: true,
          publishedAt: true,
          publishedById: true,
          reopenedAt: true,
        },
      });
      if (!row) {
        throw new AdminPeriodNotFoundError(`Report ${periodId} not found.`);
      }

      const lifecycle = currentPeriodLifecycleSchema.safeParse(row);
      if (!lifecycle.success) throw new PeriodLifecycleIntegrityError();
      if (lifecycle.data.periodState !== "archived") {
        throw new AdminPeriodStaleStateError(
          "The period is no longer archived. Reload and retry.",
        );
      }

      const nextPeriodState: Extract<
        PeriodState,
        "open" | "published" | "scheduled"
      > =
        lifecycle.data.status === "published"
          ? "published"
          : row.periodStart.getTime() > now.getTime()
            ? "scheduled"
            : "open";
      const { count } = await tx.report.updateMany({
        where: {
          id: periodId,
          periodStart: row.periodStart,
          ...lifecycle.data,
        },
        data: buildTransition("unarchive", { nextPeriodState }),
      });
      if (count !== 1) {
        throw new AdminPeriodStaleStateError(
          "The period changed while it was being unarchived. Reload and retry.",
        );
      }
      if (nextPeriodState === "scheduled" || nextPeriodState === "open") {
        for (const policy of policies) {
          await reconcileLockedPolicyForReport(
            tx,
            policy,
            {
              id: periodId,
              deadline: row.deadline,
              periodState: nextPeriodState,
              status: lifecycle.data.status,
              periodStatus: lifecycle.data.periodStatus,
              archived: false,
            },
            now,
          );
        }
      }
      return {
        nextPeriodState,
        nextPeriodStatus: lifecycle.data.periodStatus,
      };
    }),
  );
}
