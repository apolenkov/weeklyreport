/**
 * Composes the three `LeadForm`-page tRPC queries into the mock-shaped slices
 * the existing presentational components expect:
 *
 *   - `reports.getActive`     -> `ReportSectionReadModel | null`
 *   - `leadForm.byPeriod`     -> `{ section: ReportSectionReadModel; readOnly: boolean }`
 *   - `reports.myHistory`     -> `MyHistoryEntry[]`
 *
 * Each mapper below documents its own resolution rules; `leadForm.byPeriod`
 * returns a single section, and `products` / `risks` / `decisions` /
 * `priorities` are derived from that section's flat arrays.
 */

import type {
  MyHistoryEntry,
  RecordCommentView,
  ReportSectionReadModel,
} from "@customreport/shared";
import type {
  DbRole,
  RiskSeverity,
  TrafficLightStatus,
} from "@customreport/shared";
import {
  initialsFromName as sharedInitialsFromName,
  normalizeStageName,
  ROLE_LABEL,
  shortNameFromName,
  STAGE_NAMES,
  stageNamesMatch,
} from "@customreport/shared";

import {
  formatPeriodRangeWithYear,
  isoWeekNumber,
} from "../../../lib/format-date";
import { deriveEffectiveStageStatus } from "../../../lib/stage-status";
import { deriveItemStatus } from "./item-status";
import { riskCoversStage } from "./stage-tags";
import { trafficToStageStatus } from "./traffic-light";
import type {
  DecisionEntry,
  KanbanItem,
  PriorityEntry,
  Product,
  ReportPeriod,
  RiskEntry,
  StageAssignment,
} from "./types";

// ---- Lead* aliases ----
//
// Aliases of the canonical read-model types in ./types, with lead-mapper
// -specific tightenings (e.g. required fields the mapper always populates).

type LeadStageAssignment = StageAssignment;
export type LeadProduct = Product;
/** Mapper guarantees: priorityRank and pausedReason are always populated (null = absent). */
export type LeadKanbanItem = KanbanItem & {
  priorityRank: number | null;
  pausedReason: string | null;
};
export type LeadRiskEntry = RiskEntry;
export type LeadDecisionEntry = DecisionEntry;
export type LeadPriorityEntry = PriorityEntry;
export type LeadReportPeriod = ReportPeriod;

export interface LeadCurrentUser {
  name: string;
  initials: string;
  /**
   * Display label rendered next to the user's name in the form chrome.
   * Previously this was a hard-coded "Dev Lead"; the chrome text now
   * derives from the section's `authorRole`.
   */
  role: string;
  /**
   * Authoritative role token (the Prisma `Role` enum) used for gating
   * head/admin-only form actions like "Revoke". Driven by the read model's
   * `authorRole`.
   */
  authorRole: DbRole;
}

// ---- Helpers ----

// stage-label-canonicalization: SDLC stage names come from the shared canonical
// `STAGE_NAMES` (imported above) — no local literal list. Dialogs source their
// stage options from it, so a record stores the full "Development"; the pipeline
// chip renders a display-only short label (`stageShortLabel`), never stored.

// Truncation length for a fallback id's embedded text fragment.
const ID_TEXT_FRAGMENT_LENGTH = 8;

// "YYYY-MM-DD" — length of an ISO date-only prefix.
const ISO_DATE_LENGTH = 10;

function clampRank(rank: number): number {
  // Keep ranks ≥ 1 (schema requires positive int) but no upper clamp — the
  // UI is now variable-length. Earlier this funnel mapped everything onto
  // 1|2|3 to match the fixed-slot layout that has been removed.
  if (rank < 1 || !Number.isInteger(rank)) return 1;
  return rank;
}

// Avatar initials via the canonical shared helper (surname-first ФИО), with
// this surface's "??" placeholder for an empty name. The token logic lives once
// in @customreport/shared so cloned copies can't diverge.
function initialsFromName(name: string): string {
  return sharedInitialsFromName(name) || "??";
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
  // the stage-owned loop below wins on conflict; they
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
  const projects = projectId
    ? section.projects.filter((p) => p.projectId === projectId)
    : section.projects;
  const rawOwned = projects.flatMap(
    (project) => project.ownedStages?.map((stage) => stage.stageName) ?? [],
  );
  return STAGE_NAMES.filter((canonical) =>
    rawOwned.some((raw) => stageNamesMatch(canonical, raw)),
  );
}

// ---- Mappers ----

// Element-type aliases for the flat section arrays.
type SectionItem = ReportSectionReadModel["items"][number];
type SectionDecision = ReportSectionReadModel["decisions"][number];

