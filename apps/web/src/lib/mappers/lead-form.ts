/**
 * Composes the three `LeadForm`-page tRPC queries into the mock-shaped slices
 * the existing presentational components expect:
 *
 *   - `reports.getActive`     -> `ReportSectionReadModel | null`
 *   - `leadForm.byPeriod`     -> `{ section: ReportSectionReadModel; readOnly: boolean }`
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
 *   `RiskEntry.severity` — persisted when present; legacy rows default to
 *   `"at-risk"`.
 *
 * - `DecisionEntry.productId` / `.productName` — `decisionInputSchema` has no
 *   `projectId`. Defaults to `''` / 'Department'. Phase 22 may scope decisions
 *   per-project if the schema gains a projectId.
 *
 * - `PriorityEntry.text` is passthrough; `rank` clamped to 1|2|3.
 *
 * - `ReportPeriod.isCurrent` is determined by matching the period entry's
 *   reportId against the active section's reportId. `isSubmitted` flows from
 *   `sectionStatus === 'submitted'`. Counts flow through from
 *   `reports.myHistory`; the FillFrom UI owns the display fallback when older
 *   fixtures omit them.
 */

import type {
  MyHistoryEntry,
  ReportSectionReadModel,
} from "@customreport/shared";
import { STAGE_NAMES } from "@customreport/shared";

import { riskCoversStage } from "../../components/lead/stage-tags";
import {
  formatPeriodRangeWithYear,
  isoWeekNumber as sharedIsoWeekNumber,
} from "../format-date";
import { deriveEffectiveStageStatus } from "../stage-status";
import { deriveItemStatus, type ItemStatus } from "./item-status";
import {
  type StageStatus,
  type TrafficLightStatus,
  trafficToStageStatus,
} from "./traffic-light";

// ---- Self-contained re-declarations of presentation types ----
//
// Mirrors `apps/web/src/components/lead/mock-data.ts` so consumers can depend
// on this barrel rather than importing a value from `mock-data.ts`.

export type LeadStageOwnership = "mine" | "locked" | "unassigned";

export interface LeadStageAssignment {
  stageName: string;
  status: StageStatus;
  ownership: LeadStageOwnership;
  assignee: string | null;
  tooltip?: string;
  /**
   * W11 (fix-report-surface-integrity): true when an OWN non-empty risk
   * EXPLICITLY names this stage (strict — `stageIds` non-empty and matching). A
   * covers-all (`stageIds: []`) or legacy stage-less risk does NOT set it. Feeds
   * own-input completeness so a deliberately risk-staged stage counts, while the
   * raw `status` stays untouched for the chip's risk-covered-vs-status distinction.
   */
  coveredByOwnRisk?: boolean;
}

export interface LeadProduct {
  id: string;
  name: string;
  overallStatus: StageStatus;
  stages: LeadStageAssignment[];
  riskSummary?: string;
  riskCount?: number;
}

export interface LeadKanbanItem {
  id: string;
  productId: string;
  productName: string;
  /** @deprecated Use stageIds. Kept for display back-compat via splitStageNames. */
  stageName?: string;
  /** UFB-073 (R1): stage selection as array of stage names. */
  stageIds?: string[];
  status: ItemStatus;
  text: string;
  author: string;
}

export interface LeadRiskEntry {
  id: string;
  productId: string;
  productName: string;
  /** @deprecated Use stageIds. Kept for display back-compat via splitStageNames. */
  stageName?: string;
  /** UFB-073 (R1): stage selection as array of stage names. */
  stageIds?: string[];
  severity: "at-risk" | "blocked";
  /** The user-controlled "what is the risk" text (= raw `risk` field). */
  text: string;
  /** Schema-required impact narrative; surfaced in the edit dialog. */
  impact: string;
  /** Schema-required mitigation narrative; surfaced in the edit dialog. */
  mitigation: string;
}

export interface LeadDecisionEntry {
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
  /** @deprecated Use stageIds. Kept for display back-compat via splitStageNames. */
  stageName?: string;
  /** UFB-073 (R1): stage selection as array of stage names. */
  stageIds?: string[];
}

