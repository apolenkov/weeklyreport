import {
  type AdminUpdatePeriodManualResult,
  adminUpdatePeriodManualResultSchema,
  type AppSettings,
  MS_PER_DAY,
  MS_PER_HOUR,
  type PeriodListBucket,
  type PeriodListItem,
  periodListItemSchema,
  type PeriodState,
  type ReportSectionStatus,
} from "@customreport/shared";

import {
  AdminAccessError,
  type PeriodRowFromRepo,
  type ReopenRequestRow,
} from "./admin-shared";

/** Length of an ISO calendar date (`YYYY-MM-DD`) after `toISOString().slice(0, n)`. */
const ISO_DATE_LENGTH = 10;
const DEADLINE_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export class AdminDeadlineTimeFormatError extends Error {
  constructor(deadlineTime: string) {
    super(
      `Invalid deadlineTime ${JSON.stringify(deadlineTime)}; expected HH:mm.`,
    );
    this.name = "AdminDeadlineTimeFormatError";
  }
}

/** The mutable columns of a Report's period envelope. */
export interface PeriodEnvelope {
  periodStart: Date;
  periodEnd: Date;
  deadline: Date | null;
  weekLabel: string | null;
}

/** Incoming PATCH: any subset of the envelope; a missing key means "leave as-is". */
export interface PeriodPatchInput {
  periodStart?: Date;
  periodEnd?: Date;
  deadline?: Date | null;
  weekLabel?: string | null;
}

/** The write payload — only the keys whose value actually changed. */
export type PeriodPatchData = PeriodPatchInput;

/** Per-field `(before, after)` snapshots of changed columns. */
export type PeriodPatchDiff = Partial<{
  periodStart: { from: Date; to: Date };
  periodEnd: { from: Date; to: Date };
  deadline: { from: Date | null; to: Date | null };
  weekLabel: { from: string | null; to: string | null };
}>;

const dateEntry = (
  from: Date,
  to: Date | undefined,
): { from: Date; to: Date } | null =>
  to !== undefined && to.getTime() !== from.getTime() ? { from, to } : null;

// deadline: explicit `null` is an allowed value (clear — ruling F16), so the
// three-state contract mirrors `weekLabel`. Equal instants (or both null)
// drop an unchanged PATCH.
const nullableDateEntry = (
  from: Date | null,
  to: Date | null | undefined,
): { from: Date | null; to: Date | null } | null => {
  if (to === undefined) return null;
  const unchanged =
    to === null
      ? from === null
      : from !== null && to.getTime() === from.getTime();
  return unchanged ? null : { from, to };
};

// weekLabel: explicit `null` is an allowed value (clear). Structural equality
// (`null === null`, `'foo' === 'foo'`) drops an unchanged-label PATCH.
const labelEntry = (
  from: string | null,
  to: string | null | undefined,
): { from: string | null; to: string | null } | null =>
  to !== undefined && to !== from ? { from, to } : null;

/**
 * Diff an incoming PATCH against the current row. Returns the `data` payload
 * carrying ONLY the keys whose new value differs from the existing row (equal-
 * value writes are dropped) plus the matching per-field `diff`. An empty `data`
 * means the input was a no-op — the caller skips the write and the audit envelope.
 * @param existing - The existing argument.
 * @param input - The input argument.
 */
export function computePeriodPatch(
  existing: PeriodEnvelope,
  input: PeriodPatchInput,
): { data: PeriodPatchData; diff: PeriodPatchDiff } {
  const start = dateEntry(existing.periodStart, input.periodStart);
  const end = dateEntry(existing.periodEnd, input.periodEnd);
  const deadline = nullableDateEntry(existing.deadline, input.deadline);
  const label = labelEntry(existing.weekLabel, input.weekLabel);

  const data: PeriodPatchData = {
    ...(start && { periodStart: start.to }),
    ...(end && { periodEnd: end.to }),
    ...(deadline && { deadline: deadline.to }),
    ...(label && { weekLabel: label.to }),
  };
  const diff: PeriodPatchDiff = {
    ...(start && { periodStart: start }),
    ...(end && { periodEnd: end }),
    ...(deadline && { deadline }),
    ...(label && { weekLabel: label }),
  };
  return { data, diff };
}

/**
 * A published period's date envelope is frozen content — reject envelope edits
 * the same way `deleteReport` rejects deleting a published period. `weekLabel`
 * (a cosmetic label) stays editable, and a non-published period is unaffected;
 * reopening reverts `periodState` to open and unblocks the edit.
 * @param periodState - The periodState argument.
 * @param data - The data argument.
 */
export function assertEnvelopeEditable(
  periodState: PeriodState,
  data: { periodStart?: Date; periodEnd?: Date; deadline?: Date | null },
): void {
  const envelopeEdit =
    data.periodStart !== undefined ||
    data.periodEnd !== undefined ||
    data.deadline !== undefined;
  if (periodState === "published" && envelopeEdit) {
    throw new AdminAccessError(
      "Cannot edit a published period's dates. Reopen it first if needed.",
    );
  }
}

/**
 * Default `periodEnd`: `periodStart + (periodLengthDays - 1)` calendar days at
 * end-of-day (23:59:59.999 UTC), so an N-day period spans N inclusive calendar
 * dates from any chosen start day.
 * @param periodStart - The periodStart argument.
 * @param periodLengthDays - The periodLengthDays argument.
 */