// The Dev↔Development stage-name canonicalization is single-homed in
// @customreport/shared so the server ownership guard and this client mapper
// never disagree on whether two names refer to the same pipeline slot. Imported
// above for local use and re-exported for the web modules that pull it from
// this barrel.
export { normalizeStageName, stageNamesMatch };

/**
 * Build the stage grid for one project from the product's assigned-stage set.
 *
 * unassigned-stage-reporting-exclusion: the grid is sourced from `stageSet`
 * (the union of all leads' assignments on the product), NOT all seven canonical
 * stages. A stage owned by this lead (name in `ownedStages`) is `mine`; a stage
 * in the set but not owned is foreign-owned (`locked`, read-only); a stage with
 * NO assignment is absent from the set and excluded entirely. `ownedStages` is
 * unioned into the membership test defensively so the lead's own stages always
 * render even if `stageSet` is missing (legacy fixtures / frozen snapshots).
 * Order follows the canonical `STAGE_NAMES` pipeline order.
 *
 * rethink-pipeline-state-vs-completeness: an EMPTY owned stage — one the
 * lead never set a status on — keeps its raw `status: "empty"` even when a
 * covering risk exists. The risk-derived severity floor for DISPLAY is
 * re-applied at render by the live form's `applyRiskSeverityFloor` (and the
 * slide export's `floorSlideStageStatus`), so the chip still shows the risk
 * severity. The raw `status` must NOT be floored for an untouched stage:
 * flooring would erase the chip's risk-covered-vs-status-set distinction
 * and would count foreign/covers-all-covered stages toward
 * own-input completeness.
 *
 * fix-report-surface-integrity: own-input completeness no longer reads the
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
interface OwnedStageInput {
  stageName: string;
  status?: TrafficLightStatus | null;
}
interface StageRisk {
  stageIds?: readonly string[];
  severity: RiskSeverity;
}

/**
 * Build the grid row for a stage this lead OWNS. Split out of `buildStageGrid`
 * so that function stays a thin filter+map over `STAGE_NAMES`.
 *
 * An untouched stage keeps raw `status: "empty"` (the chip distinction reads
 * it; completeness counts it via `coveredByOwnRisk` below, not via this
 * status). A touched stage derives floor-up / collapse-down from covering
 * risks (unify-risk-stage-status: empty/undefined stageIds means the risk
 * covers every owned stage — routed through `riskCoversStage` so the read
 * model agrees with the live form on legacy stage-less risks).
 */
