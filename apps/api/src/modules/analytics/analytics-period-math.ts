import { MS_PER_DAY, type TrafficLightCell } from "@customreport/shared";

/**
 * Pure analytics helpers shared by the repository: TZ-stable date-label
 * formatting, half-open day-range bounds, the deterministic report ordering used
 * to pick a winner among reports sharing a date-label, and the project-keyed
 * aggregations. No Prisma dependency — every helper takes a minimal structural
 * shape, so all of it is independently testable.
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

interface PeriodStamped {
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
function comparePeriodThenCreated(a: PeriodStamped, b: PeriodStamped): number {
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
function laterReport<T extends PeriodStamped>(a: T, b: T): T {
  return comparePeriodThenCreated(a, b) >= 0 ? a : b;
}

/**
 * Group reports by their UTC date-only period label. Multiple reports can share
 * one label (a republished period, or two periods differing only by
 * periodStart), so callers aggregate per label instead of assuming one report
 * per label. Insertion order follows the input, so a periodEnd-ascending query
 * yields ascending labels.
 */
export function groupReportsByLabel<T extends { periodEnd: Date }>(
  reports: readonly T[],
): Map<string, T[]> {
  return reports.reduce((byLabel, report) => {
    const label = isoDateOnly(report.periodEnd);
    return byLabel.set(label, [...(byLabel.get(label) ?? []), report]);
  }, new Map<string, T[]>());
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

interface NamedProjectStatus {
  projectId: string;
  project: { name: string };
}
interface NamedSection {
  projectStatuses: NamedProjectStatus[];
}
export interface NamedReport {
  sections: NamedSection[];
}

/**
 * Project id → display name over every project-status in `reports`, first name
 * wins. `projectId`, when set, keeps only that project. Flattened rather than
 * nested-looped so the dedupe reads as one pass.
 */
export function collectProjectNames(
  reports: NamedReport[],
  projectId?: string,
): Map<string, string> {
  const statuses = reports
    .flatMap((r) => r.sections)
    .flatMap((s) => s.projectStatuses);
  const names = new Map<string, string>();
  for (const ps of statuses) {
    if (projectId && ps.projectId !== projectId) continue;
    if (!names.has(ps.projectId)) names.set(ps.projectId, ps.project.name);
  }
  return names;
}

export interface ComparisonCell {
  status: TrafficLightCell;
  risks: number;
  name: string;
}
interface ComparisonSection {
  projectStatuses: {
    projectId: string;
    status: TrafficLightCell;
    project: { name: string };
  }[];
  risks: { projectId: string | null }[];
}
export type ComparisonReport = PeriodStamped & {
  sections: ComparisonSection[];
};

// Frozen: this default is shared by reference across every "missing" cell, so a
// stray future mutation would corrupt all of them at once. Read/spread only.
export const UNKNOWN_CELL: ComparisonCell = Object.freeze({
  status: null,
  risks: 0,
  name: "Unknown",
});

/** Latest project-status wins; existing risk tally is preserved. */
function applyProjectStatuses(
  cells: Map<string, ComparisonCell>,
  section: ComparisonSection,
): void {
  for (const ps of section.projectStatuses) {
    cells.set(ps.projectId, {
      status: ps.status,
      risks: cells.get(ps.projectId)?.risks ?? 0,
      name: ps.project.name,
    });
  }
}

/** Accumulate risk counts. An activity-parented risk (null product FK) counts toward no product. */
function accumulateRisks(
  cells: Map<string, ComparisonCell>,
  section: ComparisonSection,
): void {
  for (const risk of section.risks) {
    if (!risk.projectId) continue;
    const existing = cells.get(risk.projectId) ?? UNKNOWN_CELL;
    cells.set(risk.projectId, { ...existing, risks: existing.risks + 1 });
  }
}

/**
 * Per-project status+risk cells for one comparison side. Reports are processed
 * oldest first so the latest report's status wins (deterministic tie-break)
 * while risks accumulate across every contributing report.
 */
export function collectComparisonCells(
  reports: ComparisonReport[],
): Map<string, ComparisonCell> {
  const cells = new Map<string, ComparisonCell>();
  for (const report of [...reports].sort(comparePeriodThenCreated)) {
    for (const section of report.sections) {
      applyProjectStatuses(cells, section);
      accumulateRisks(cells, section);
    }
  }
  return cells;
}
