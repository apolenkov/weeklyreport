import type { ReportSectionReadModel } from "@weeklyreport/shared";

import { buildAccessibleEntityCatalog } from "../domain/entity-resolver.catalog.js";
import type {
  AccessibleEntity,
  AccessibleEntityCatalog,
} from "../domain/entity-resolver.types.js";
import type { AuthorizedReportRetrieval } from "./authorized-report-retrieval.js";

const productEntities = (
  section: ReportSectionReadModel,
): readonly AccessibleEntity[] => [
  ...section.projects.map((project) => ({
    kind: "product" as const,
    id: project.projectId,
    label: project.projectName,
    aliases: [project.projectName],
  })),
  ...section.referencedProjects.map((project) => ({
    kind: "product" as const,
    id: project.projectId,
    label: project.projectName,
    aliases: [project.projectName],
  })),
];

const activityEntities = (
  section: ReportSectionReadModel,
): readonly AccessibleEntity[] =>
  section.activities.map((activity) => {
    const effectiveTitle =
      activity.titleOverride?.trim() || activity.activityName;
    return {
      kind: "activity" as const,
      id: activity.activityId,
      label: effectiveTitle,
      aliases: [activity.activityName, effectiveTitle],
    };
  });

const sectionEntities = (
  retrieval: AuthorizedReportRetrieval,
): readonly AccessibleEntity[] =>
  retrieval.sectionScopes.flatMap(({ section }) => [
    {
      kind: "author" as const,
      id: section.authorId,
      label: section.authorName,
      aliases: [section.authorName],
    },
    ...productEntities(section),
    ...activityEntities(section),
  ]);

const periodEntities = (
  retrieval: AuthorizedReportRetrieval,
): readonly AccessibleEntity[] =>
  retrieval.occurrences.map((occurrence) => ({
    kind: "period" as const,
    id: occurrence.periodId,
    label: occurrence.periodLabel,
    aliases: [occurrence.periodLabel],
  }));

export const buildReportAssistantEntityCatalog = (
  retrieval: AuthorizedReportRetrieval,
): AccessibleEntityCatalog =>
  buildAccessibleEntityCatalog([
    ...sectionEntities(retrieval),
    ...periodEntities(retrieval),
  ]);