function deriveOwnedStageRow(
  stageName: string,
  ownedStage: OwnedStageInput,
  ownerLabel: string,
  risks: readonly StageRisk[],
): LeadStageAssignment {
  const explicit = trafficToStageStatus(ownedStage.status ?? null);
  return {
    stageName,
    status:
      explicit === "empty"
        ? "empty"
        : deriveEffectiveStageStatus(
            explicit,
            risks.filter((r) => riskCoversStage(r, stageName)),
            [],
          ),
    ownership: "mine" as const,
    // Stage owner labels render the short form ("Иванов В.П."); the full ФИО
    // is reserved for the top user badge. Avatar chips keep 2-letter initials.
    assignee: shortNameFromName(ownerLabel),
    // fix-report-surface-integrity: flag a stage the lead's OWN risk
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

function buildStageGrid(
  ownerLabel: string,
  ownedStages: readonly OwnedStageInput[],
  stageSet: readonly { stageName: string }[] = [],
  risks: readonly StageRisk[] = [],
): LeadStageAssignment[] {
  // unassigned-stage-reporting-exclusion: membership is assignment-driven —
  // a stage renders only if it is in the product's `stageSet` (assigned to some
  // lead) or owned by this lead. Owned is unioned in defensively so the lead's
  // own stages survive a missing/partial `stageSet`.
  const inStageSet = (stageName: string): boolean =>
    stageSet.some((s) => stageNamesMatch(s.stageName, stageName)) ||
    ownedStages.some((s) => stageNamesMatch(s.stageName, stageName));
  return STAGE_NAMES.filter(inStageSet).map((stageName) => {
    const ownedStage =
      ownedStages.find((s) => stageNamesMatch(s.stageName, stageName)) ?? null;
    if (ownedStage) {
      return deriveOwnedStageRow(stageName, ownedStage, ownerLabel, risks);
    }
    // unassigned-stage-reporting-exclusion: in the product's stage set but not
    // owned by this lead — foreign-owned, rendered read-only (`locked`). In
    // Everyone mode `applyCrossAuthorStageOverrides` fills the real assignee +
    // status; in Mine mode it is hidden by the visibility filter.
    return {
      stageName,
      status: "empty" as const,
      ownership: "locked" as const,
      assignee: null,
    };
  });
}

/**
 * Map a section's projects -> presentation Product[].
 *
 * unassigned-stage-reporting-exclusion: each project's `stageSet` (the
 * union of all leads' `StageAssignment` rows on the product) sources the grid;
 * `ownedStages` (scoped to the section author) marks which of those render as
 * "mine" vs foreign-owned "locked". A stage with no assignment is absent from
 * the set and excluded — no vacant chip.
 *
 * Previously this mapper synthesized a fake grid that hard-coded the lead
 * onto "Dev", so assigning a lead to all 7 stages on the Products admin tab
 * did not show up on /lead/report.
 */
export function mapLeadProducts(
  section: ReportSectionReadModel,
): LeadProduct[] {
  return section.projects.map((p) => {
    const ownedStages = p.ownedStages ?? [];
    const overallStatus = trafficToStageStatus(p.trafficLight);
    // rethink-pipeline-state-vs-completeness: pass the covering risks so a
    // TOUCHED stage floors up / collapses down correctly, while an UNTOUCHED
    // (empty) stage keeps raw `status: "empty"` (see buildStageGrid).
    // buildStageGrid also tags it `coveredByOwnRisk` when an own risk names it,
    // which is how an empty-but-risk-staged stage counts toward completeness.
    const coveringRisks = section.risks.filter(
      (r) => r.projectId === p.projectId && r.risk.trim().length > 0,
    );
    return {
      id: p.projectId,
      name: p.projectName,
      overallStatus,
      // unassigned-stage-reporting-exclusion: the product's assigned-stage set
      // sources the grid; a stage with no assignment is excluded entirely.
      stages: buildStageGrid(
        section.authorName,
        ownedStages,
        p.stageSet ?? [],
        coveringRisks,
      ),
    };
  });
}

/**
 * Map a section's items (filtered by `type`) into KanbanItems.
 *
 * Each item's display status flows through `deriveItemStatus`.
 * Product name is resolved via `section.projects[i].projectName`.
 */
export function mapLeadItems(
  section: ReportSectionReadModel,
  itemType: "current" | "next",
): LeadKanbanItem[] {
  const projectIndex = buildProjectIndex(section);
  const activityNameById = new Map(
    section.activities.map((a) => [a.activityId, a.activityName]),
  );
  // Rows with EITHER parent render in the week sections — product rows under
  // their product column, activity rows under their activity lane
  // (buildItemColumns). A row with neither parent is malformed and stays
  // excluded.
  return section.items
    .filter(
      (item) =>
        item.type === itemType &&
        (item.projectId != null || item.activityId != null),
    )
    .map((item) => {
      const activityName =
        item.activityId != null
          ? (activityNameById.get(item.activityId) ?? "Unknown")
          : undefined;
      const project =
        item.projectId != null ? projectIndex.get(item.projectId) : undefined;
      const status = deriveItemStatus({
        workflowStatus: item.workflowStatus,
        type: item.type,
      });
      return {
        id:
          item.id ??
          `${itemType}-${item.projectId ?? item.activityId ?? "row"}-${item.text.slice(0, ID_TEXT_FRAGMENT_LENGTH)}`,
        productId: item.projectId ?? "",
        // An activity row's display parent is the activity itself.
        productName: project?.name ?? activityName ?? "Unknown",
        ...(item.activityId != null
          ? { activityId: item.activityId, activityName }
          : {}),
        // Stage array from DB — surfaces on the kanban card and groups items
        // by product+stage. Undefined for legacy rows seeded before the
        // column existed.
        ...(item.stageIds ? { stageIds: item.stageIds } : {}),
        status,
        text: item.text,
        author: section.authorName,
        // priorityRank rides the bound KanbanItem so ItemEditDialog
        // re-populates the field on reopen (dropping it left the field empty
        // after reload even though the value persisted).
        priorityRank: item.priorityRank ?? null,
        // require-paused-item-reason: surfaced on the card and round-tripped
        // through sectionToDraftPayload so it survives a save.
        pausedReason: item.pausedReason ?? null,
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
  const activityNameById = new Map(
    section.activities.map((a) => [a.activityId, a.activityName]),
  );
  // Activity-parented risks render in the Risks section labeled with the
  // activity name, beside product risks.
  return section.risks
    .filter((r) => r.projectId != null || r.activityId != null)
    .map((r, idx) => {
      const activityName =
        r.activityId != null
          ? (activityNameById.get(r.activityId) ?? "Unknown")
          : undefined;
      const project =
        r.projectId != null ? projectIndex.get(r.projectId) : undefined;
      return {
        id: r.id ?? `risk-${idx}`,
        productId: r.projectId ?? "",
        productName: project?.name ?? activityName ?? "Unknown",
        ...(r.activityId != null
          ? { activityId: r.activityId, activityName }
          : {}),
        // Stage array from DB; legacy rows fall back to undefined.
        stageIds: r.stageIds,
        severity: r.severity,
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
  const activityNameById = new Map(
    section.activities.map((a) => [a.activityId, a.activityName]),
  );
  // Product-parented, legacy parentless ("Group"), AND activity-parented
  // decisions all render in the Decisions section — activity rows labeled
  // with the activity name.
  const decisions: SectionDecision[] = section.decisions;
  return decisions.map((d, idx) => ({
    id: d.id ?? `decision-${idx}`,
    productId: d.productId ?? "",
    productName:
      (d.productId ? projectIndex.get(d.productId)?.name : undefined) ??
      (d.activityId != null
        ? (activityNameById.get(d.activityId) ?? "Unknown")
        : "Group"),
    ...(d.activityId != null
      ? {
          activityId: d.activityId,
          activityName: activityNameById.get(d.activityId) ?? "Unknown",
        }
      : {}),
    text: d.text,
    owner: d.owner,
    impact: d.impact,
    deadline: d.deadline
      ? new Date(d.deadline).toISOString().slice(0, ISO_DATE_LENGTH)
      : null,
    stageIds: d.stageIds,
  }));
}

// One attached activity as a STATUS-ONLY card — stored + risk/blocker-derived
// status and the label-only linked products. The activity's records render in
// the main record sections (mapLeadItems/mapLeadRisks/mapLeadDecisions
// include activity-parented rows).
export interface LeadActivityCard {
  readonly activityId: string;
  readonly activityName: string;
  /** Stored lead-chosen status (nullable legacy). */
  readonly status: TrafficLightStatus | null;
  /**
   * Risk/blocker floor folded with the lead's stored choice — read-only surfaces
   * (slides, head report) render `derivedStatus ?? status`. Server-computed.
   */
  readonly derivedStatus: TrafficLightStatus | null;
  /**
   * The RECORD-ONLY floor (covering risks/blockers), excluding the stored choice.
   * The interactive pill gates a manual lower on THIS — so a lead can still lower
   * a status they raised themselves — and displays `worse(status, alarmFloor)`.
   */
  readonly alarmFloor: TrafficLightStatus | null;
  readonly linkedProducts: readonly {
    productId: string;
    productName: string;
  }[];
}

function mapLeadActivityCards(
  section: ReportSectionReadModel,
): LeadActivityCard[] {
  return section.activities.map((activity) => ({
    activityId: activity.activityId,
    activityName: activity.activityName,
    status: activity.status,
    derivedStatus: activity.derivedStatus,
    alarmFloor: activity.alarmFloor ?? null,
    linkedProducts: activity.linkedProducts,
  }));
}

export function mapLeadPriorities(
  section: ReportSectionReadModel,
): LeadPriorityEntry[] {
  const projectIndex = buildProjectIndex(section);
  // activity-first-class: priorities are a product-side surface. An activity
  // item is never a product priority, so keep only product-parented items here.
  return section.items
    .filter(
      (i): i is SectionItem & { projectId: string } =>
        i.priorityRank != null && i.projectId != null,
    )
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
      dateRange: formatPeriodRangeWithYear(e.periodStart, e.periodEnd),
      isCurrent: activeReportId !== null && e.reportId === activeReportId,
      isSubmitted: e.sectionStatus === "submitted",
      archived: e.archived ?? false,
      itemCount: e.itemCount,
      riskCount: e.riskCount,
      productCount: e.productCount,
    }));
}

/**
 * review-acknowledgement: one of the lead's OWN records that carries
 * reviewer comments. Surfaced read-only when a returned (draft) section comes
 * back, so the feedback is not silent. `text` is the record's OWN text — context
 * for the lead, NEVER re-rendered as a comment.
 */
export interface LeadReviewFeedbackRecord {
  readonly id: string;
  readonly kind: "item" | "risk" | "decision";
  readonly productName: string;
  readonly text: string;
  readonly comments: readonly RecordCommentView[];
}

/**
 * Reshape one record collection (items / risks / decisions) into feedback
 * rows: records with zero reviewer comments are dropped, the rest carry an
 * id-fallback of `""` and the caller-resolved kind/text/label. Shared by the
 * three `mapLeadReviewFeedback` branches below so they differ only in which
 * fields feed `textOf` / `labelOf`.
 */
function toFeedbackRecords<
  T extends { id?: string | null; comments?: readonly RecordCommentView[] },
>(
  records: readonly T[],
  kind: LeadReviewFeedbackRecord["kind"],
  textOf: (record: T) => string,
  labelOf: (record: T) => string,
): LeadReviewFeedbackRecord[] {
  return records
    .filter((record) => (record.comments?.length ?? 0) > 0)
    .map((record) => ({
      id: record.id ?? "",
      kind,
      productName: labelOf(record),
      text: textOf(record),
      comments: record.comments ?? [],
    }));
}

/**
 * Collect every item/risk/decision on the section that carries ≥1 reviewer
 * comment, keyed to the record's own text + resolved product name. Records with
 * no comments are dropped (nothing to surface). The comment payload rides the
 * read model (the repo joins `RecordComment` into the section read); this mapper
 * only reshapes it for the lead's feedback panel.
 */
export function mapLeadReviewFeedback(
  section: ReportSectionReadModel,
): LeadReviewFeedbackRecord[] {
  const projectIndex = buildProjectIndex(section);
  // activity-first-class: an activity-parented record has a null projectId, so
  // resolve its label from the section's activities instead of falling through
  // to "Unknown". The product name wins when present (XOR — a record parents to
  // exactly one), else the activity name, else "Unknown" for orphaned legacy.
  const activityIndex = new Map(
    section.activities.map((a) => [a.activityId, a.activityName]),
  );
  const labelFor = (
    projectId: string | null | undefined,
    activityId: string | null | undefined,
  ): string => {
    if (projectId) return projectIndex.get(projectId)?.name ?? "Unknown";
    if (activityId) return activityIndex.get(activityId) ?? "Unknown";
    return "Unknown";
  };

  return [
    ...toFeedbackRecords(
      section.items,
      "item",
      (item) => item.text,
      (item) => labelFor(item.projectId, item.activityId),
    ),
    ...toFeedbackRecords(
      section.risks,
      "risk",
      (risk) => risk.risk,
      (risk) => labelFor(risk.projectId, risk.activityId),
    ),
    ...toFeedbackRecords(
      section.decisions,
      "decision",
      (decision) => decision.text,
      (decision) =>
        labelFor(decision.productId ?? undefined, decision.activityId),
    ),
  ];
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
  byPeriod: {
    section: ReportSectionReadModel;
    readOnly: boolean;
    /**
     * reopen-request-lifecycle: server-computed flag — true only when the
     * lead may file a reopen request (submitted section, open/reopened period,
     * no pending request). The button reads this; it does NOT reconstruct the
     * policy. Optional so legacy/test args without it default to "hidden".
     */
    canRequestReopen?: boolean;
  };
  history: readonly MyHistoryEntry[];
}

export interface MappedLeadForm {
  products: LeadProduct[];
  currentWeekItems: LeadKanbanItem[];
  nextWeekItems: LeadKanbanItem[];
  risks: LeadRiskEntry[];
  decisions: LeadDecisionEntry[];
  priorities: LeadPriorityEntry[];
  /** activity-first-class: the author's attached activities as full record cards. */
  activityCards: LeadActivityCard[];
  periods: LeadReportPeriod[];
  currentUser: LeadCurrentUser;
  /** Whether the section is locked for the current user (submitted or period published). */
  readOnly: boolean;
  /**
   * reopen-request-lifecycle: whether to show the lead's Request Reopen
   * control. Server-computed; the client never reconstructs the lifecycle.
   */
  canRequestReopen: boolean;
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

  // Surface the section author's role end-to-end. The display label
  // comes from the shared `ROLE_LABEL` home; the raw token (`authorRole`) is
  // exposed so role-based UI gating doesn't have to reverse-engineer the label
  // string. Defaults to 'lead' when the read model omits it (legacy fixtures,
  // harness-driven tests).
  const authorRole: DbRole = args.active.authorRole ?? "lead";
  const roleLabel = ROLE_LABEL[authorRole];

  return {
    products: mapLeadProducts(section),
    currentWeekItems: mapLeadItems(section, "current"),
    nextWeekItems: mapLeadItems(section, "next"),
    risks: mapLeadRisks(section),
    decisions: mapLeadDecisions(section),
    priorities: mapLeadPriorities(section),
    activityCards: mapLeadActivityCards(section),
    periods: mapLeadPeriods(args.history, args.active.reportId),
    currentUser: {
      name: args.active.authorName,
      initials: initialsFromName(args.active.authorName),
      role: roleLabel,
      authorRole,
    },
    readOnly,
    canRequestReopen: args.byPeriod.canRequestReopen ?? false,
  };
}
