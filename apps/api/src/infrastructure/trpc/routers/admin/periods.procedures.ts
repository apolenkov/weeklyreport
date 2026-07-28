import {
  adminCreatePeriodManualSchema,
  adminUpdatePeriodManualSchema,
  periodListBucketSchema,
} from "@customreport/shared";
import { z } from "zod";

import type {
  PeriodAdminService,
  ReopenRequestAdminService,
} from "../../../../modules/admin/index.js";
import { withDomainErrorMapping } from "../../trpc.error-mapper.js";
import { adminProcedure } from "../../trpc.middleware.js";
import { createReopenRequestsProcedures } from "./reopen-requests.procedures.js";

const MAX_PERIOD_LIST_LIMIT = 200;

export interface AdminPeriodsDeps {
  periodAdminService: PeriodAdminService;
  reopenRequestAdminService: ReopenRequestAdminService;
  // Best-effort carry-over for open-born manual periods; scheduled ones carry
  // at flip. Optional for `{}` fixtures; main.ts always provides it.
  autoCarryOver?: (targetReportId: string) => Promise<void>;
}

type PeriodPatchDiff = Awaited<
  ReturnType<PeriodAdminService["updatePeriodManual"]>
>["diff"];

// Date → ISO for audit payload (aggregators serialize to JSON).
function buildPeriodEditChanges(diff: PeriodPatchDiff) {
  const toIso = (range: { from: Date; to: Date }) => ({
    from: range.from.toISOString(),
    to: range.to.toISOString(),
  });
  // Three-state deadline: `to: null` records an explicit clear.
  const toIsoOrNull = (value: Date | null) =>
    value === null ? null : value.toISOString();
  return {
    ...(diff.periodStart ? { periodStart: toIso(diff.periodStart) } : {}),
    ...(diff.periodEnd ? { periodEnd: toIso(diff.periodEnd) } : {}),
    ...(diff.deadline
      ? {
          deadline: {
            from: toIsoOrNull(diff.deadline.from),
            to: toIsoOrNull(diff.deadline.to),
          },
        }
      : {}),
    ...(diff.weekLabel ? { weekLabel: diff.weekLabel } : {}),
  };
}

// Escape hatch past the daily cron; audit stays on the router so SIEM gets
// real-user attribution (vs system+cron auto-create).
function createManualPeriodProcedures(deps: AdminPeriodsDeps) {
  return {
    createPeriodManual: adminProcedure
      .input(adminCreatePeriodManualSchema)
      .mutation(({ ctx, input }) =>
        withDomainErrorMapping(async () => {
          const result =
            await deps.periodAdminService.createPeriodManual(input);
          ctx.auditLogger.periodManualCreate({
            userId: ctx.session.userId,
            role: ctx.session.role,
            ip: ctx.ip,
            periodId: result.periodId,
            periodStart: result.periodStart.toISOString(),
            periodEnd: result.periodEnd.toISOString(),
            deadline: result.deadline.toISOString(),
            from: null,
            to: result.periodState,
          });
          // Only an open-born period carries now; a future-dated one is
          // minted `scheduled` and the scheduler carries it at flip time.
          if (result.periodState === "open") {
            await deps.autoCarryOver?.(result.periodId);
          }
          return result;
        }),
      ),
    // Audit only on non-empty diff so no-op PATCHes stay out of SIEM.
    updatePeriodManual: adminProcedure
      .input(adminUpdatePeriodManualSchema)
      .mutation(({ ctx, input }) =>
        withDomainErrorMapping(async () => {
          const { result, diff } =
            await deps.periodAdminService.updatePeriodManual(input);
          if (Object.keys(diff).length > 0) {
            ctx.auditLogger.periodManualEdit({
              userId: ctx.session.userId,
              role: ctx.session.role,
              ip: ctx.ip,
              periodId: result.periodId,
              changes: buildPeriodEditChanges(diff),
            });
          }
          return result;
        }),
      ),
  };
}

function createPeriodLifecycleProcedures(deps: AdminPeriodsDeps) {
  return {
    // Server-precomputed canReopen/canArchive so the UI needs no policy rules.
    listPeriodsByState: adminProcedure
      .input(
        z.object({
          bucket: periodListBucketSchema,
          limit: z.number().int().min(1).max(MAX_PERIOD_LIST_LIMIT).optional(),
        }),
      )
      .query(({ input }) =>
        withDomainErrorMapping(() =>
          deps.periodAdminService.listPeriodsByState(input),
        ),
      ),
    // Atomic archived=true + periodState=archived (dual-state invariant).
    archivePeriod: adminProcedure
      .input(z.object({ periodId: z.uuid() }))
      .mutation(({ input }) =>
        withDomainErrorMapping(() =>
          deps.periodAdminService.archivePeriod(input.periodId),
        ),
      ),
    // Derive next periodState from legacy (status, periodStatus) — the new
    // column lost the pre-archive distinction when overwritten with archived.
    unarchivePeriod: adminProcedure
      .input(z.object({ periodId: z.uuid() }))
      .mutation(({ input }) =>
        withDomainErrorMapping(() =>
          deps.periodAdminService.unarchivePeriod(input.periodId),
        ),
      ),
    // Guard: published periods cannot be deleted.
    deleteReport: adminProcedure
      .input(z.object({ reportId: z.uuid() }))
      .mutation(({ input }) =>
        withDomainErrorMapping(() =>
          deps.periodAdminService.deleteReport(input.reportId),
        ),
      ),
  };
}

export function createAdminPeriodsProcedures(deps: AdminPeriodsDeps) {
  return {
    ...createPeriodLifecycleProcedures(deps),
    ...createManualPeriodProcedures(deps),
    ...createReopenRequestsProcedures(deps),
  };
}
