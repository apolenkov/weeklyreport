/**
 * Composes the four `LeadForm`-page tRPC queries into the mock-shaped slices
 * the existing presentational components expect:
 *
 *   - `reports.getActive`     -> `ReportSectionReadModel | null`
 *   - `leadForm.byPeriod`     -> `{ section: ReportSectionReadModel; readOnly: boolean }`
 *   - `leadForm.versions`     -> `VersionSnapshot[]`
 *   - `reports.myHistory`     -> `MyHistoryEntry[]`
 *
 * Reuses Phase 20 mappers (`trafficToStageStatus`, `deriveItemStatus`).
 *
 * Synthesis notes (Phase 21 / Plan 21-04):
 * - `leadForm.byPeriod` returns ONE section (the current user's slice for the
 *   target period). It does NOT carry `products` / `currentWeek` / `nextWeek` /
 *   `risks` / `decisions` / `priorities` as the plan's `<interfaces>` block
 *   claimed — those are derived from `section.projects`, `section.items`,
 *   `section.risks`, etc. (Rule 2 deviation, mirrors 21-03 admin synthesis.)
 *
 * - `MockProduct.stages` — synthesized empty 7-stage grid (assignee: null).
 *   The "mine" stage is auto-marked when the project's `trafficLight` is
 *   non-null (the lead owns that project's stage in the active section).
 *   Real per-stage assignments come from Phase 22 via `admin.listStageAssignments`.
 *
 * - `KanbanItem.productName` is looked up via `projectId` -> `projectName` from
 *   `section.projects`. Items with unknown projectId fall back to "Unknown".
 *
 * - `KanbanItem.stageName` — not present on `itemInputSchema`. Defaults to
 *   `undefined` (UI groups by product name only).
 *
 * - `KanbanItem.author` — uses `section.authorName`.
 *
 * - `RiskEntry.productName` — looked up via `risk.projectId` -> `projectName`.
 *   `RiskEntry.stageName` — not on `riskInputSchema`; defaults to "—".
 *   `RiskEntry.severity` — not on `riskInputSchema`; defaults to `"at-risk"`.
 *   `text` is constructed as `risk` + " — Impact: " + impact + " — Mitigation: " + mitigation
 *
 * - `DecisionEntry.productId` / `.productName` — `decisionInputSchema` has no
 *   `projectId`. Defaults to `''` / 'Department'. Phase 22 may scope decisions
 *   per-project if the schema gains a projectId.
 *
 * - `PriorityEntry.text` is passthrough; `rank` clamped to 1|2|3.
 *
 * - `ReportPeriod.isCurrent` is determined by matching the period entry's
 *   reportId against the active section's reportId. `isSubmitted` flows from
 *   `sectionStatus === 'submitted'`. Counts default to 0 (history endpoint
 *   doesn't expose them — same gap as `lead-history.ts`).
 *
 * - `VersionSnapshot.timestamp` — formatted from `createdAt` via the same
 *   relative-time helper used in `lead-history.ts`. `itemCount`/`riskCount`/
 *   `decisionCount` default to 0 (the snapshot row only stores version + ts;
 *   computing aggregates would require a per-version diff query).
 */

import type {
  ReportSectionReadModel,
  MyHistoryEntry,
  VersionSnapshot as ApiVersionSnapshot,
} from '@customreport/shared';

import { deriveItemStatus, type ItemStatus } from './item-status';
import { trafficToStageStatus, type StageStatus } from './traffic-light';

// ---- Self-contained re-declarations of presentation types ----
//
// Mirrors `apps/web/src/components/lead/mock-data.ts` so consumers can depend
// on this barrel rather than importing a value from `mock-data.ts`.

export type LeadStageOwnership = 'mine' | 'locked' | 'unassigned';

export type LeadStageAssignment = {
  stageName: string;
  status: StageStatus;
  ownership: LeadStageOwnership;
  assignee: string | null;
  tooltip?: string;
};

export type LeadProduct = {
  id: string;
  name: string;
  overallStatus: StageStatus;
  stages: LeadStageAssignment[];
  riskSummary?: string;
  riskCount?: number;
};

