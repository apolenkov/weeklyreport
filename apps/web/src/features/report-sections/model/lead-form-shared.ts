import type { ReportSectionReadModel } from "@customreport/shared";

// Shared project index so every record-family mapper resolves name/status alike.
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
  // Name-only entries for projects that section rows reference but the
  // author owns no stage on. Seeded first so the stage-owned loop below
  // wins on conflict; they feed product-name lookup only — `mapLeadProducts`
  // does not read this index, so no stray product card or stage grid appears.
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

export function buildActivityIndex(
  section: ReportSectionReadModel,
): Map<string, string> {
  return new Map(section.activities.map((a) => [a.activityId, a.activityName]));
}
