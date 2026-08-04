import type {
  DraftSavePayload,
  ReportSectionReadModel,
} from "@customreport/shared";

export type DraftSaveContent = Omit<DraftSavePayload, "version">;

// Filter blank required text — safeText({min:1}) would reject and toast-fail
// on every "+ Add" before the user types. Empty rows stay local-only until filled.
const hasText = (s: string | null | undefined) =>
  typeof s === "string" && s.trim().length > 0;

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
      workflowStatus: it.workflowStatus,
      carriedOver: it.carriedOver,
      stageNames: it.stageNames ?? [],
      priorityRank: it.priorityRank ?? null,
      pausedReason:
        it.workflowStatus === "paused" ? (it.pausedReason ?? null) : null,
    }));
}

function toRiskDrafts(risks: ReportSectionReadModel["risks"]) {
  return risks
    .filter(
      (r) => hasText(r.risk) && hasText(r.impact) && hasText(r.mitigation),
    )
    .map((r) => ({
      id: r.id,
      stableId: r.stableId,
      projectId: r.projectId ?? null,
      activityId: r.activityId ?? null,
      risk: r.risk,
      impact: r.impact,
      mitigation: r.mitigation,
      severity: r.severity,
      stageNames: r.stageNames ?? [],
    }));
}

function toDecisionDrafts(decisions: ReportSectionReadModel["decisions"]) {
  return decisions
    .filter((d) => hasText(d.text) && hasText(d.owner) && hasText(d.impact))
    .map((d) => ({
      id: d.id,
      stableId: d.stableId,
      text: d.text,
      owner: d.owner,
      deadline: d.deadline ?? null,
      impact: d.impact,
      resolvedAt: d.resolvedAt ?? null,
      stageNames: d.stageNames ?? [],
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
    activityStatuses: section.activities.map((activity) => ({
      activityId: activity.activityId,
      status: activity.status,
      note: activity.note ?? null,
    })),
    items: toItemDrafts(section.items),
    risks: toRiskDrafts(section.risks),
    decisions: toDecisionDrafts(section.decisions),
  };
}
