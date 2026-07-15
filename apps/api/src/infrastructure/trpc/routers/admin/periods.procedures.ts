import {
  adminCreatePeriodManualSchema,
  adminUpdatePeriodManualSchema,
  periodListBucketSchema,
  reportPeriodSchema,
} from "@customreport/shared";
import { z } from "zod";

import type { AdminService } from "../../../../modules/admin/index.js";
import { mapDomainError } from "../../trpc.error-mapper.js";
import { adminProcedure, headProcedure } from "../../trpc.middleware.js";

const MAX_PERIOD_LIST_LIMIT = 200;
const MAX_REOPEN_NOTE_LENGTH = 500;

export interface AdminPeriodsDeps {
  adminService: AdminService;
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
          return await deps.adminService.upsertPeriod(input);
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
          return await deps.adminService.listPeriodsByState(input);
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
          const result = await deps.adminService.createPeriodManual(input);
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
            await deps.adminService.updatePeriodManual(input);
          if (Object.keys(diff).length > 0) {
            // Date → ISO for audit payload (aggregators serialize to JSON).
            const changes: {
              periodStart?: { from: string; to: string };
              periodEnd?: { from: string; to: string };
              deadline?: { from: string; to: string };
              weekLabel?: { from: string | null; to: string | null };
            } = {};
            if (diff.periodStart) {
              changes.periodStart = {
                from: diff.periodStart.from.toISOString(),
                to: diff.periodStart.to.toISOString(),
              };
            }
            if (diff.periodEnd) {
              changes.periodEnd = {
                from: diff.periodEnd.from.toISOString(),
                to: diff.periodEnd.to.toISOString(),
              };
            }
            if (diff.deadline) {
              changes.deadline = {
                from: diff.deadline.from.toISOString(),
                to: diff.deadline.to.toISOString(),
              };
            }
            if (diff.weekLabel) {
              changes.weekLabel = diff.weekLabel;
            }
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
          return await deps.adminService.archivePeriod(input.periodId);
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
          return await deps.adminService.unarchivePeriod(input.periodId);
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
          return await deps.adminService.deleteReport(input.reportId);
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
    // Reopen requests — Lead-initiated, Head-decided. Lead's
    // `leadForm.requestReopen` persists status=pending; head dashboard + Admin
    // "Reopen Requests" tab consume these. ADR 0008: gate is `headProcedure`
    // (head + admin), not `adminProcedure` — head ≠ admin in real deploy, and
    // reopen-decisioning is a head capability.
    listReopenRequests: headProcedure
      .input(
        z
          .object({
            status: z
              .enum(["pending", "approved", "rejected", "all"])
              .default("pending"),
          })
          .optional(),
      )
      .query(async ({ input, ctx }) => {
        try {
          return await deps.adminService.listReopenRequests({
            status: input?.status,
            session: ctx.session,
          });
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
    respondReopenRequest: headProcedure
      .input(
        z.object({
          id: z.uuid(),
          decision: z.enum(["approved", "rejected"]),
          note: z.string().max(MAX_REOPEN_NOTE_LENGTH).optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        try {
          return await deps.adminService.respondReopenRequest({
            id: input.id,
            decision: input.decision,
            note: input.note,
            decidedBy: ctx.session.userId,
            session: ctx.session,
          });
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
    pendingReopenCount: headProcedure.query(async ({ ctx }) => {
      try {
        return await deps.adminService.pendingReopenCount(ctx.session);
      } catch (error) {
        throw mapDomainError(error);
      }
    }),
  };
}
