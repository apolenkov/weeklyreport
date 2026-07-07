import {
  type DraftSavePayload,
  type ReportSectionReadModel,
  reportSectionReadModelSchema,
  type SubmitSectionPayload,
} from "@customreport/shared";

/**
 * The draft/submit write-path merge: folds a save/submit payload onto the
 * server-loaded section read model — stage statuses, per-project traffic-light
 * aggregation, lead-owned decisions, and the activity-status slice.
 */

/** Worst-case severity rank for the per-project traffic-light aggregation (any red stage wins). */
const TRAFFIC_LIGHT_RED_SEVERITY = 3;
export function mergeSection(
  section: ReportSectionReadModel,
  input: DraftSavePayload | SubmitSectionPayload,
  nextStatus: "draft" | "submitted",
  // Explicit late flag set by submitSection when `now > Report.deadline` at
  // submit-time. Defaults to whatever the existing section row already carries
  // so saveDraft / reopen paths don't accidentally clear a previously-stamped
  // late flag.
  late?: boolean,
): ReportSectionReadModel {
  const stageStatusByKey = new Map(
    (input.stageStatuses ?? []).map((status) => [
      `${status.projectId}::${status.stageId}`,
      status.status ?? null,
    ]),
  );

  const aggregateTrafficLight = (
    ownedStages: NonNullable<
      ReportSectionReadModel["projects"][number]["ownedStages"]
    >,
  ) => {
    let severity = 0;
    for (const stage of ownedStages) {
      if (stage.status === "red") {
        severity = TRAFFIC_LIGHT_RED_SEVERITY;
        break;
      }
      if (stage.status === "yellow") severity = Math.max(severity, 2);
      if (stage.status === "green") severity = Math.max(severity, 1);
    }
    return severity === TRAFFIC_LIGHT_RED_SEVERITY
      ? "red"
      : severity === 2
        ? "yellow"
        : severity === 1
          ? "green"
          : null;
  };
  const leadOwnedDecisions = input.decisions.map((decision) => ({
    ...decision,
    // The lead form owner input is read-only and represents the section owner.
    // Persisting a stale display name here makes the lead's own rows look
    // foreign and disables edit/delete in the UI.
    owner: section.authorName,
  }));

  // Fold the client's activity-status slice onto the SEEDED server-side set.
  // The seeded rows are the identity source — an entry the payload omits keeps
  // its current status, and an id outside the seeded set never enters the
  // merged model (the write guard has already rejected it).
  const activityStatusById = new Map(
    (input.activityStatuses ?? []).map((status) => [status.activityId, status]),
  );

  return reportSectionReadModelSchema.parse({
    ...section,
    status: nextStatus,
    submittedAt: nextStatus === "submitted" ? new Date() : section.submittedAt,
    late: late ?? section.late ?? false,
    projects: section.projects
      .map((project) => ({
        ...project,
        ownedStages: (project.ownedStages ?? []).map((stage) => {
          const key = `${project.projectId}::${stage.stageId}`;
          if (!stageStatusByKey.has(key)) return stage;
          return { ...stage, status: stageStatusByKey.get(key) ?? null };
        }),
      }))
      .map((project) => {
        const trafficLight =
          aggregateTrafficLight(project.ownedStages) ??
          input.projectStatuses.find(
            (status) => status.projectId === project.projectId,
          )?.status ??
          null;

        return { ...project, trafficLight };
      }),
    items: input.items,
    risks: input.risks,
    decisions: leadOwnedDecisions,
    activities: section.activities.map((activity) => {
      const written = activityStatusById.get(activity.activityId);
      if (!written) return activity;
      return {
        ...activity,
        status: written.status ?? null,
        note: written.note ?? null,
      };
    }),
  });
}