export type LeadKanbanItem = {
  id: string;
  productId: string;
  productName: string;
  stageName?: string;
  status: ItemStatus;
  text: string;
  author: string;
};

export type LeadRiskEntry = {
  id: string;
  productId: string;
  productName: string;
  stageName: string;
  severity: 'at-risk' | 'blocked';
  /** The user-controlled "what is the risk" text (= raw `risk` field). */
  text: string;
  /** Schema-required impact narrative; surfaced in the edit dialog. */
  impact: string;
  /** Schema-required mitigation narrative; surfaced in the edit dialog. */
  mitigation: string;
};

export type LeadDecisionEntry = {
  id: string;
  productId: string;
  productName: string;
  text: string;
  /** Schema-required owner (responsible person). */
  owner: string;
  /** Schema-required impact narrative. */
  impact: string;
  /** Optional deadline (ISO yyyy-mm-dd string) — null when not set. */
  deadline: string | null;
};

export type LeadPriorityEntry = {
  rank: number;
  text: string;
};

export type LeadReportPeriod = {
  id: string;
  /**
   * The source section id for this period (the lead's section within that
   * historical report). Required by `leadForm.fillFrom` which routes by
   * section, not report. Sourced from `MyHistoryEntry.sectionId`.
   */
  sourceSectionId: string;
  weekLabel: string;
  dateRange: string;
  isCurrent: boolean;
  isSubmitted: boolean;
  itemCount?: number;
  riskCount?: number;
  productCount?: number;
};

export type LeadVersionSnapshot = {
  version: number;
  timestamp: string;
  itemCount: number;
  riskCount: number;
  decisionCount: number;
};

export type LeadCurrentUser = {
  name: string;
  initials: string;
  role: 'Dev Lead' | 'QA Lead' | 'Mobile Lead' | 'Platform Lead' | 'Auth Lead' | 'Infra Lead' | 'Lead';
};

// ---- Helpers ----

const STAGE_NAMES = [
  'Planning',
  'Analysis',
  'Design',
  'Dev',
  'Testing',
  'DevOps',
  'Support',
] as const;

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

function isoWeekNumber(d: Date): number {
  const target = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const dayNum = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstThursdayDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstThursdayDayNum + 3);
  const diffMs = target.getTime() - firstThursday.getTime();
  return 1 + Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
}

function formatDateRange(start: Date, end: Date): string {
  const sMonth = MONTHS[start.getUTCMonth()];
  const sDay = start.getUTCDate();
  const eMonth = MONTHS[end.getUTCMonth()];
  const eDay = end.getUTCDate();
  if (start.getUTCMonth() === end.getUTCMonth()) {
    return `${sMonth} ${sDay}-${eDay}`;
  }
  return `${sMonth} ${sDay}-${eMonth} ${eDay}`;
}

function formatRelativeTimestamp(at: Date, now: Date): string {
  const diffMs = now.getTime() - at.getTime();
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return diffHour === 1 ? '1h ago' : `${diffHour}h ago`;
  const month = MONTHS[at.getUTCMonth()];
  const day = at.getUTCDate();
  return `${month} ${day}`;
}

function clampRank(rank: number): number {
  // Keep ranks ≥ 1 (schema requires positive int) but no upper clamp — the
  // UI is now variable-length. Earlier this funnel mapped everything onto
  // 1|2|3 to match the fixed-slot layout that has been removed.
  if (rank < 1 || !Number.isInteger(rank)) return 1;
  return rank;
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return '??';
  if (parts.length === 1) {
    const first = parts[0]!;
    return first.slice(0, 2).toUpperCase();
  }
  const a = parts[0]!.charAt(0);
  const b = parts[parts.length - 1]!.charAt(0);
  return (a + b).toUpperCase();
}

function buildProjectIndex(
  section: ReportSectionReadModel,
): Map<string, { name: string; trafficLight: ReportSectionReadModel['projects'][number]['trafficLight'] }> {
  const map = new Map<
    string,
    { name: string; trafficLight: ReportSectionReadModel['projects'][number]['trafficLight'] }
  >();
  for (const project of section.projects) {
    map.set(project.projectId, {
      name: project.projectName,
      trafficLight: project.trafficLight,
    });
  }
  return map;
}