export const defaultPeriodEnd = (
  periodStart: Date,
  periodLengthDays: number,
): Date =>
  new Date(
    periodStart.getTime() +
      (periodLengthDays - 1) * MS_PER_DAY +
      (MS_PER_DAY - 1),
  );

/**
 * `deadlineTime` is "HH:MM"; `computeDeadline` takes an hour integer, so we strip
 * minutes (the scheduler does the same — its hardcoded `18` matches "18:00").
 * Sub-hour granularity would need both this and the scheduler updated together.
 * @param deadlineTime - The deadlineTime argument.
 */
export function deadlineHourFromSetting(deadlineTime: string): number {
  if (!DEADLINE_TIME_PATTERN.test(deadlineTime)) {
    throw new AdminDeadlineTimeFormatError(deadlineTime);
  }
  return Number(deadlineTime.slice(0, 2));
}

/**
 * Resolve the virtual buckets `'active' | 'archive'` to a concrete set of
 * `PeriodState` values. The active bucket excludes `archived` and
 * `published-out-of-reopen-window` (the published rows the UI treats as
 * effectively archived even before the auto-archiver runs); the archive
 * bucket is the inverse. Both `published` rows route to the active bucket —
 * the post-fetch `canReopen` derivation surfaces the out-of-window ones in the
 * archive section without a second query. Strict server-side bucketing, if ever
 * wanted, belongs at this seam. A concrete state passes through as itself.
 * @param bucket - The bucket argument.
 */
export function resolveBucketStates(bucket: PeriodListBucket): PeriodState[] {
  switch (bucket) {
    case "active":
      return ["scheduled", "open", "published"];
    case "archive":
      return ["archived"];
    case "scheduled":
    case "open":
    case "published":
    case "archived":
      return [bucket];
    default: {
      const _exhaustive: never = bucket;
      throw new Error(`Unknown period bucket: ${String(_exhaustive)}`);
    }
  }
}

/**
 * Derive a `PeriodListItem` from a raw repo row: `canReopen` (published, within
 * the reopen window, and policy-enabled) and `canArchive` (any not-yet-archived
 * published period — the auto-archiver handles the deferred path; manual archive
 * is the head's escape hatch) are precomputed so the UI needs no policy rules.
 * @param row - The row argument.
 * @param settings - The settings argument.
 * @param now - The now argument.
 */
export function toPeriodListItem(
  row: PeriodRowFromRepo,
  settings: Pick<AppSettings, "allowReopenAfterPublish" | "reopenWindowHours">,
  now: number,
): PeriodListItem {
  const canReopen =
    row.periodState === "published" &&
    settings.allowReopenAfterPublish &&
    row.publishedAt !== null &&
    row.publishedAt.getTime() + settings.reopenWindowHours * MS_PER_HOUR > now;
  const canArchive = row.periodState === "published" && !row.archived;
  return periodListItemSchema.parse({
    id: row.id,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    deadline: row.deadline,
    publishedAt: row.publishedAt,
    periodState: row.periodState,
    periodStatus: row.periodStatus,
    archived: row.archived,
    autoPublished: row.autoPublished,
    autoArchived: row.autoArchived,
    submittedCount: row.submittedCount,
    totalCount: row.totalCount,
    weekLabel: row.weekLabel,
    canReopen,
    canArchive,
  });
}

/**
 * Canonical `updatePeriodManual` result shape shared by the no-op and write paths.
 * @param row - The row argument.
 */
export function toUpdateManualResult(row: {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  deadline: Date | null;
  periodState: PeriodState;
  weekLabel: string | null;
}): AdminUpdatePeriodManualResult {
  return adminUpdatePeriodManualResultSchema.parse({
    periodId: row.id,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    deadline: row.deadline,
    periodState: row.periodState,
    weekLabel: row.weekLabel,
  });
}

/** Wire shape of one reopen-request row for the Admin Panel / head dashboard. */
export interface ReopenRequestListItem {
  id: string;
  reportSectionId: string;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  requestedBy: { id: string; name: string; email: string };
  reviewedBy: { id: string; name: string; email: string } | null;
  sectionStatus: ReportSectionStatus;
  report: {
    id: string;
    weekLabel: string | null;
    periodStart: string;
    periodEnd: string;
  };
}

/**
 * Serialize a repository reopen-request row to its wire shape (Date → ISO string).
 * @param row - The row argument.
 */
export function toReopenRequestListItem(
  row: ReopenRequestRow,
): ReopenRequestListItem {
  return {
    id: row.id,
    reportSectionId: row.reportSectionId,
    reason: row.reason,
    status: row.status,
    reviewNote: row.reviewNote,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    requestedBy: row.requestedBy,
    reviewedBy: row.reviewedBy,
    sectionStatus: row.sectionStatus,
    report: {
      id: row.report.id,
      weekLabel: row.report.weekLabel,
      periodStart: row.report.periodStart.toISOString(),
      periodEnd: row.report.periodEnd.toISOString(),
    },
  };
}

/**
 * Friendly overlap error pointing at the blocking row's admin-visible dates.
 * @param conflict - The conflict argument.
 */
export const overlapMessage = (conflict: {
  periodStart: Date;
  periodEnd: Date;
}): string =>
  `A period already exists for these dates: ${conflict.periodStart
    .toISOString()
    .slice(0, ISO_DATE_LENGTH)}…${conflict.periodEnd
    .toISOString()
    .slice(0, ISO_DATE_LENGTH)}.`;
