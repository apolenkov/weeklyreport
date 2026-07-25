import {
  type DraftSavePayload,
  type ReportSectionReadModel,
  reportSectionReadModelSchema,
  type SubmitSectionPayload,
  type TrafficLightStatus,
} from "@customreport/shared";

import { aggregateTrafficLight } from "./traffic-light-aggregation";

type SectionWritePayload = DraftSavePayload | SubmitSectionPayload;
type SectionProject = ReportSectionReadModel["projects"][number];

// A stage is identified by (project, stage): the same stage id can be owned on
// more than one project, so neither half alone is a key.
function stageKey(projectId: string, stageId: string): string {
  return `${projectId}::${stageId}`;
}

// Fold the client's stage-status slice onto the author's owned stages. A stage
// the payload omits keeps whatever status the section row already carries.
function applyStageStatuses(
  project: SectionProject,
  stageStatusByKey: ReadonlyMap<string, TrafficLightStatus | null>,
): SectionProject {
  return {
    ...project,
    ownedStages: (project.ownedStages ?? []).map((stage) => {
      const key = stageKey(project.projectId, stage.stageId);
      if (!stageStatusByKey.has(key)) return stage;
      return { ...stage, status: stageStatusByKey.get(key) ?? null };
    }),
  };
}

// Owned-stage statuses aggregate into the project light; the client's
// per-project status is only the fallback for a project with no owned stages.
function withAggregatedTrafficLight(
  project: SectionProject,
  projectStatuses: SectionWritePayload["projectStatuses"],
): SectionProject {
  const ownedStageStatuses = (project.ownedStages ?? []).map(
    (stage): TrafficLightStatus | null =>
      stage.status === "red" ||
      stage.status === "yellow" ||
      stage.status === "green"
        ? stage.status
        : null,
  );
  const trafficLight =
    aggregateTrafficLight(ownedStageStatuses) ??
    projectStatuses.find((status) => status.projectId === project.projectId)
      ?.status ??
    null;

  return { ...project, trafficLight };
}

/**
 * Merge Section.
 * @param section - The section argument.
 * @param input - The input argument.
 * @param nextStatus - The nextStatus argument.
 * @param late - The late argument.
 */
export function mergeSection(
  section: ReportSectionReadModel,
  input: SectionWritePayload,
  nextStatus: "draft" | "submitted",
  // Explicit late flag set by submitSection when `now > Report.deadline` at
  // submit-time. Defaults to whatever the existing section row already carries
  // so saveDraft / reopen paths don't accidentally clear a previously-stamped
  // late flag.
  late?: boolean,
): ReportSectionReadModel {
  const stageStatusByKey = new Map(
    (input.stageStatuses ?? []).map((status) => [
      stageKey(status.projectId, status.stageId),
      status.status ?? null,
    ]),
  );

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
      .map((project) => applyStageStatuses(project, stageStatusByKey))
      .map((project) =>
        withAggregatedTrafficLight(project, input.projectStatuses),
      ),
    items: input.items,
    risks: input.risks,
    decisions: input.decisions.map((decision) => ({
      ...decision,
      // The lead form owner input is read-only and represents the section owner.
      // Persisting a stale display name here makes the lead's own rows look
      // foreign and disables edit/delete in the UI.
      owner: section.authorName,
    })),
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
