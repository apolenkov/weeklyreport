import { MS_PER_DAY, type TrafficLightCell } from "@customreport/shared";

/**
 * Pure period/date math shared by the analytics repository: TZ-stable
 * date-label formatting, half-open day-range bounds, and the deterministic
 * report ordering used to pick a winner among reports sharing a date-label.
 * No Prisma dependency — everything here is pure and independently testable.
 */

/** Length of an ISO calendar date (`YYYY-MM-DD`) after `toISOString().slice(0, n)`. */
const ISO_DATE_LENGTH = 10;

/**
 * Format a Date as the UTC date-only ISO string (YYYY-MM-DD). This is
 * TZ-stable because Date.prototype.toISOString always returns UTC.
 */
export function isoDateOnly(d: Date): string {
  return d.toISOString().slice(0, ISO_DATE_LENGTH);
}

/**
 * Start of the UTC calendar day for a `YYYY-MM-DD` label. A date-only input
 * must match a full-timestamp `periodEnd` column, so periods are matched over a
 * half-open `[startOfUtcDay, nextUtcDay)` range — the DST-free, TZ-stable way to
 * match a calendar day against a timestamp, consistent with `isoDateOnly`.
 */
export function startOfUtcDay(dateOnly: string): Date {
  return new Date(`${dateOnly}T00:00:00.000Z`);
}

/** Start of the UTC calendar day AFTER `dateOnly` (the half-open upper bound). */
export function nextUtcDay(dateOnly: string): Date {
  return new Date(startOfUtcDay(dateOnly).getTime() + MS_PER_DAY);
}

export interface PeriodStamped {
  id: string;
  periodEnd: Date;
  createdAt: Date;
}

/**
 * Total ascending order over reports: periodEnd, then createdAt, then id. The
 * id is the final tie-break so two reports sharing an identical periodEnd AND
 * an identical millisecond createdAt still order deterministically instead of
 * falling back to DB row order (non-deterministic across query plans). Default
 * code-unit string compare, locale-stable like the cache key.
 */
export function comparePeriodThenCreated(
  a: PeriodStamped,
  b: PeriodStamped,
): number {
  const byPeriod = a.periodEnd.getTime() - b.periodEnd.getTime();
  if (byPeriod !== 0) return byPeriod;
  const byCreated = a.createdAt.getTime() - b.createdAt.getTime();
  if (byCreated !== 0) return byCreated;
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

/**
 * Deterministic tie-break across reports sharing a date-label: the latest
 * `periodEnd`, then the latest `createdAt`, then the greater `id`. The most
 * recent (republished) period is authoritative for a project's status.
 */
export function laterReport<T extends PeriodStamped>(a: T, b: T): T {
  return comparePeriodThenCreated(a, b) >= 0 ? a : b;
}

interface ProjectStatusRow {
  projectId: string;
  status: TrafficLightCell;
}
interface SectionStatusRow {
  projectStatuses: ProjectStatusRow[];
}
export type LabelReport = PeriodStamped & { sections: SectionStatusRow[] };

/** First project-status entry for `projectId` in a report, or undefined. */
function findProjectStatus(
  report: LabelReport,
  projectId: string,
): ProjectStatusRow | undefined {
  for (const section of report.sections) {
    const hit = section.projectStatuses.find(
      (ps) => ps.projectId === projectId,
    );
    if (hit) return hit;
  }
  return undefined;
}

/**
 * Status a project carries in a date-label: scan every report under the label
 * that has an entry for the project and pick the winner via {@link laterReport}.
 */
export function statusForProject(
  reportsForLabel: LabelReport[],
  projectId: string,
): TrafficLightCell {
  const winner = reportsForLabel
    .filter((r) => findProjectStatus(r, projectId) !== undefined)
    .reduce<LabelReport | null>(
      (best, r) => (best === null ? r : laterReport(best, r)),
      null,
    );
  return winner ? (findProjectStatus(winner, projectId)?.status ?? null) : null;
}
