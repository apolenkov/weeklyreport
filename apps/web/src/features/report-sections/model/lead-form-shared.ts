import type { ReportSectionReadModel } from "@customreport/shared";

/**
 * Index a section's projects by id -> { name, trafficLight }. Shared by every
 * record-family mapper so they resolve a row's product name and status the same
 * way.
 */
export function buildProjectIndex(section: ReportSectionReadModel): Map<
  string,
  {
    name: string;
    trafficLight: ReportSectionReadModel["projects"][number]["trafficLight"];
  }
> {
  const map = new Map<
    string,
    {
      name: string;
      trafficLight: ReportSectionReadModel["projects"][number]["trafficLight"];
    }
  >();
  // fix-lead-surface-name-resolution: name-only entries for projects that
  // section rows reference but the author owns no stage on. Seeded first so
  // the stage-owned loop below wins on conflict; they
  // feed product-name lookup only — `mapLeadProducts` does not read this
  // index, so no stray product card or stage grid appears.
  for (const referenced of section.referencedProjects ?? []) {
    map.set(referenced.projectId, {
      name: referenced.projectName,
      trafficLight: null,
    });
  }
  for (const project of section.projects) {
    map.set(project.projectId, {
      name: project.projectName,
      trafficLight: project.trafficLight,
    });
  }
  return map;
}

/** Index a section's activities by id -> name. Shared by the record-family mappers. */
export function buildActivityIndex(
  section: ReportSectionReadModel,
): Map<string, string> {
  return new Map(section.activities.map((a) => [a.activityId, a.activityName]));
}
