import { MS_PER_DAY, type TrafficLightCell } from "@customreport/shared";

// ISO YYYY-MM-DD length after toISOString().slice(0, n).
const ISO_DATE_LENGTH = 10;

// TZ-stable: toISOString always returns UTC.
/**
 * Iso Date Only.
 * @param d - The d argument.
 */
export function isoDateOnly(d: Date): string {
  return d.toISOString().slice(0, ISO_DATE_LENGTH);
}

// Half-open [startOfUtcDay, nextUtcDay) matches a date-only label to periodEnd.
/**
 * Start Of Utc Day.
 * @param dateOnly - The dateOnly argument.
 */
export function startOfUtcDay(dateOnly: string): Date {
  return new Date(`${dateOnly}T00:00:00.000Z`);
}

/**
 * Next Utc Day.
 * @param dateOnly - The dateOnly argument.
 */
export function nextUtcDay(dateOnly: string): Date {
  return new Date(startOfUtcDay(dateOnly).getTime() + MS_PER_DAY);
}

interface PeriodStamped {
  id: string;
  periodEnd: Date;
  createdAt: Date;
}

// periodEnd, then createdAt, then id — never fall back to non-deterministic DB order.
function comparePeriodThenCreated(a: PeriodStamped, b: PeriodStamped): number {
  const byPeriod = a.periodEnd.getTime() - b.periodEnd.getTime();
  if (byPeriod !== 0) return byPeriod;
  const byCreated = a.createdAt.getTime() - b.createdAt.getTime();
  if (byCreated !== 0) return byCreated;
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

// Latest periodEnd/createdAt/id wins; most recent republish is authoritative.
function laterReport<T extends PeriodStamped>(a: T, b: T): T {
  return comparePeriodThenCreated(a, b) >= 0 ? a : b;
}

// Multiple reports can share a label; insertion order follows the input query.
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
 * Status For Project.
 * @param reportsForLabel - The reportsForLabel argument.
 * @param projectId - The projectId argument.
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

// First name wins; optional projectId filters to one project.
/**
 * Collect Project Names.
 * @param reports - The reports argument.
 * @param projectId - The projectId argument.
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

// Status and name come from the section; the running risk tally survives.
function applyProjectStatuses(
  cells: ReadonlyMap<string, ComparisonCell>,
  section: ComparisonSection,
): Map<string, ComparisonCell> {
  return new Map<string, ComparisonCell>([
    ...cells,
    ...section.projectStatuses.map((ps): [string, ComparisonCell] => [
      ps.projectId,
      {
        status: ps.status,
        risks: cells.get(ps.projectId)?.risks ?? 0,
        name: ps.project.name,
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

// Oldest-first so latest status wins; risks accumulate across all reports.
/**
 * Collect Comparison Cells.
 * @param reports - The reports argument.
 */
export function collectComparisonCells(
  reports: ComparisonReport[],
): Map<string, ComparisonCell> {
  return [...reports]
    .sort(comparePeriodThenCreated)
    .flatMap((report) => report.sections)
    .reduce(
      (cells, section) =>
        accumulateRisks(applyProjectStatuses(cells, section), section),
      new Map<string, ComparisonCell>(),
    );
}
