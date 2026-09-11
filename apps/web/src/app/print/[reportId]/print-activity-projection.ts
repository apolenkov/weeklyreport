import type {
  ReportSectionReadModel,
  WeeklyReportReadModel,
} from "@customreport/shared";

import type {
  WeeklyProductStatus,
  WeeklyReportDecision,
  WeeklyReportItem,
  WeeklyReportRisk,
} from "../../../features/report-sections";
import { workflowToItemStatus } from "../../../features/report-sections/model/item-status";
import {
  initialsFromName,
  trafficToProductStatus,
} from "../../../features/report-sections/model/weekly-report-groupers";
import { worstTrafficStatus } from "../../../shared/lib/status/status-presentation";

type Section = WeeklyReportReadModel["leadSections"][number];
type ActivityStatus = ReportSectionReadModel["activities"][number]["status"];

export interface PrintActivityContributor {
  readonly id: string;
  readonly name: string;
  readonly initials: string;
}

interface PrintActivityAuthorIdentity {
  readonly authorId: string;
  readonly authorName: string;
}

export type PrintActivityItem = WeeklyReportItem & PrintActivityAuthorIdentity;
export type PrintActivityRisk = WeeklyReportRisk & PrintActivityAuthorIdentity;
export type PrintActivityDecision = WeeklyReportDecision &
  PrintActivityAuthorIdentity;

export interface PrintActivityReport {
  readonly id: string;
  readonly name: string;
  readonly status: WeeklyProductStatus;
  readonly contributors: readonly PrintActivityContributor[];
  readonly currentWeek: readonly PrintActivityItem[];
  readonly nextWeek: readonly PrintActivityItem[];
  readonly risks: readonly PrintActivityRisk[];
  readonly decisions: readonly PrintActivityDecision[];
}

interface ActivityAccumulator {
  readonly id: string;
  readonly name: string;
  readonly status: ActivityStatus;
  readonly contributors: readonly PrintActivityContributor[];
  readonly contributorIds: ReadonlySet<string>;
  readonly currentWeek: readonly PrintActivityItem[];
  readonly nextWeek: readonly PrintActivityItem[];
  readonly risks: readonly PrintActivityRisk[];
  readonly decisions: readonly PrintActivityDecision[];
}

function requireId(record: { readonly id?: string | undefined }): string {
  if (record.id) return record.id;
  throw new Error("Activity print record is missing id");
}

function authorIdentity(section: Section) {
  return {
    authorId: section.authorId,
    authorName: section.authorName,
  } as const;
}

function addContributor(
  accumulator: ActivityAccumulator,
  section: Section,
): ActivityAccumulator {
  if (accumulator.contributorIds.has(section.authorId)) return accumulator;
  return {
    ...accumulator,
    contributors: [
      ...accumulator.contributors,
      {
        id: section.authorId,
        name: section.authorName,
        initials: initialsFromName(section.authorName),
      },
    ],
    contributorIds: new Set([...accumulator.contributorIds, section.authorId]),
  };
}

function createAccumulator(
  id: string,
  name = "Unknown activity",
): ActivityAccumulator {
  return {
    id,
    name,
    status: null,
    contributors: [],
    contributorIds: new Set(),
    currentWeek: [],
    nextWeek: [],
    risks: [],
    decisions: [],
  };
}

function mapItem(
  section: Section,
  activityName: string,
  item: Section["items"][number],
): PrintActivityItem {
  const initials = initialsFromName(section.authorName);
  return {
    id: requireId(item),
    stageLead: `${activityName} · ${initials}`,
    stage: activityName,
    owner: initials,
    text: item.text,
    status: workflowToItemStatus(item.workflowStatus),
    priorityRank: item.priorityRank ?? null,
    comments: item.comments ?? [],
    canReview: section.canReview ?? false,
    ...authorIdentity(section),
    ...(item.nextStepText ? { nextStepText: item.nextStepText } : {}),
    ...(item.resolution ? { resolution: item.resolution } : {}),
    ...(item.outcomeHistory?.length
      ? { outcomeHistory: item.outcomeHistory }
      : {}),
  };
}

function mapRisk(
  section: Section,
  activityName: string,
  risk: Section["risks"][number],
): PrintActivityRisk {
  const owner = initialsFromName(section.authorName);
  return {
    id: requireId(risk),
    badge: `${activityName} · ${owner}`,
    stage: activityName,
    owner,
    severity: risk.severity,
    text: `${risk.risk} — Impact: ${risk.impact} — Mitigation: ${risk.mitigation}`,
    problem: risk.risk,
    impact: risk.impact,
    mitigation: risk.mitigation,
    comments: risk.comments ?? [],
    canReview: section.canReview ?? false,
    ...authorIdentity(section),
  };
}

function mapDecision(
  section: Section,
  activityName: string,
  decision: Section["decisions"][number],
  index: number,
): PrintActivityDecision {
  const owner = initialsFromName(section.authorName);
  return {
    id: decision.id ?? `decision-${section.reportSectionId}-${String(index)}`,
    badge: `${activityName} · ${owner}`,
    owner,
    text: decision.text,
    comments: decision.comments ?? [],
    canReview: section.canReview ?? false,
    ...authorIdentity(section),
  };
}

function accumulateSection(
  activities: ReadonlyMap<string, ActivityAccumulator>,
  section: Section,
  activityNames: ReadonlyMap<string, string>,
): ReadonlyMap<string, ActivityAccumulator> {
  const result = new Map(activities);
  const update = (
    activityId: string,
    apply: (current: ActivityAccumulator) => ActivityAccumulator,
  ) => {
    const current =
      result.get(activityId) ??
      createAccumulator(activityId, activityNames.get(activityId));
    result.set(activityId, addContributor(apply(current), section));
  };

  section.activities.forEach((activity) => {
    update(activity.activityId, (current) => ({
      ...current,
      name: activity.activityName,
      status: worstTrafficStatus([
        current.status,
        activity.derivedStatus ?? activity.status,
      ]),
    }));
  });
  section.items.forEach((item) => {
    if (item.activityId == null) return;
    update(item.activityId, (current) => {
      const field = item.type === "current" ? "currentWeek" : "nextWeek";
      return {
        ...current,
        [field]: [...current[field], mapItem(section, current.name, item)],
      };
    });
  });
  section.risks.forEach((risk) => {
    if (risk.activityId == null) return;
    update(risk.activityId, (current) => ({
      ...current,
      risks: [...current.risks, mapRisk(section, current.name, risk)],
    }));
  });
  section.decisions.forEach((decision, index) => {
    if (decision.activityId == null) return;
    update(decision.activityId, (current) => ({
      ...current,
      decisions: [
        ...current.decisions,
        mapDecision(section, current.name, decision, index),
      ],
    }));
  });
  return result;
}

export function buildPrintActivityReports(
  sections: WeeklyReportReadModel["leadSections"],
): readonly PrintActivityReport[] {
  const activityNames = new Map(
    sections.flatMap((section) =>
      section.activities.map(
        (activity) => [activity.activityId, activity.activityName] as const,
      ),
    ),
  );
  const accumulated = sections.reduce<ReadonlyMap<string, ActivityAccumulator>>(
    (activities, section) =>
      accumulateSection(activities, section, activityNames),
    new Map(),
  );
  return [...accumulated.values()].map((activity) => ({
    id: activity.id,
    name: activity.name,
    status: trafficToProductStatus(activity.status),
    contributors: activity.contributors,
    currentWeek: activity.currentWeek,
    nextWeek: activity.nextWeek,
    risks: activity.risks,
    decisions: activity.decisions,
  }));
}
