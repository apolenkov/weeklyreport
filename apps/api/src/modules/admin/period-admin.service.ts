import {
  type AdminCreatePeriodManualInput,
  type AdminCreatePeriodManualResult,
  adminCreatePeriodManualResultSchema,
  adminCreatePeriodManualSchema,
  type AdminSnapshot,
  adminSnapshotSchema,
  type AdminUpdatePeriodManualInput,
  type AdminUpdatePeriodManualResult,
  adminUpdatePeriodManualSchema,
  type AppSettings,
  appSettingsSchema,
  type PeriodListBucket,
  type PeriodListItem,
  type PeriodState,
  type ReportPeriod,
  reportPeriodSchema,
} from "@customreport/shared";

import { computeDeadline } from "../../lib/business-date.js";
import { type AppLogger, createNullLogger } from "../../lib/logger";
import { initialPeriodState } from "../period/index.js";
import {
  AdminAccessError,
  AdminPeriodNotFoundError,
  AdminPeriodOverlapError,
  type AdminRepository,
} from "./admin-shared";
import {
  assertEnvelopeEditable,
  computePeriodPatch,
  deadlineHourFromSetting,
  defaultPeriodEnd,
  overlapMessage,
  type PeriodPatchDiff,
  resolveBucketStates,
  toPeriodListItem,
  toUpdateManualResult,
} from "./period-admin.envelope.js";

const DEFAULT_PERIOD_LIST_LIMIT = 50;
const MAX_PERIOD_LIST_LIMIT = 200;

// A backwards envelope is reported through the overlap error so create and
// patch surface one message shape for an unusable range.
function assertEndNotBeforeStart(periodStart: Date, periodEnd: Date): void {
  if (periodEnd.getTime() < periodStart.getTime()) {
    throw new AdminPeriodOverlapError(
      `periodEnd (${periodEnd.toISOString()}) is before periodStart (${periodStart.toISOString()}).`,
    );
  }
}

// Manual-create defaults mirror the scheduler's date math. The order here is
// load-bearing: the envelope is resolved and validated BEFORE the deadline is
// computed, so a backwards range always surfaces as the overlap error rather
// than as whatever computeDeadline would raise first.
function resolveManualPeriodEnvelope(
  input: AdminCreatePeriodManualInput,
  settings: AppSettings,
): { periodEnd: Date; deadline: Date } {
  // Manual path accepts any start day; only the scheduler is Monday-anchored.
  const periodEnd =
    input.periodEnd ??
    defaultPeriodEnd(input.periodStart, settings.periodLengthDays);

  assertEndNotBeforeStart(input.periodStart, periodEnd);

  const deadline =
    input.deadline ??
    computeDeadline(
      input.periodStart,
      settings.defaultDeadlineDays,
      settings.workingDays,
      settings.defaultTimezone,
      deadlineHourFromSetting(settings.deadlineTime),
    );

  return { periodEnd, deadline };
}

export class PeriodAdminService {
  private readonly logger: AppLogger;

  constructor(
    private readonly repository: AdminRepository,
    logger?: AppLogger,
  ) {
    this.logger = logger ?? createNullLogger();
  }

  private async getSettings(): Promise<AppSettings> {
    return appSettingsSchema.parse(await this.repository.getSettings());
  }

  private async getSnapshot(): Promise<AdminSnapshot> {
    return adminSnapshotSchema.parse(await this.repository.getSnapshot());
  }

  async upsertPeriod(period: ReportPeriod): Promise<AdminSnapshot> {
    const parsedPeriod = reportPeriodSchema.parse(period);
    // Single-period edit never re-writes stale T0 copies of other entities.
    // Newly-created periods still trigger the post-commit applicator in the repo.
    this.logger.info("upserted period", { periodId: parsedPeriod.id });
    await this.repository.upsertPeriod(parsedPeriod);
    return this.getSnapshot();
  }

  // Server-precomputed canReopen/canArchive; hot path uses (periodState, periodStart desc).
  async listPeriodsByState(input: {
    bucket: PeriodListBucket;
    limit?: number;
  }): Promise<PeriodListItem[]> {
    const limit = Math.min(
      Math.max(input.limit ?? DEFAULT_PERIOD_LIST_LIMIT, 1),
      MAX_PERIOD_LIST_LIMIT,
    );
    const settings = await this.getSettings();
    const rows = await this.repository.listPeriodsByState({
      states: resolveBucketStates(input.bucket),
      limit,
    });

    const now = Date.now();
    return rows.map((row) => toPeriodListItem(row, settings, now));
  }