export interface LeadPriorityEntry {
  rank: number;
  text: string;
  /** @deprecated Use stageIds. Kept for display back-compat via splitStageNames. */
  stageName?: string;
  /** UFB-073 (R1): stage selection as array of stage names. */
  stageIds?: string[];
  /** R4-B: product this priority is scoped to. */
  productId?: string;
  productName?: string;
}

export interface LeadReportPeriod {
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
  archived?: boolean;
  itemCount?: number;
  riskCount?: number;
  productCount?: number;
}

export interface LeadCurrentUser {
  name: string;
  initials: string;
  /**
   * Display label rendered next to the user's name in the form chrome.
   * Pre-35-03 this was a hard-coded "Dev Lead"; the chrome text now
   * derives from the section's `authorRole`.
   */
  role: string;
  /**
   * Authoritative role token (the Prisma `Role` enum) used for gating
   * head/admin-only form actions like "Revoke". Driven by the read model's
   * `authorRole`.
   */
  authorRole: "lead" | "head" | "admin" | "viewer";
}

// ---- Helpers ----

// stage-label-canonicalization: SDLC stage names come from the shared canonical
// `STAGE_NAMES` (imported above) — no local literal list. Dialogs source their
// stage options from it, so a record stores the full "Development"; the pipeline
// chip renders a display-only short label (`stageShortLabel`), never stored.

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function isoWeekNumber(d: Date): number {
  return sharedIsoWeekNumber(d);
}

function formatDateRange(start: Date, end: Date): string {
  return formatPeriodRangeWithYear(start, end);
}

function formatRelativeTimestamp(at: Date, now: Date): string {
  const diffMs = now.getTime() - at.getTime();
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return diffHour === 1 ? "1h ago" : `${diffHour}h ago`;
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
  const first = parts[0];
  if (!first) return "??";
  if (parts.length === 1) {
    return first.slice(0, 2).toUpperCase();
  }
  const last = parts[parts.length - 1] ?? first;
  return (first.charAt(0) + last.charAt(0)).toUpperCase();
}

function buildProjectIndex(section: ReportSectionReadModel): Map<
  string,
  {
    name: string;
    trafficLight: ReportSectionReadModel["projects"][number]["trafficLight"];
  }
> {
  const map = new Map<
    string,
    {
      name: string;
      trafficLight: ReportSectionReadModel["projects"][number]["trafficLight"];
    }
  >();
  // fix-lead-surface-name-resolution: name-only entries for projects that
  // section rows reference but the author owns no stage on. Seeded first so
  // the stage-owned loop below wins on conflict (design Decision 3); they
  // feed product-name lookup only — `mapLeadProducts` does not read this
  // index, so no stray product card or stage grid appears.
  for (const referenced of section.referencedProjects ?? []) {
    map.set(referenced.projectId, {
      name: referenced.projectName,
      trafficLight: null,
    });
  }
  for (const project of section.projects) {
    map.set(project.projectId, {
      name: project.projectName,
      trafficLight: project.trafficLight,
    });
  }
  return map;
}

/**
 * Stages-the-current-user-owns selector. Returns the list of stage names the
 * section author has a `StageAssignment` for on the given project. Used by
 * the lead-form modals to limit the "SDLC stage" dropdown to stages the
 * current lead actually owns. When `projectId` is undefined (decisions /
 * priorities are department-scoped), returns the union across all projects.
 */
export function ownedStagesForProject(
  section: ReportSectionReadModel,
  projectId: string | undefined,
): string[] {
  const rawOwned: string[] = [];
  if (projectId) {
    const project = section.projects.find((p) => p.projectId === projectId);
    for (const stage of project?.ownedStages ?? [])
      rawOwned.push(stage.stageName);
  } else {
    for (const project of section.projects)
      for (const stage of project.ownedStages ?? [])
        rawOwned.push(stage.stageName);
  }
  return STAGE_NAMES.filter((canonical) =>
    rawOwned.some((raw) => stageNamesMatch(canonical, raw)),
  );
}

// ---- Mappers ----

export function normalizeStageName(stageName: string): string {
  const lower = stageName.toLowerCase();
  return lower === "development" ? "dev" : lower;
}

