/**
 * Composes the three `LeadForm`-page tRPC queries into the mock-shaped slices
 * the existing presentational components expect:
 *
 *   - `reports.getActive`     -> `ReportSectionReadModel | null`
 *   - `leadForm.byPeriod`     -> `{ section: ReportSectionReadModel; readOnly: boolean }`
 *   - `reports.myHistory`     -> `MyHistoryEntry[]`
 *
 * Each record-family mapper lives in a sibling `lead-form-*` module and
 * documents its own resolution rules; this file re-exports them and wires the
 * composer. `leadForm.byPeriod` returns a single section, and `products` /
 * `risks` / `decisions` / `priorities` are derived from that section's flat
 * arrays.
 */

import type {
  DbRole,
  MyHistoryEntry,
  ReportSectionReadModel,
  TrafficLightStatus,
} from "@customreport/shared";
import {
  initialsFromName as sharedInitialsFromName,
  normalizeStageName,
  ROLE_LABEL,
  stageNamesMatch,
} from "@customreport/shared";

import { mapLeadDecisions, mapLeadPriorities } from "./lead-form-decisions";
import { mapLeadItems } from "./lead-form-items";
import {
  mapLeadPeriods,
  mapLeadProducts,
  ownedStagesForProject,
} from "./lead-form-periods-products";
import { mapLeadReviewFeedback } from "./lead-form-review-feedback";
import { mapLeadRisks } from "./lead-form-risks";

export type { LeadDecisionEntry } from "./lead-form-decisions";
export type { LeadKanbanItem } from "./lead-form-items";
export type { LeadProduct } from "./lead-form-periods-products";
export type { LeadReviewFeedbackRecord } from "./lead-form-review-feedback";
export type { LeadRiskEntry } from "./lead-form-risks";
export {
  mapLeadDecisions,
  mapLeadItems,
  mapLeadPeriods,
  mapLeadPriorities,
  mapLeadProducts,
  mapLeadReviewFeedback,
  mapLeadRisks,
  ownedStagesForProject,
};

// The Dev↔Development stage-name canonicalization is single-homed in
// @customreport/shared so the server ownership guard and this client mapper
// never disagree on whether two names refer to the same pipeline slot.
// Re-exported for the web modules that pull it from this barrel.
export { normalizeStageName, stageNamesMatch };

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

// Avatar initials via the canonical shared helper (surname-first ФИО), with
// this surface's "??" placeholder for an empty name. The token logic lives once
// in @customreport/shared so cloned copies can't diverge.
function initialsFromName(name: string): string {
  return sharedInitialsFromName(name) || "??";
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
  products: ReturnType<typeof mapLeadProducts>;
  currentWeekItems: ReturnType<typeof mapLeadItems>;
  nextWeekItems: ReturnType<typeof mapLeadItems>;
  risks: ReturnType<typeof mapLeadRisks>;
  decisions: ReturnType<typeof mapLeadDecisions>;
  priorities: ReturnType<typeof mapLeadPriorities>;
  /** activity-first-class: the author's attached activities as full record cards. */
  activityCards: LeadActivityCard[];
  periods: ReturnType<typeof mapLeadPeriods>;
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
