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
  AdminPeriodAlreadyArchivedError,
  AdminPeriodNotFoundError,
  AdminPeriodStaleStateError,
} from "./admin-shared.js";
import { periodOverlapGuarded } from "./period/overlap.js";
export { updatePeriodManual } from "./period/manual-update.js";

// Period (Report) lifecycle-transition writes for the Admin Periods tab.

// Mint a Report row with the supplied dates + initial state, mirroring
// `PeriodCreatorScheduler.runOnce`'s bare create (`status`/`periodStatus` come
// from DB defaults). Only writes the row; the caller applies reminder rules after.
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
        // Lifecycle fields (periodState + legacy status/archived tuple) come
        // from the transition builder, never hand-assembled: both draft states
        // map to a draft/false legacy tuple the schedule/open transitions produce.
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
// and writes both legacy `archived` + new `periodState` in one statement.
export async function archivePeriod(
  prisma: PrismaService,
  periodId: string,
): Promise<void> {
  const { count } = await prisma.report.updateMany({
    where: {
      id: periodId,
      archived: false,
      periodStatus: { not: "reopened" },
    },
    data: buildTransition("archive", {}),
  });
  if (count === 0) {
    throw new AdminPeriodAlreadyArchivedError(
      `Period ${periodId} can no longer be archived — it was already archived or reopened by a concurrent action.`,
    );
  }
}

// Un-archive: flips `archived=false` and derives the next `periodState` from
// the legacy `(status, periodStatus)` tuple — the only ground truth left after
// a row was set to `archived` (scheduled→open is lost; a rare edge).
export async function unarchivePeriod(
  prisma: PrismaService,
  periodId: string,
): Promise<{ nextPeriodState: PeriodState; nextPeriodStatus: PeriodStatus }> {
  return periodOverlapGuarded(() =>
    prisma.$transaction(async (tx) => {
      const row = await tx.report.findUnique({
        where: { id: periodId },
        select: {
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

      const nextPeriodState: Extract<PeriodState, "open" | "published"> =
        lifecycle.data.status === "published" ? "published" : "open";
      const { count } = await tx.report.updateMany({
        where: { id: periodId, ...lifecycle.data },
        data: buildTransition("unarchive", { nextPeriodState }),
      });
      if (count !== 1) {
        throw new AdminPeriodStaleStateError(
          "The period changed while it was being unarchived. Reload and retry.",
        );
      }
      return {
        nextPeriodState,
        nextPeriodStatus: lifecycle.data.periodStatus,
      };
    }),
  );
}