/** True when two stage names refer to the same pipeline slot (handles "Development" ↔ "Dev" alias). */
export function stageNamesMatch(a: string, b: string): boolean {
  return normalizeStageName(a) === normalizeStageName(b);
}

/**
 * Build the 7-stage grid for one project from the read model's `ownedStages`.
 *
 * Stages whose name appears in `ownedStages` (matched via `stageNamesMatch`)
 * are flagged `mine`; the rest stay `unassigned`.
 *
 * rethink-pipeline-state-vs-completeness (D1): an EMPTY owned stage — one the
 * lead never set a status on — keeps its raw `status: "empty"` even when a
 * covering risk exists. The risk-derived severity floor for DISPLAY is
 * re-applied at render by the live form's `applyRiskSeverityFloor` (and the
 * slide export's `floorSlideStageStatus`), so the chip still shows the risk
 * severity. The raw `status` must NOT be floored for an untouched stage:
 * flooring would erase the chip's risk-covered-vs-status-set distinction
 * (W11 task 3.9) and would count foreign/covers-all-covered stages toward
 * own-input completeness.
 *
 * fix-report-surface-integrity W11: own-input completeness no longer reads the
 * raw `status` alone — it counts a stage when `status !== "empty"` OR the lead's
 * OWN risk EXPLICITLY names it (`coveredByOwnRisk`, set below). So an empty stage
 * the lead deliberately staged a risk on DOES count, while its raw `status`
 * stays `empty` for the chip distinction. A covers-all (`stageIds: []`) or legacy
 * stage-less risk is excluded, so it never inflates the counter (the old "all
 * stages checked" Add-Risk footgun).
 *
 * A stage the lead DID touch (explicit on-track/at-risk/blocked) still flows
 * through `deriveEffectiveStageStatus`: it floors up to a worse covering risk
 * and collapses a stale, unbacked at-risk/blocked down to on-track. Either way
 * it stays non-empty, so completeness rightly counts it as filled.
 */
function buildStageGrid(
  ownerLabel: string,
  ownedStages: readonly {
    stageName: string;
    status?: TrafficLightStatus | null;
  }[],
  risks: readonly { stageIds?: readonly string[]; severity?: string }[] = [],
): LeadStageAssignment[] {
  return STAGE_NAMES.map((stageName) => {
    const ownedStage =
      ownedStages.find((s) => stageNamesMatch(s.stageName, stageName)) ?? null;
    if (ownedStage) {
      const explicit = trafficToStageStatus(ownedStage.status ?? null);
      return {
        stageName,
        // An untouched stage keeps raw `status: "empty"` (the chip distinction
        // reads it; completeness counts it via `coveredByOwnRisk` below, not via
        // this status). A touched stage derives floor-up / collapse-down from
        // covering risks.
        // unify-risk-stage-status: empty/undefined stageIds means the risk
        // covers every owned stage — route through `riskCoversStage` so the
        // read model agrees with the live form on legacy stage-less risks.
        status:
          explicit === "empty"
            ? "empty"
            : deriveEffectiveStageStatus(
                explicit,
                risks.filter((r) => riskCoversStage(r, stageName)),
                [],
              ),
        ownership: "mine" as const,
        assignee: ownerLabel,
        // W11 (fix-report-surface-integrity): flag a stage the lead's OWN risk
        // EXPLICITLY names (strict — non-empty stageIds). A covers-all (`[]`) or
        // legacy stage-less risk is excluded, so it never inflates the counter.
        // The raw `status` above is left untouched — the chip distinguishes a
        // risk-covered empty stage from an explicitly-set one.
        coveredByOwnRisk: risks.some(
          (r) =>
            Array.isArray(r.stageIds) &&
            r.stageIds.length > 0 &&
            riskCoversStage(r, stageName),
        ),
      };
    }
    return {
      stageName,
      status: "empty" as const,
      ownership: "unassigned" as const,
      assignee: null,
    };
  });
}

