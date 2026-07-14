import type {
  DraftSavePayload,
  ReportSectionReadModel,
} from "@customreport/shared";

export type DraftSaveContent = Omit<DraftSavePayload, "version">;

/**
 * Durable `stableId` round-trip is load-bearing: dropping it makes every save
 * re-mint record identity and breaks published-lineage preservation.
 */
export function sectionToDraftPayload(
  section: ReportSectionReadModel,
): DraftSaveContent {
  // Drop rows whose required text fields are empty or whitespace-only. The
  // server's safeText({min:1}) Zod refinement rejects them, which would
  // otherwise produce "Save failed" toast every time the user clicks
  // "+ Add Risk/Decision/Item" before typing. Empty rows live only in
  // local UI state until the user fills them in; once any required field
  // becomes non-empty the row joins the autosave payload.
  const hasText = (s: string | null | undefined) =>
    typeof s === "string" && s.trim().length > 0;
  return {
    reportSectionId: section.reportSectionId,
    status: "draft",
    projectStatuses: section.projects.map((p) => ({
      projectId: p.projectId,
      status: p.trafficLight ?? undefined,
    })),
    stageStatuses: section.projects.flatMap((p) =>
      (p.ownedStages ?? []).map((stage) => ({
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
    items: section.items
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
        stageIds: it.stageIds ?? [],
        priorityRank: it.priorityRank ?? null,
        pausedReason:
          it.workflowStatus === "paused" ? (it.pausedReason ?? null) : null,
      })),
    risks: section.risks
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
        stageIds: r.stageIds ?? [],
      })),
    decisions: section.decisions
      .filter((d) => hasText(d.text) && hasText(d.owner) && hasText(d.impact))
      .map((d) => ({
        id: d.id,
        stableId: d.stableId,
        text: d.text,
        owner: d.owner,
        deadline: d.deadline ?? null,
        impact: d.impact,
        resolvedAt: d.resolvedAt ?? null,
        stageIds: d.stageIds ?? [],
        productId: d.productId ?? null,
        activityId: d.activityId ?? null,
      })),
  };
}
