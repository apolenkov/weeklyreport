import {
  aggregateTrafficLight,
  type DraftSaveInput,
  type ReportSectionReadModel,
  reportSectionReadModelSchema,
  type SubmitSectionInput,
  type TrafficLightStatus,
} from "@customreport/shared";

type SectionWritePayload = DraftSaveInput | SubmitSectionInput;
type SectionProject = ReportSectionReadModel["projects"][number];

// A stage is identified by (project, stage): the same stage id can be owned on
// more than one project, so neither half alone is a key.
function stageKey(projectId: string, stageId: string): string {
  return `${projectId}::${stageId}`;
}

// The write schema tolerates a missing stageNames key on activity-parented
// records while read models always expose the array ("activity rows use []").
// Normalize here so a schema-valid write never crashes the read-model parse.
function withStageNames<
  T extends { stageNames?: readonly string[] | undefined },
>(record: T): T & { stageNames: readonly string[] } {
  return { ...record, stageNames: record.stageNames ?? [] };
}

// Fold the client's stage-status slice onto the author's owned stages. A stage
// the payload omits keeps whatever status the section row already carries, and
// an entry whose status field is absent does too — only an explicit null (or a
// value) writes through, so a draft never silently clears a persisted status.
function applyStageStatuses(
  project: SectionProject,
  stageStatusByKey: ReadonlyMap<string, TrafficLightStatus | null | undefined>,
): SectionProject {
  return {
    ...project,
    ownedStages: project.ownedStages.map((stage) => {
      const key = stageKey(project.projectId, stage.stageId);
      if (!stageStatusByKey.has(key)) return stage;
      const status = stageStatusByKey.get(key);
      return status === undefined ? stage : { ...stage, status };
    }),
  };
}

// Concrete owned-stage statuses aggregate into the project light. The client's
// per-project status is the fallback when no owned stage has a status.
function withAggregatedTrafficLight(
  project: SectionProject,
  projectStatuses: SectionWritePayload["projectStatuses"],
): SectionProject {
  const ownedStageStatuses = project.ownedStages.map(
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

export function mergeSection(
  section: ReportSectionReadModel,
  input: SectionWritePayload,
  nextStatus: "draft" | "submitted",
  // Pending submit uses the request timestamp; persistence replaces it with
  // the authoritative time under the Report lock. Draft keeps its timestamp.
  now: Date,
): ReportSectionReadModel {
  const stageStatusByKey = new Map(
    input.stageStatuses.map((status) => [
      stageKey(status.projectId, status.stageId),
      status.status,
    ]),
  );

  // Fold the client's activity-status slice onto the SEEDED server-side set.
  // The seeded rows are the identity source — an entry the payload omits keeps
  // its current status, and an id outside the seeded set never enters the
  // merged model (the write guard has already rejected it).
  const activityStatusById = new Map(
    input.activityStatuses.map((status) => [status.activityId, status]),
  );

  return reportSectionReadModelSchema.parse({
    ...section,
    status: nextStatus,
    submittedAt: nextStatus === "submitted" ? now : section.submittedAt,
    projects: section.projects
      .map((project) => applyStageStatuses(project, stageStatusByKey))
      .map((project) =>
        withAggregatedTrafficLight(project, input.projectStatuses),
      ),
    items: input.items.map(withStageNames),
    risks: input.risks.map(withStageNames),
    decisions: input.decisions.map((decision) => ({
      ...decision,
      stageNames: decision.stageNames ?? [],
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
        ...(written.status === undefined ? {} : { status: written.status }),
        ...(written.titleOverride === undefined
          ? {}
          : { titleOverride: written.titleOverride }),
        ...(written.note === undefined ? {} : { note: written.note }),
      };
    }),
  });
}