// ---- Mappers ----

function emptyStageGrid(
  ownerLabel: string,
  ownerHasStake: boolean,
  productStatus: StageStatus,
): LeadStageAssignment[] {
  // Synthesize a 7-stage grid. The product's overall status is rendered on the
  // owner's "Dev" stage when they hold a stake, otherwise empty.
  return STAGE_NAMES.map((stageName) => {
    if (ownerHasStake && stageName === 'Dev') {
      return {
        stageName,
        status: productStatus,
        ownership: 'mine' as const,
        assignee: ownerLabel,
      };
    }
    return {
      stageName,
      status: 'empty' as const,
      ownership: 'unassigned' as const,
      assignee: null,
    };
  });
}

/**
 * Map a section's projects -> presentation Product[].
 *
 * Each project's `trafficLight` becomes the product's overall status; an empty
 * 7-stage grid is synthesized with the lead marked as owner of the "Dev" stage
 * (the most common case for a Dev Lead). Real per-stage assignments come from
 * Phase 22.
 */
export function mapLeadProducts(
  section: ReportSectionReadModel,
): LeadProduct[] {
  return section.projects.map((p) => {
    const overallStatus = trafficToStageStatus(p.trafficLight);
    return {
      id: p.projectId,
      name: p.projectName,
      overallStatus,
      stages: emptyStageGrid(section.authorName, true, overallStatus),
    };
  });
}

/**
 * Map a section's items (filtered by `type`) into KanbanItems.
 *
 * Each item's display status flows through `deriveItemStatus` (Phase 20).
 * Product name is resolved via `section.projects[i].projectName`.
 */
export function mapLeadItems(
  section: ReportSectionReadModel,
  itemType: 'current' | 'next',
): LeadKanbanItem[] {
  const projectIndex = buildProjectIndex(section);
  return section.items
    .filter((item) => item.type === itemType)
    .map((item) => {
      const project = projectIndex.get(item.projectId);
      const status = deriveItemStatus({
        workflowStatus: item.workflowStatus,
        type: item.type,
      });
      return {
        id: item.id ?? `${itemType}-${item.projectId}-${item.text.slice(0, 8)}`,
        productId: item.projectId,
        productName: project?.name ?? 'Unknown',
        // stageName is not on itemInputSchema; left undefined so the UI groups
        // strictly by product.
        status,
        text: item.text,
        author: section.authorName,
      };
    });
}

/**
 * Map a section's risks into RiskEntry presentation rows. The UI surfaces a
 * single textarea for the user-controlled `risk` field; impact/mitigation are
 * stored on the raw row but not shown (handler keeps non-empty defaults so
 * the schema's safeText({min:1}) refinement on those fields stays satisfied).
 *
 * Earlier the mapper concatenated `${risk} — Impact: ${impact} — Mitigation: ${mitigation}`
 * into `text`, but `handleRisksChange` writes `risk: r.text` straight back, so
 * every render double-concatenated the existing fields and corrupted the row.
 */
export function mapLeadRisks(
  section: ReportSectionReadModel,
): LeadRiskEntry[] {
  const projectIndex = buildProjectIndex(section);
  return section.risks.map((r, idx) => {
    const project = projectIndex.get(r.projectId);
    return {
      id: r.id ?? `risk-${idx}`,
      productId: r.projectId,
      productName: project?.name ?? 'Unknown',
      stageName: '—',
      severity: 'at-risk' as const,
      text: r.risk,
      impact: r.impact,
      mitigation: r.mitigation,
    };
  });
}

export function mapLeadDecisions(
  section: ReportSectionReadModel,
): LeadDecisionEntry[] {
  return section.decisions.map((d, idx) => ({
    id: d.id ?? `decision-${idx}`,
    productId: '',
    productName: 'Department',
    text: d.text,
    owner: d.owner ?? '',
    impact: d.impact ?? '',
    deadline: d.deadline
      ? new Date(d.deadline).toISOString().slice(0, 10)
      : null,
  }));
}

