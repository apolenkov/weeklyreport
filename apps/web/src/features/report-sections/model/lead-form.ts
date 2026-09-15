// Compose the three LeadForm query slices; sibling mappers own record-field
// resolution while this module wires the shared presentation shape.

import type {
  DbRole,
  MyHistoryEntry,
  ReportSectionReadModel,
  TrafficLightStatus,
} from "@customreport/shared";
import { ROLE_LABEL } from "@customreport/shared";

import { activityDisplayTitle } from "../../../shared/lib/activity/activity-display";
import { initialsFromName } from "../../../shared/lib/format/user-initials";
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

export interface LeadCurrentUser {
  name: string;
  initials: string;
  // Derived from authorRole so head/admin views do not receive a fixed label.
  role: string;
  // Raw role token drives head/admin action gates such as Revoke.
  authorRole: DbRole;
}

// One attached activity as a STATUS-ONLY card — stored + risk/blocker-derived
// status and the label-only linked products. The activity's records render in
// the main record sections (mapLeadItems/mapLeadRisks/mapLeadDecisions
// include activity-parented rows).
export interface LeadActivityCard {
  readonly activityId: string;
  readonly activityName: string;
  // Weekly override of the catalogue name; null renders the catalogue name.
  readonly titleOverride: string | null;
  // Effective weekly title: a non-blank override, else the catalogue name.
  readonly displayTitle: string;
  // Weekly description persisted beside the status (the note column).
  readonly note: string | null;
  readonly status: TrafficLightStatus | null;
  // Server-derived risk floor used by read-only surfaces.
  readonly derivedStatus: TrafficLightStatus | null;
  // Record-only alarm floor gates manual lowering; the stored choice is excluded.
  readonly alarmFloor: TrafficLightStatus | null;
  readonly linkedProducts: readonly {
    productId: string;
    productName: string;
  }[];
}

function mapLeadActivityCards(
  section: ReportSectionReadModel,
): LeadActivityCard[] {
  return section.activities.map((activity) => {
    const titleOverride = activity.titleOverride ?? null;
    return {
      activityId: activity.activityId,
      activityName: activity.activityName,
      titleOverride,
      displayTitle: activityDisplayTitle(activity),
      note: activity.note ?? null,
      status: activity.status,
      derivedStatus: activity.derivedStatus,
      alarmFloor: activity.alarmFloor ?? null,
      linkedProducts: activity.linkedProducts,
    };
  });
}

// ---- Composer ----

export interface MapLeadFormArgs {
  // Active query section; callers pass settled data before mapping.
  active: ReportSectionReadModel;
  // Period-scoped section and server lock state used by the form.
  byPeriod: {
    section: ReportSectionReadModel;
    readOnly: boolean;
    // Server-computed lifecycle gate; the client never reconstructs policy.
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
  activityCards: LeadActivityCard[];
  periods: ReturnType<typeof mapLeadPeriods>;
  currentUser: LeadCurrentUser;
  readOnly: boolean;
  // Server-computed reopen control; the client never reconstructs lifecycle.
  canRequestReopen: boolean;
}

// Inputs must be settled before mapping; page guards own loading checks.
export function mapLeadFormData(args: MapLeadFormArgs): MappedLeadForm {
  const section = args.byPeriod.section;
  // Lock the form when the period is locked OR the section is already submitted.
  const readOnly = args.byPeriod.readOnly || section.status === "submitted";

  // Surface the section author's role end-to-end. The display label
  // comes from the shared `ROLE_LABEL` home; the raw token (`authorRole`) is
  // exposed so role-based UI gating doesn't have to reverse-engineer the label
  // string.
  const authorRole: DbRole = args.active.authorRole;
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
