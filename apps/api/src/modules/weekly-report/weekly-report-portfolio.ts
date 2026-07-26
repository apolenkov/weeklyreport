import type {
  PortfolioProductOverview,
  TrafficLightStatus,
} from "@customreport/shared";

import {
  groupScopeFilter,
  type GroupScopeOptions,
} from "../../lib/group-scope.js";
import { computeWorstStatus } from "../published-report-snapshot.js";
import type { WeeklyReportScopeSession } from "./weekly-report.service.js";

export function buildPortfolioOverview(
  projects: {
    id: string;
    name: string;
    stageAssignments: { id: string }[];
  }[],
  // Floored read-model sections (mapped via mapPrismaToReportSection): each
  // project's `trafficLight` already folds the author's own covering risks,
  // so the card status agrees with leadSections/escalations in the same payload.
  sections: {
    authorName: string;
    projects: { projectId: string; trafficLight: string | null }[];
  }[],
): PortfolioProductOverview[] {
  return projects.map((project) => {
    // null trafficLight = lead hasn't filled (nor own-risk-floored) the
    // traffic light for this project yet; skip it so the worst-of
    // computation isn't muddied by missing data.
    const matchingByProject = sections.flatMap((section) =>
      section.projects
        .filter(
          (sectionProject) =>
            sectionProject.projectId === project.id &&
            sectionProject.trafficLight !== null,
        )
        .map((sectionProject) => ({
          trafficLight: sectionProject.trafficLight as TrafficLightStatus,
          authorName: section.authorName,
        })),
    );
    const statuses = matchingByProject.map((match) => match.trafficLight);
    const leadNameSet = new Set(
      matchingByProject.map((match) => match.authorName),
    );

    const worstStatus = computeWorstStatus(statuses);

    return {
      productId: project.id,
      productName: project.name,
      worstStatus,
      stageCount: project.stageAssignments.length,
      leadNames: [...leadNameSet].sort((a, b) => a.localeCompare(b, "ru")),
    };
  });
}

// undefined when no filter applies (admin or no-session).
export function scopeWhere(
  session: WeeklyReportScopeSession | undefined,
  target: "user" | "reportSection" | "project",
  options: GroupScopeOptions = {},
): Record<string, unknown> | undefined {
  if (!session) return undefined;
  const scope = groupScopeFilter(session, target, options);
  if (Object.keys(scope).length === 0) return undefined;
  return scope;
}

// Lead: own authorId only. Other roles: group-scope (unlike scopeWhere).
export function historySectionScope(
  session: WeeklyReportScopeSession,
): Record<string, unknown> {
  return session.role === "lead"
    ? { authorId: session.userId }
    : groupScopeFilter(session, "reportSection");
}
