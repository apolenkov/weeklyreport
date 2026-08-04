import type { ReportSectionReadModel } from "@customreport/shared";

interface ProjectIndexEntry {
  name: string;
  trafficLight: ReportSectionReadModel["projects"][number]["trafficLight"];
}

// Shared project index so every record-family mapper resolves name/status alike.
export function buildProjectIndex(
  section: ReportSectionReadModel,
): Map<string, ProjectIndexEntry> {
  // Referenced projects are name-only entries for rows the author owns no stage
  // on; the stage-owned spread comes last so it wins on key conflict. Lookup
  // only — `mapLeadProducts` ignores this index, so no stray product card appears.
  return new Map([
    ...section.referencedProjects.map(
      (referenced): [string, ProjectIndexEntry] => [
        referenced.projectId,
        { name: referenced.projectName, trafficLight: null },
      ],
    ),
    ...section.projects.map((project): [string, ProjectIndexEntry] => [
      project.projectId,
      { name: project.projectName, trafficLight: project.trafficLight },
    ]),
  ]);
}

export function buildActivityIndex(
  section: ReportSectionReadModel,
): Map<string, string> {
  return new Map(section.activities.map((a) => [a.activityId, a.activityName]));
}