export function mapLeadPriorities(
  section: ReportSectionReadModel,
): LeadPriorityEntry[] {
  return section.priorities.map((p) => ({
    rank: clampRank(p.rank),
    text: p.text,
  }));
}

/**
 * Map `reports.myHistory` to the Period dropdown shape the LeadForm expects.
 * The active reportId (if any) flags `isCurrent: true`; counts default to 0.
 */
export function mapLeadPeriods(
  history: readonly MyHistoryEntry[],
  activeReportId: string | null,
): LeadReportPeriod[] {
  return history.map((e) => ({
    id: e.reportId,
    sourceSectionId: e.sectionId,
    weekLabel: `Week ${isoWeekNumber(e.periodStart)}`,
    dateRange: formatDateRange(e.periodStart, e.periodEnd),
    isCurrent: activeReportId !== null && e.reportId === activeReportId,
    isSubmitted: e.sectionStatus === 'submitted',
  }));
}

/**
 * Map API VersionSnapshots into the dropdown shape. Counts come from the
 * server (computed from the snapshot's `data` JSON), so the version-history
 * UI can render real delta summaries instead of zeros.
 */
export function mapLeadVersions(
  versions: readonly ApiVersionSnapshot[],
  now: Date,
): LeadVersionSnapshot[] {
  return versions.map((v) => ({
    version: v.version,
    timestamp: formatRelativeTimestamp(v.createdAt, now),
    itemCount: v.itemCount,
    riskCount: v.riskCount,
    decisionCount: v.decisionCount,
  }));
}

// ---- Composer ----

export type MapLeadFormArgs = {
  /**
   * The active section returned by `reports.getActive`. When `null`, no active
   * report is bound to the user's session — the caller should render an empty
   * state. Mappers below assume `active !== null` once data is settled.
   */
  active: ReportSectionReadModel;
  /**
   * Wrapper from `leadForm.byPeriod` — section + readOnly flag. We use
   * `byPeriod.section` when present (period-scoped read), else fall back to
   * `active`.
   */
  byPeriod: { section: ReportSectionReadModel; readOnly: boolean };
  versions: readonly ApiVersionSnapshot[];
  history: readonly MyHistoryEntry[];
  /** Override `now` for deterministic version-timestamp tests. */
  now?: Date;
};

export type MappedLeadForm = {
  products: LeadProduct[];
  currentWeekItems: LeadKanbanItem[];
  nextWeekItems: LeadKanbanItem[];
  risks: LeadRiskEntry[];
  decisions: LeadDecisionEntry[];
  priorities: LeadPriorityEntry[];
  periods: LeadReportPeriod[];
  versions: LeadVersionSnapshot[];
  currentUser: LeadCurrentUser;
  /** Whether the section is locked for the current user (submitted or period published). */
  readOnly: boolean;
};

/**
 * Compose all four queries into a single LeadForm-shaped payload. Caller is
 * responsible for ensuring all inputs are settled (i.e., not undefined) before
 * invoking — use `isLoading || !data` guards in the page component.
 */
export function mapLeadFormData(args: MapLeadFormArgs): MappedLeadForm {
  const now = args.now ?? new Date();
  const section = args.byPeriod.section;
  // Lock the form when the period is locked OR the section is already submitted.
  const readOnly = args.byPeriod.readOnly || section.status === 'submitted';

  return {
    products: mapLeadProducts(section),
    currentWeekItems: mapLeadItems(section, 'current'),
    nextWeekItems: mapLeadItems(section, 'next'),
    risks: mapLeadRisks(section),
    decisions: mapLeadDecisions(section),
    priorities: mapLeadPriorities(section),
    periods: mapLeadPeriods(args.history, args.active.reportId),
    versions: mapLeadVersions(args.versions, now),
    currentUser: {
      name: args.active.authorName,
      initials: initialsFromName(args.active.authorName),
      role: 'Dev Lead',
    },
    readOnly,
  };
}

// Internal exports for tests.
export const __testing = {
  emptyStageGrid,
  initialsFromName,
  formatRelativeTimestamp,
  formatDateRange,
  isoWeekNumber,
  clampRank,
};
