import type {
  ReportSectionReadModel,
  ResolvePlanInput,
} from "@weeklyreport/shared";

import {
  hasOtherPlacement,
  moveToNextWeekPatch,
} from "./lead-actions/lead-item-actions";

type SectionItem = ReportSectionReadModel["items"][number];

export type PlanVerdict = "done" | "continue" | "next" | "paused" | "wont_do";

export interface PlanVerdictRequest {
  readonly verdict: PlanVerdict;
  /** One-line reason; required for `paused` and `wont_do`. */
  readonly reason?: string | undefined;
  /** Prior-week record the verdict answers; it is never written. */
  readonly prior: { readonly reportId: string; readonly item: SectionItem };
  /** The selected week's record with the same `stableId`, if one exists. */
  readonly linked: SectionItem | null;
  /**
   * Every selected-week record with this `stableId`, `linked` included. Lets a
   * Next verdict see a separate Next record next to a carried Current one.
   * Omitted: `linked` is taken as the only record.
   */
  readonly siblings?: readonly SectionItem[] | undefined;
}

type ResolvePlanFields = Omit<
  ResolvePlanInput,
  "reportSectionId" | "version" | "commandId"
>;

export type PlanVerdictWrite =
  /** Ordinary draft save of the linked occurrence. */
  | {
      readonly kind: "item-patch";
      readonly itemId: string;
      readonly patch: Partial<SectionItem>;
    }
  /**
   * Existing plan-outcome command. `thenPatch` finishes what the command cannot
   * express (paused) on the occurrence it creates, located by `stableId`.
   */
  | {
      readonly kind: "resolve-plan";
      readonly input: ResolvePlanFields;
      readonly thenPatch?: Partial<SectionItem>;
    }
  /** The week already holds the explicit Next commitment; nothing to write. */
  | { readonly kind: "already-recorded" }
  | { readonly kind: "blocked"; readonly reason: string };

const OUTCOME_BY_VERDICT = {
  done: "done",
  continue: "continue",
  next: "plan_next",
  paused: "continue",
  wont_do: "wont_do",
} as const satisfies Record<PlanVerdict, ResolvePlanInput["outcome"]>;

function resolvePlan(
  input: ResolvePlanFields,
  thenPatch?: Partial<SectionItem>,
): PlanVerdictWrite {
  return thenPatch === undefined
    ? { kind: "resolve-plan", input }
    : { kind: "resolve-plan", input, thenPatch };
}

function requiredReason(request: PlanVerdictRequest): string {
  const reason = request.reason?.trim() ?? "";
  if (reason === "")
    throw new Error(
      request.verdict === "paused"
        ? "Explain why this plan is paused."
        : "Explain why this plan will not be done.",
    );
  return reason;
}

// No occurrence in the selected week: the outcome command creates it from the
// prior record, keeping its parent and tag server-side and its stages and
// priority explicitly.
function priorOutcome(request: PlanVerdictRequest): PlanVerdictWrite {
  const { verdict, prior } = request;
  const recordId = prior.item.id;
  if (recordId === undefined)
    return { kind: "blocked", reason: "The prior plan is not available." };
  const source = { kind: "prior" as const, reportId: prior.reportId, recordId };
  const outcome = OUTCOME_BY_VERDICT[verdict];
  if (verdict === "wont_do")
    return resolvePlan({ source, outcome, reason: requiredReason(request) });
  const input: ResolvePlanFields = {
    source,
    outcome,
    stageNames: [...prior.item.stageNames],
    priorityRank: prior.item.priorityRank ?? null,
  };
  return verdict === "paused"
    ? resolvePlan(input, {
        workflowStatus: "paused",
        pausedReason: requiredReason(request),
      })
    : resolvePlan(input);
}

// A done or paused occurrence returns to planned when the lead continues it;
// any other status is left as the rollover or the lead wrote it.
function continuePatch(linked: SectionItem): Partial<SectionItem> {
  const reopen =
    linked.workflowStatus === "done" || linked.workflowStatus === "paused";
  return {
    type: "current",
    carriedOver: false,
    ...(reopen ? { workflowStatus: "planned", pausedReason: null } : {}),
  };
}

// A record holds one week placement per `stableId`, so Next is either the
// record itself moved, or the commitment it already carries.
function nextPatch(
  linked: SectionItem,
  siblings: readonly SectionItem[],
): Partial<SectionItem> | null {
  if (linked.type === "next" || hasOtherPlacement(siblings, linked, "next"))
    return null;
  return linked.nextStepText?.trim()
    ? { carriedOver: false }
    : {
        ...moveToNextWeekPatch(),
        workflowStatus: "planned",
        pausedReason: null,
        nextStepText: null,
      };
}

function linkedPatch(
  request: PlanVerdictRequest,
  linked: SectionItem,
): Partial<SectionItem> | null {
  switch (request.verdict) {
    case "done":
      return {
        type: "current",
        workflowStatus: "done",
        pausedReason: null,
        nextStepText: null,
        carriedOver: false,
      };
    case "continue":
      return continuePatch(linked);
    case "paused":
      return {
        type: "current",
        workflowStatus: "paused",
        pausedReason: requiredReason(request),
        carriedOver: false,
      };
    case "next":
      return nextPatch(linked, request.siblings ?? [linked]);
    case "wont_do":
      return null;
  }
}

function linkedWrite(
  request: PlanVerdictRequest,
  linked: SectionItem,
): PlanVerdictWrite {
  if (linked.resolution != null)
    return {
      kind: "blocked",
      reason: "Restore this plan before giving it a verdict.",
    };
  if (linked.id === undefined)
    return { kind: "blocked", reason: "The item is not saved yet." };
  if (request.verdict === "wont_do")
    return resolvePlan({
      source: { kind: "current", recordId: linked.id },
      outcome: "wont_do",
      reason: requiredReason(request),
    });
  const patch = linkedPatch(request, linked);
  return patch === null
    ? { kind: "already-recorded" }
    : { kind: "item-patch", itemId: linked.id, patch };
}

/**
 * Maps a prior-week verdict to the one write that records it without touching
 * the prior week. A linked occurrence is saved as an ordinary item (stages, tag
 * and priority are never part of the patch); otherwise the existing plan-outcome
 * command creates it. Throws when a required reason is blank.
 */
export function planVerdictWrite(
  request: PlanVerdictRequest,
): PlanVerdictWrite {
  return request.linked === null
    ? priorOutcome(request)
    : linkedWrite(request, request.linked);
}

/** What a Previously planned item shows: the verdict rail or the accepted stamp. */
export type PriorVerdictState = PlanVerdict | "pending";

/**
 * Derives the verdict state of a prior-week item from the selected week's
 * occurrence with the same `stableId`. Nothing is stored on the prior record:
 * no occurrence, or an unconfirmed carried one, is still pending; any other
 * occurrence already is the lead's verdict. Null when no verdict applies
 * (cancelled prior plan, or the lead cannot edit and nothing was decided).
 */
export function priorVerdictState(
  prior: SectionItem,
  linked: SectionItem | null,
  editable: boolean,
): PriorVerdictState | null {
  if (prior.resolution != null) return null;
  if (linked === null || (linked.type === "current" && linked.carriedOver))
    return editable ? "pending" : null;
  if (linked.resolution != null) return "wont_do";
  if (linked.type === "next" || linked.workflowStatus === "postponed")
    return "next";
  if (linked.workflowStatus === "done") return "done";
  return linked.workflowStatus === "paused" ? "paused" : "continue";
}
