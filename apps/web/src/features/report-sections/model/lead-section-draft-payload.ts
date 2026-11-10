import {
  hasVisibleText,
  type IncompleteDraftSavePayload,
  type ReportSectionReadModel,
  type TrafficLightStatus,
} from "@weeklyreport/shared";

// The draft producer owns content without optimistic-lock metadata; writers
// inject the current version only when they issue a mutation, and the
// transport names the stored unfinished records the content leaves out.
export type DraftSaveContent = Omit<
  IncompleteDraftSavePayload,
  "version" | "deletedIncompleteRecords"
>;

// Filter required text safeText would reject (blank or invisible-only): one such
// row would fail the whole autosave. Those rows stay local-only until filled.
const hasText = (s: string | null | undefined) =>
  typeof s === "string" && hasVisibleText(s);

// A detail the author has not written yet is saved as missing, not as text.
const detailOrNull = (s: string): string | null => (hasText(s) ? s : null);

function toItemDrafts(items: ReportSectionReadModel["items"]) {
  return items
    .filter((it) => hasText(it.text))
    .map((it) => ({
      id: it.id,
      stableId: it.stableId,
      projectId: it.projectId ?? null,
      activityId: it.activityId ?? null,
      type: it.type,
      text: it.text,
      tag: it.tag,
      nextStepText: it.nextStepText ?? null,
      workflowStatus: it.workflowStatus,
      carriedOver: it.carriedOver,
      stageNames: it.stageNames,
      priorityRank: it.priorityRank ?? null,
      pausedReason:
        it.workflowStatus === "paused" ? (it.pausedReason ?? null) : null,
    }));
}

// A risk is saved as soon as it is named: impact and mitigation may follow
// later, and until then the record stays an unfinished draft only its author
// sees.
function toRiskDrafts(risks: ReportSectionReadModel["risks"]) {
  return risks
    .filter((r) => hasText(r.risk))
    .map((r) => ({
      id: r.id,
      stableId: r.stableId,
      projectId: r.projectId ?? null,
      activityId: r.activityId ?? null,
      risk: r.risk,
      impact: detailOrNull(r.impact),
      mitigation: detailOrNull(r.mitigation),
      severity: r.severity,
      stageNames: r.stageNames,
    }));
}

// The server stores every decision under the section author (see
// report-section-merge.ts); mirroring that keeps the draft key equal to the
// saved key, otherwise autosave re-saves forever. Like a risk, a decision is
// saved once it has its text; its impact may still be missing.
function toDecisionDrafts(
  decisions: ReportSectionReadModel["decisions"],
  authorName: string,
) {
  return decisions
    .filter((d) => hasText(d.text) && hasText(d.owner))
    .map((d) => ({
      id: d.id,
      stableId: d.stableId,
      text: d.text,
      owner: authorName,
      deadline: d.deadline ?? null,
      impact: detailOrNull(d.impact),
      resolvedAt: d.resolvedAt ?? null,
      stageNames: d.stageNames,
      productId: d.productId ?? null,
      activityId: d.activityId ?? null,
    }));
}

// stableId round-trip is load-bearing: dropping it re-mints identity each save.
export function sectionToDraftPayload(
  section: ReportSectionReadModel,
): DraftSaveContent {
  return {
    reportSectionId: section.reportSectionId,
    status: "draft",
    projectStatuses: section.projects.map((p) => ({
      projectId: p.projectId,
      status: p.trafficLight ?? undefined,
    })),
    stageStatuses: section.projects.flatMap((p) =>
      p.ownedStages.map((stage) => ({
        projectId: p.projectId,
        stageId: stage.stageId,
        status: stage.status ?? null,
      })),
    ),
    activityStatuses: section.activities.map(toActivityStatusPayload),
    items: toItemDrafts(section.items),
    risks: toRiskDrafts(section.risks),
    decisions: toDecisionDrafts(section.decisions, section.authorName),
  };
}

/**
 * Rows the user started typing that cannot reach the payload yet because a
 * required field is still blank. The autosave comparison key cannot see them, so
 * callers treat them as local edits: a server reseed then reports the conflict
 * instead of discarding them silently. Fully blank rows are not user content and
 * are not counted.
 */
export function countLocalOnlyRows(section: ReportSectionReadModel): number {
  const anyText = (values: readonly (string | null | undefined)[]) =>
    values.some((value) => hasText(value));
  // Items need only `text`; the other fields are optional, so a row is local-only
  // exactly when the payload drops it while the user typed text into it anyway.
  const itemsAwaitingText = section.items.filter(
    (it) =>
      !hasText(it.text) &&
      (hasText(it.nextStepText) || hasText(it.pausedReason)),
  ).length;
  // A risk waits for its name, a decision for its text and owner; details
  // typed ahead of them are the only content the payload cannot carry.
  return (
    itemsAwaitingText +
    section.risks.filter(
      (r) => !hasText(r.risk) && anyText([r.impact, r.mitigation]),
    ).length +
    section.decisions.filter(
      (d) =>
        !(hasText(d.text) && hasText(d.owner)) &&
        anyText([d.text, d.owner, d.impact]),
    ).length
  );
}

// One owner for the activityStatuses payload shape: draft save and submit both
// project through it, so a new activity field cannot drift between them. The
// draft payload types titleOverride through the schema's preprocessing input
// (unknown), so normalize it here rather than re-listing keys at each caller.
export function toActivityStatusPayload<
  S extends TrafficLightStatus | null,
>(row: {
  readonly activityId: string;
  readonly status: S;
  readonly titleOverride?: unknown;
  readonly note?: string | null | undefined;
}): {
  activityId: string;
  status: S;
  titleOverride: string | null;
  note: string | null;
} {
  return {
    activityId: row.activityId,
    status: row.status,
    titleOverride:
      typeof row.titleOverride === "string" ? row.titleOverride : null,
    note: row.note ?? null,
  };
}