/**
 * Map a section's projects -> presentation Product[].
 *
 * 35-04: each project's `ownedStages` (sourced from `StageAssignment` rows
 * scoped to the section author) drive which of the 7 SDLC chips render as
 * "mine" vs "unassigned". Stages outside `ownedStages` still render so the
 * user sees the full pipeline context, but they're greyed and unowned.
 *
 * Pre-35-04 this mapper synthesized a fake grid that hard-coded the lead
 * onto "Dev" — that's the bug where assigning a lead to all 7 stages on
 * the Products admin tab didn't show up on /lead/report.
 */
export function mapLeadProducts(
  section: ReportSectionReadModel,
): LeadProduct[] {
  return section.projects.map((p) => {
    const ownedStages = p.ownedStages ?? [];
    const overallStatus = trafficToStageStatus(p.trafficLight);
    // rethink-pipeline-state-vs-completeness (D1): pass the covering risks so a
    // TOUCHED stage floors up / collapses down correctly, while an UNTOUCHED
    // (empty) stage keeps raw `status: "empty"` (see buildStageGrid). W11:
    // buildStageGrid also tags it `coveredByOwnRisk` when an own risk names it,
    // which is how an empty-but-risk-staged stage counts toward completeness.
    const coveringRisks = section.risks.filter(
      (r) => r.projectId === p.projectId && r.risk.trim().length > 0,
    );
    return {
      id: p.projectId,
      name: p.projectName,
      overallStatus,
      stages: buildStageGrid(section.authorName, ownedStages, coveringRisks),
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
  itemType: "current" | "next",
): LeadKanbanItem[] {
  const projectIndex = buildProjectIndex(section);
  return section.items
    .filter((item) => item.type === itemType)
    .map((item) => {
      const project = projectIndex.get(item.projectId);
      const status = deriveItemStatus({
        workflowStatus: item.workflowStatus,
        type: item.type,
        completed: item.completed ?? null,
      });
      return {
        id: item.id ?? `${itemType}-${item.projectId}-${item.text.slice(0, 8)}`,
        productId: item.projectId,
        productName: project?.name ?? "Unknown",
        // UFB-073 (R1): stage array from DB. Surfaces on the kanban card and
        // groups items by product+stage. Falls back to undefined for
        // legacy rows seeded before the column existed.
        ...(item.stageIds ? { stageIds: item.stageIds } : {}),
        status,
        text: item.text,
        author: section.authorName,
        // F1: carry priorityRank into the bound KanbanItem so ItemEditDialog
        // re-populates the field on reopen (was dropped → empty field after
        // reload even though the value persisted + showed in the priorities view).
        priorityRank: item.priorityRank ?? null,
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
export function mapLeadRisks(section: ReportSectionReadModel): LeadRiskEntry[] {
  const projectIndex = buildProjectIndex(section);
  return section.risks.map((r, idx) => {
    const project = projectIndex.get(r.projectId);
    return {
      id: r.id ?? `risk-${idx}`,
      productId: r.projectId,
      productName: project?.name ?? "Unknown",
      // UFB-073 (R1): stage array from DB; legacy rows fall back to undefined.
      stageIds: r.stageIds,
      severity: r.severity ?? "at-risk",
      text: r.risk,
      impact: r.impact,
      mitigation: r.mitigation,
    };
  });
}

export function mapLeadDecisions(
  section: ReportSectionReadModel,
): LeadDecisionEntry[] {
  const projectIndex = buildProjectIndex(section);
  return section.decisions.map((d, idx) => ({
    id: d.id ?? `decision-${idx}`,
    productId: d.productId ?? "",
    productName:
      (d.productId ? projectIndex.get(d.productId)?.name : undefined) ??
      "Group",
    text: d.text,
    owner: d.owner,
    impact: d.impact,
    deadline: d.deadline
      ? new Date(d.deadline).toISOString().slice(0, 10)
      : null,
    stageIds: d.stageIds,
  }));
}

export function mapLeadPriorities(
  section: ReportSectionReadModel,
): LeadPriorityEntry[] {
  const projectIndex = buildProjectIndex(section);
  return section.items
    .filter((i) => i.priorityRank != null)
    .sort((a, b) => {
      const ra = (a.priorityRank ?? 0) >= 1 ? (a.priorityRank ?? 0) : Infinity;
      const rb = (b.priorityRank ?? 0) >= 1 ? (b.priorityRank ?? 0) : Infinity;
      return ra - rb;
    })
    .map((i) => ({
      rank: clampRank(i.priorityRank ?? 0),
      text: i.text,
      stageIds: i.stageIds,
      productId: i.projectId,
      productName: projectIndex.get(i.projectId)?.name ?? undefined,
    }));
}

/**
 * Map `reports.myHistory` to the Period dropdown shape the LeadForm expects.
 * Sorts by `periodStart` descending so the dropdown reads newest→oldest
 * regardless of `section.createdAt` ordering (seed inserts can shuffle
 * createdAt; period date is the user-visible truth).
 *
 * The active reportId (if any) flags `isCurrent: true`; count fields are
 * passed through from `MyHistoryEntry` without mapper-level fallback zeros.
 */
export function mapLeadPeriods(
  history: readonly MyHistoryEntry[],
  activeReportId: string | null,
): LeadReportPeriod[] {
  return [...history]
    .sort((a, b) => b.periodStart.getTime() - a.periodStart.getTime())
    .map((e) => ({
      id: e.reportId,
      sourceSectionId: e.sectionId,
      weekLabel: `Week ${isoWeekNumber(e.periodStart)}`,
      dateRange: formatDateRange(e.periodStart, e.periodEnd),
      isCurrent: activeReportId !== null && e.reportId === activeReportId,
      isSubmitted: e.sectionStatus === "submitted",
      archived: e.archived ?? false,
      itemCount: e.itemCount,
      riskCount: e.riskCount,
      productCount: e.productCount,
    }));
}

// ---- Composer ----

export interface MapLeadFormArgs {
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
  history: readonly MyHistoryEntry[];
}

export interface MappedLeadForm {
  products: LeadProduct[];
  currentWeekItems: LeadKanbanItem[];
  nextWeekItems: LeadKanbanItem[];
  risks: LeadRiskEntry[];
  decisions: LeadDecisionEntry[];
  priorities: LeadPriorityEntry[];
  periods: LeadReportPeriod[];
  currentUser: LeadCurrentUser;
  /** Whether the section is locked for the current user (submitted or period published). */
  readOnly: boolean;
}

/**
 * Compose all three queries into a single LeadForm-shaped payload. Caller is
 * responsible for ensuring all inputs are settled (i.e., not undefined) before
 * invoking — use `isLoading || !data` guards in the page component.
 */
export function mapLeadFormData(args: MapLeadFormArgs): MappedLeadForm {
  const section = args.byPeriod.section;
  // Lock the form when the period is locked OR the section is already submitted.
  const readOnly = args.byPeriod.readOnly || section.status === "submitted";

  // 35-03: surface the section author's role end-to-end. The display label
  // ("Lead", "Head", "Admin") is derived from the role token; the raw
  // token (`authorRole`) is exposed so role-based UI gating doesn't have
  // to reverse-engineer the label string. Defaults to 'lead' when the
  // read model omits it (legacy fixtures, harness-driven tests).
  const authorRole: "lead" | "head" | "admin" | "viewer" =
    args.active.authorRole ?? "lead";
  const roleLabel =
    authorRole === "head"
      ? "Head"
      : authorRole === "admin"
        ? "Admin"
        : authorRole === "viewer"
          ? "Viewer"
          : "Lead";

  return {
    products: mapLeadProducts(section),
    currentWeekItems: mapLeadItems(section, "current"),
    nextWeekItems: mapLeadItems(section, "next"),
    risks: mapLeadRisks(section),
    decisions: mapLeadDecisions(section),
    priorities: mapLeadPriorities(section),
    periods: mapLeadPeriods(args.history, args.active.reportId),
    currentUser: {
      name: args.active.authorName,
      initials: initialsFromName(args.active.authorName),
      role: roleLabel,
      authorRole,
    },
    readOnly,
  };
}

// Internal exports for tests.
export const __testing = {
  buildStageGrid,
  initialsFromName,
  formatRelativeTimestamp,
  formatDateRange,
  isoWeekNumber,
  clampRank,
};