  // Flips archived + periodState together; CAS fails closed on concurrent archive.
  async archivePeriod(periodId: string): Promise<{ success: true }> {
    this.logger.info("archived period", { periodId });
    await this.repository.archivePeriod(periodId);
    return { success: true };
  }

  // Escape hatch past PeriodCreatorScheduler. Defaults mirror the scheduler's
  // date math; periodState via initialPeriodState; reminders via post-create applicator.
  async createPeriodManual(
    rawInput: AdminCreatePeriodManualInput,
    options: { now?: Date } = {},
  ): Promise<AdminCreatePeriodManualResult> {
    const input = adminCreatePeriodManualSchema.parse(rawInput);
    const settings = await this.getSettings();
    const now = options.now ?? new Date();

    const { periodEnd, deadline } = resolveManualPeriodEnvelope(
      input,
      settings,
    );

    const conflict = await this.repository.findOverlappingPeriod({
      periodStart: input.periodStart,
      periodEnd,
    });
    if (conflict) {
      throw new AdminPeriodOverlapError(overlapMessage(conflict));
    }

    const periodState = initialPeriodState(input.periodStart, now);
    const weekLabel = input.weekLabel ?? null;

    this.logger.info("creating period manually", {
      periodStart: input.periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      deadline: deadline.toISOString(),
      periodState,
    });

    const created = await this.repository.createPeriodManual(
      {
        periodStart: input.periodStart,
        periodEnd,
        deadline,
        weekLabel,
        periodState,
      },
      // Forward now so the applicator drops already-elapsed reminders on backfill.
      now,
    );

    return adminCreatePeriodManualResultSchema.parse({
      periodId: created.id,
      periodStart: created.periodStart,
      periodEnd: created.periodEnd,
      deadline: created.deadline,
      periodState: created.periodState,
    });
  }

  // True PATCH: omit = leave; weekLabel null = clear. Diff stays in the return
  // so the router can emit period.manual-edit with the actual before/after.
  async updatePeriodManual(rawInput: AdminUpdatePeriodManualInput): Promise<{
    result: AdminUpdatePeriodManualResult;
    // Empty diff means no-op (router skips audit envelope).
    diff: PeriodPatchDiff;
  }> {
    const input = adminUpdatePeriodManualSchema.parse(rawInput);

    const existing = await this.repository.readPeriodById(input.reportId);
    if (!existing) {
      throw new AdminPeriodNotFoundError(`Period ${input.reportId} not found.`);
    }

    // data carries only keys whose value differs; equal writes are dropped.
    const { data, diff } = computePeriodPatch(existing, input);

    if (Object.keys(data).length === 0) {
      // Unchanged row for cache echo; empty diff → router skips audit.
      return { result: toUpdateManualResult(existing), diff };
    }

    assertEnvelopeEditable(existing.periodState, data);

    const envelopeChanged =
      data.periodStart !== undefined || data.periodEnd !== undefined;
    if (envelopeChanged) {
      // Effective envelope (incoming where provided) so the gate matches the write.
      const effectiveStart = data.periodStart ?? existing.periodStart;
      const effectiveEnd = data.periodEnd ?? existing.periodEnd;
      assertEndNotBeforeStart(effectiveStart, effectiveEnd);
      const conflict = await this.repository.findOverlappingPeriod({
        periodStart: effectiveStart,
        periodEnd: effectiveEnd,
        excludeId: input.reportId,
      });
      if (conflict) {
        throw new AdminPeriodOverlapError(overlapMessage(conflict));
      }
    }

    this.logger.info("updating period manually", {
      periodId: input.reportId,
      changedFields: Object.keys(data),
    });

    const updated = await this.repository.updatePeriodManual({
      reportId: input.reportId,
      data,
    });

    return { result: toUpdateManualResult(updated), diff };
  }

  // next periodState is derived in the repository from the historical tuple
  // (archived column lost scheduled/open/published distinction).
  async unarchivePeriod(
    periodId: string,
  ): Promise<{ success: true; periodState: PeriodState }> {
    this.logger.info("unarchived period", { periodId });
    const result = await this.repository.unarchivePeriod(periodId);
    return { success: true, periodState: result.nextPeriodState };
  }

  // Cannot delete published; maps to FORBIDDEN via trpc.error-mapper.
  async deleteReport(reportId: string): Promise<{ success: true }> {
    const report = await this.repository.readReportForDelete(reportId);
    if (!report) {
      throw new AdminAccessError(`Report ${reportId} not found.`);
    }
    if (report.status === "published" || report.periodStatus === "published") {
      throw new AdminAccessError(
        "Cannot delete a published period. Reopen it first if needed.",
      );
    }
    this.logger.info("deleted report", { reportId });
    await this.repository.deleteReport(reportId);
    return { success: true };
  }
}
