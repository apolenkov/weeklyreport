import {
  type AdminUpdatePeriodManualResult,
  adminUpdatePeriodManualResultSchema,
  type AppSettings,
  isWithinReopenWindow,
  MS_PER_DAY,
  type PeriodListBucket,
  type PeriodListItem,
  periodListItemSchema,
  type PeriodState,
} from "@customreport/shared";

import { parseDeadlineTime } from "../../lib/business-date.js";
import { AdminAccessError, type PeriodRowFromRepo } from "./admin-shared";

// Length of an ISO calendar date (`YYYY-MM-DD`) after toISOString().slice(0, n).
const ISO_DATE_LENGTH = 10;

export class AdminDeadlineTimeFormatError extends Error {
  constructor(deadlineTime: string) {
    super(
      `Invalid deadlineTime ${JSON.stringify(deadlineTime)}; expected HH:mm.`,
    );
    this.name = "AdminDeadlineTimeFormatError";
  }
}

// The mutable columns of a Report's period envelope.
export interface PeriodEnvelope {
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly deadline: Date | null;
  readonly weekLabel: string | null;
}

// Incoming PATCH: any subset of the envelope; a missing key means "leave as-is".
export interface PeriodPatchInput {
  readonly periodStart?: Date;
  readonly periodEnd?: Date;
  readonly deadline?: Date | null;
  readonly weekLabel?: string | null;
}

// The write payload — only the keys whose value actually changed.
export type PeriodPatchData = PeriodPatchInput;

// Per-field (before, after) snapshots of changed columns.
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

// deadline: explicit `null` is an allowed value, so the three-state contract
// mirrors `weekLabel`. Equal instants (or both null) drop an unchanged PATCH.
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

// Diff an incoming PATCH against the current row: `data` carries only keys
// whose new value differs (equal-value writes drop), plus the per-field `diff`.
// An empty `data` is a no-op — the caller skips the write and the audit envelope.
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

// A published period's date envelope is frozen content — reject envelope edits
// like `deleteReport` rejects deleting a published period. `weekLabel` stays
// editable; reopening reverts `periodState` to open and unblocks the edit.
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

// Default `periodEnd`: periodStart + (periodLengthDays - 1) calendar days at
// end-of-day UTC, so an N-day period spans N inclusive calendar dates.
export const defaultPeriodEnd = (
  periodStart: Date,
  periodLengthDays: number,
): Date =>
  new Date(
    periodStart.getTime() +
      (periodLengthDays - 1) * MS_PER_DAY +
      (MS_PER_DAY - 1),
  );

export function deadlineTimeFromSetting(deadlineTime: string): {
  readonly hour: number;
  readonly minute: number;
} {
  try {
    return parseDeadlineTime(deadlineTime);
  } catch {
    throw new AdminDeadlineTimeFormatError(deadlineTime);
  }
}

// Resolve the virtual buckets `'active' | 'archive'` to concrete `PeriodState`
// values: active excludes `archived` + published-out-of-window rows (surfaced
// via post-fetch `canReopen`), archive is the inverse.
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

// Derive `canReopen` (published, within window, policy-enabled) and
// `canArchive` (any not-yet-archived published period) from a raw row, so the
// UI needs no policy rules.
export function toPeriodListItem(
  row: PeriodRowFromRepo,
  settings: Pick<AppSettings, "allowReopenAfterPublish" | "reopenWindowHours">,
  now: number,
): PeriodListItem {
  const canReopen =
    row.periodState === "published" &&
    settings.allowReopenAfterPublish &&
    row.publishedAt !== null &&
    isWithinReopenWindow(settings.reopenWindowHours, row.publishedAt, now);
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

// Canonical result shape shared by updatePeriodManual's no-op and write paths.
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

export const overlapMessage = (conflict: {
  periodStart: Date;
  periodEnd: Date;
}): string =>
  `A period already exists for these dates: ${conflict.periodStart
    .toISOString()
    .slice(0, ISO_DATE_LENGTH)}…${conflict.periodEnd
    .toISOString()
    .slice(0, ISO_DATE_LENGTH)}.`;
