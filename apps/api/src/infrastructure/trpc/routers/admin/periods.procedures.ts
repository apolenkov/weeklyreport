import {
  adminCreatePeriodManualSchema,
  adminUpdatePeriodManualSchema,
  periodListBucketSchema,
  reportPeriodSchema,
} from "@customreport/shared";
import { z } from "zod";

import type {
  PeriodAdminService,
  ReopenRequestAdminService,
} from "../../../../modules/admin/index.js";
import { mapDomainError } from "../../trpc.error-mapper.js";
import { adminProcedure } from "../../trpc.middleware.js";
import { createReopenRequestsProcedures } from "./reopen-requests.procedures.js";

const MAX_PERIOD_LIST_LIMIT = 200;

export interface AdminPeriodsDeps {
  periodAdminService: PeriodAdminService;
  reopenRequestAdminService: ReopenRequestAdminService;
  /**
   * Best-effort auto carry-over when a manually created period is minted open
   * (scheduled-born ones carry later at scheduled→open flip). Never rejects.
   * Optional so role-coverage fixtures with `{}` deps compile; main.ts always
   * provides it.
   */
  autoCarryOver?: (targetReportId: string) => Promise<void>;
}

export function createAdminPeriodsProcedures(deps: AdminPeriodsDeps) {
  return {
    savePeriod: adminProcedure
      .input(reportPeriodSchema)
      .mutation(async ({ input }) => {
        try {
          return await deps.periodAdminService.upsertPeriod(input);
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
    /**
     * Paginated period list for Admin → Periods. Filters by lifecycle bucket
     * (`active | archive | <PeriodState>`) via `(periodState, periodStart desc)`
     * index. Rows include server-precomputed `canReopen` / `canArchive` so the
     * UI does not need reopen-policy rules.
     */
    listPeriodsByState: adminProcedure
      .input(
        z.object({
          bucket: periodListBucketSchema,
          limit: z.number().int().min(1).max(MAX_PERIOD_LIST_LIMIT).optional(),
        }),
      )
      .query(async ({ input }) => {
        try {
          return await deps.periodAdminService.listPeriodsByState(input);
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
    /**
     * Admin escape hatch that mints a Period without waiting for the daily
     * `PeriodCreatorScheduler` (00:05 UTC cron). Fresh dev/staging DBs were
     * blocked on the cron tick before this; admins can seed a period from the
     * Periods-tab «New period» dialog. Audit envelope (`period.manual-create`)
     * is emitted from the router — same pattern as `savePolicy` /
     * `removePolicy` — so audit IO stays out of the service layer and the SIEM
     * stream gets real-user attribution (vs system+cron `auto-create`).
     */
    createPeriodManual: adminProcedure
      .input(adminCreatePeriodManualSchema)
      .mutation(async ({ ctx, input }) => {
        try {
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
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
    /**
     * In-place edit of a Period's date envelope + weekLabel. Symmetric to
     * `createPeriodManual` so the Periods-tab Edit icon reuses
     * `<CreatePeriodDialog>` in "edit" mode. Audit (`period.manual-edit`)
     * only when the diff is non-empty — service short-circuits no-ops with an
     * empty diff the router treats as "nothing to audit", keeping SIEM free
     * of empty-payload noise from no-op PATCH calls.
     */
    updatePeriodManual: adminProcedure
      .input(adminUpdatePeriodManualSchema)
      .mutation(async ({ ctx, input }) => {
        try {
          const { result, diff } =
            await deps.periodAdminService.updatePeriodManual(input);
          if (Object.keys(diff).length > 0) {
            // Date → ISO for audit payload (aggregators serialize to JSON).
            const toIso = (range: { from: Date; to: Date }) => ({
              from: range.from.toISOString(),
              to: range.to.toISOString(),
            });
            const changes = {
              ...(diff.periodStart
                ? { periodStart: toIso(diff.periodStart) }
                : {}),
              ...(diff.periodEnd ? { periodEnd: toIso(diff.periodEnd) } : {}),
              ...(diff.deadline ? { deadline: toIso(diff.deadline) } : {}),
              ...(diff.weekLabel ? { weekLabel: diff.weekLabel } : {}),
            };
            ctx.auditLogger.periodManualEdit({
              userId: ctx.session.userId,
              role: ctx.session.role,
              ip: ctx.ip,
              periodId: result.periodId,
              changes,
            });
          }
          return result;
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
    /**
     * Manual archive. Sets `archived=true` and `periodState='archived'`
     * atomically so the two-state-machine invariant is preserved.
     */
    archivePeriod: adminProcedure
      .input(z.object({ periodId: z.uuid() }))
      .mutation(async ({ input }) => {
        try {
          return await deps.periodAdminService.archivePeriod(input.periodId);
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
    /**
     * Manual un-archive — flips `archived=false` and derives next
     * `periodState` from the legacy `(status, periodStatus)` tuple at write
     * time (new state column lost the pre-archive distinction when overwritten
     * with 'archived').
     */
    unarchivePeriod: adminProcedure
      .input(z.object({ periodId: z.uuid() }))
      .mutation(async ({ input }) => {
        try {
          return await deps.periodAdminService.unarchivePeriod(input.periodId);
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
    /**
     * Delete a period (Report) and cascade-delete all child rows.
     * Guard: cannot delete published periods.
     */
    deleteReport: adminProcedure
      .input(z.object({ reportId: z.uuid() }))
      .mutation(async ({ input }) => {
        try {
          return await deps.periodAdminService.deleteReport(input.reportId);
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
    ...createReopenRequestsProcedures(deps),
  };
}
