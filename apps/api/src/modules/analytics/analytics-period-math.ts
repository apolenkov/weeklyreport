import {
  aggregateTrafficLight,
  MS_PER_DAY,
  type TrafficLightCell,
} from "@customreport/shared";

// ISO YYYY-MM-DD length after toISOString().slice(0, n).
const ISO_DATE_LENGTH = 10;

// TZ-stable: toISOString always returns UTC.
export function isoDateOnly(d: Date): string {
  return d.toISOString().slice(0, ISO_DATE_LENGTH);
}

// Half-open [startOfUtcDay, nextUtcDay) matches a date-only label to periodEnd.
export function startOfUtcDay(dateOnly: string): Date {
  return new Date(`${dateOnly}T00:00:00.000Z`);
}

export function nextUtcDay(dateOnly: string): Date {
  return new Date(startOfUtcDay(dateOnly).getTime() + MS_PER_DAY);
}

interface PeriodStamped {
  readonly id: string;
  readonly periodEnd: Date;
  readonly createdAt: Date;
  readonly publishedAt: Date;
}

function comparePublication(a: PeriodStamped, b: PeriodStamped): number {
  const byPublished = a.publishedAt.getTime() - b.publishedAt.getTime();
  if (byPublished !== 0) return byPublished;
  const byCreated = a.createdAt.getTime() - b.createdAt.getTime();
  if (byCreated !== 0) return byCreated;
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

// Callers admit published, non-archived reports and group them by UTC period label.
export function reportInEffectForPeriod<T extends PeriodStamped>(
  reports: readonly T[],
): T | undefined {
  return reports.reduce<T | undefined>(
    (best, report) =>
      best === undefined || comparePublication(report, best) > 0
        ? report
        : best,
    undefined,
  );
}

// Multiple reports can share a label; insertion order follows the input query.
export function groupReportsByLabel<T extends { periodEnd: Date }>(
  reports: readonly T[],
): Map<string, T[]> {
  return Map.groupBy(reports, (report) => isoDateOnly(report.periodEnd));
}

interface ProjectStatusRow {
  readonly projectId: string;
  readonly status: TrafficLightCell;
}
interface SectionStatusRow {
  readonly projectStatuses: readonly ProjectStatusRow[];
}
export type LabelReport = PeriodStamped & { sections: SectionStatusRow[] };

// A product reported by several sections takes the worst non-null status, as
// the published report does; null only when every occurrence is null.
function findProjectStatus(
  report: LabelReport,
  projectId: string,
): TrafficLightCell {
  return aggregateTrafficLight(
    report.sections
      .flatMap((section) => section.projectStatuses)
      .filter((status) => status.projectId === projectId)
      .map((status) => status.status),
  );
}

export function statusForProject(
  reportsForLabel: LabelReport[],
  projectId: string,
): TrafficLightCell {
  const winner = reportInEffectForPeriod(reportsForLabel);
  return winner ? findProjectStatus(winner, projectId) : null;
}

interface NamedProjectStatus {
  readonly projectId: string;
  readonly project: { name: string };
}
interface NamedSection {
  readonly projectStatuses: readonly NamedProjectStatus[];
}
export interface NamedReport {
  readonly sections: readonly NamedSection[];
}

// First name wins; optional projectId filters to one project.
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
  readonly status: TrafficLightCell;
  readonly risks: number;
  readonly name: string;
}
interface ComparisonSection {
  readonly projectStatuses: readonly {
    projectId: string;
    status: TrafficLightCell;
    project: { name: string };
  }[];
  readonly risks: readonly { projectId: string | null }[];
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

// Status is the worst non-null across the report's sections (as in
// statusForProject); name is the last occurrence; the running risk tally survives.
function applyProjectStatuses(
  cells: ReadonlyMap<string, ComparisonCell>,
  report: ComparisonReport,
): Map<string, ComparisonCell> {
  const occurrences = Map.groupBy(
    report.sections.flatMap((section) => section.projectStatuses),
    (ps) => ps.projectId,
  );
  return new Map<string, ComparisonCell>([
    ...cells,
    ...[...occurrences].map(([projectId, group]): [string, ComparisonCell] => [
      projectId,
      {
        status: aggregateTrafficLight(group.map((ps) => ps.status)),
        risks: cells.get(projectId)?.risks ?? 0,
        name: group.at(-1)?.project.name ?? UNKNOWN_CELL.name,
      },
    ]),
  ]);
}

// Null product FK (activity-parented risk) counts toward no product.
function riskCountsByProject(section: ComparisonSection): Map<string, number> {
  return section.risks.reduce(
    (counts, risk) =>
      risk.projectId
        ? counts.set(risk.projectId, (counts.get(risk.projectId) ?? 0) + 1)
        : counts,
    new Map<string, number>(),
  );
}

function accumulateRisks(
  cells: ReadonlyMap<string, ComparisonCell>,
  section: ComparisonSection,
): Map<string, ComparisonCell> {
  return new Map<string, ComparisonCell>([
    ...cells,
    ...[...riskCountsByProject(section)].map(
      ([projectId, count]): [string, ComparisonCell] => {
        const existing = cells.get(projectId) ?? UNKNOWN_CELL;
        return [projectId, { ...existing, risks: existing.risks + count }];
      },
    ),
  ]);
}

// Count risks once per period, using only its report in effect.
export function collectComparisonCells(
  reports: ComparisonReport[],
): Map<string, ComparisonCell> {
  const authoritativeReports = [
    ...groupReportsByLabel(reports).values(),
  ].flatMap((group) => {
    const winner = reportInEffectForPeriod(group);
    return winner === undefined ? [] : [winner];
  });

  return [...authoritativeReports]
    .sort((a, b) => a.periodEnd.getTime() - b.periodEnd.getTime())
    .reduce(
      (cells, report) =>
        report.sections.reduce(
          accumulateRisks,
          applyProjectStatuses(cells, report),
        ),
      new Map<string, ComparisonCell>(),
    );
}
