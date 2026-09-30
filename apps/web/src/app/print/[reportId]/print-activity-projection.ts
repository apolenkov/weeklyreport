import type {
  ReportSectionReadModel,
  WeeklyReportReadModel,
} from "@customreport/shared";
import { aggregateTrafficLight } from "@customreport/shared";

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
import { activityDisplayTitle } from "../../../shared/lib/activity/activity-display";

type Section = WeeklyReportReadModel["leadSections"][number];
type ActivityStatus = ReportSectionReadModel["activities"][number]["status"];

interface PrintActivityContributor {
  readonly id: string;
  readonly name: string;
  readonly initials: string;
}

interface PrintActivityAuthorIdentity {
  readonly authorId: string;
  readonly authorName: string;
}

type PrintActivityItem = WeeklyReportItem & PrintActivityAuthorIdentity;
type PrintActivityRisk = WeeklyReportRisk & PrintActivityAuthorIdentity;
type PrintActivityDecision = WeeklyReportDecision & PrintActivityAuthorIdentity;

/** Frozen title/description pair contributed by one report section author. */
interface PrintActivityPresentation extends PrintActivityAuthorIdentity {
  readonly reportSectionId: string;
  readonly title: string;
  readonly note: string | null;
}

export interface PrintActivityReport {
  readonly id: string;
  readonly name: string;
  readonly status: WeeklyProductStatus;
  readonly contributors: readonly PrintActivityContributor[];
  readonly presentations: readonly PrintActivityPresentation[];
  readonly currentWeek: readonly PrintActivityItem[];
  readonly nextWeek: readonly PrintActivityItem[];
  readonly risks: readonly PrintActivityRisk[];
  readonly decisions: readonly PrintActivityDecision[];
}

interface ActivityAccumulator {
  readonly id: string;
  readonly status: ActivityStatus;
  readonly contributors: readonly PrintActivityContributor[];
  readonly contributorIds: ReadonlySet<string>;
  readonly presentations: readonly PrintActivityPresentation[];
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

function createAccumulator(id: string): ActivityAccumulator {
  return {
    id,
    status: null,
    contributors: [],
    contributorIds: new Set(),
    presentations: [],
    currentWeek: [],
    nextWeek: [],
    risks: [],
    decisions: [],
  };
}

function addPresentation(
  accumulator: ActivityAccumulator,
  section: Section,
  activityId: string,
): ActivityAccumulator {
  if (
    accumulator.presentations.some(
      (presentation) =>
        presentation.reportSectionId === section.reportSectionId,
    )
  ) {
    return accumulator;
  }
  const activity = section.activities.find(
    (candidate) => candidate.activityId === activityId,
  );
  return {
    ...accumulator,
    presentations: [
      ...accumulator.presentations,
      {
        reportSectionId: section.reportSectionId,
        authorId: section.authorId,
        authorName: section.authorName,
        title: activity ? activityDisplayTitle(activity) : "Activity",
        note: activity?.note ?? null,
      },
    ],
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
): ReadonlyMap<string, ActivityAccumulator> {
  const result = new Map(activities);
  const activityById = new Map(
    section.activities.map((activity) => [activity.activityId, activity]),
  );
  const activityTitle = (activityId: string): string => {
    const activity = activityById.get(activityId);
    return activity ? activityDisplayTitle(activity) : "Activity";
  };
  const update = (
    activityId: string,
    apply: (current: ActivityAccumulator) => ActivityAccumulator,
  ) => {
    const current = result.get(activityId) ?? createAccumulator(activityId);
    result.set(
      activityId,
      addContributor(
        apply(addPresentation(current, section, activityId)),
        section,
      ),
    );
  };

  section.activities.forEach((activity) => {
    update(activity.activityId, (current) => ({
      ...current,
      status: aggregateTrafficLight([
        current.status,
        activity.derivedStatus ?? activity.status,
      ]),
    }));
  });
  section.items.forEach((item) => {
    const activityId = item.activityId;
    if (activityId == null) return;
    update(activityId, (current) => {
      const field = item.type === "current" ? "currentWeek" : "nextWeek";
      return {
        ...current,
        [field]: [
          ...current[field],
          mapItem(section, activityTitle(activityId), item),
        ],
      };
    });
  });
  section.risks.forEach((risk) => {
    const activityId = risk.activityId;
    if (activityId == null) return;
    update(activityId, (current) => ({
      ...current,
      risks: [
        ...current.risks,
        mapRisk(section, activityTitle(activityId), risk),
      ],
    }));
  });
  section.decisions.forEach((decision, index) => {
    const activityId = decision.activityId;
    if (activityId == null) return;
    update(activityId, (current) => ({
      ...current,
      decisions: [
        ...current.decisions,
        mapDecision(section, activityTitle(activityId), decision, index),
      ],
    }));
  });
  return result;
}

export function buildPrintActivityReports(
  sections: WeeklyReportReadModel["leadSections"],
): readonly PrintActivityReport[] {
  const accumulated = sections.reduce<ReadonlyMap<string, ActivityAccumulator>>(
    (activities, section) => accumulateSection(activities, section),
    new Map(),
  );
  return [...accumulated.values()].map((activity) => {
    const titles = [
      ...new Set(
        activity.presentations.map((presentation) => presentation.title),
      ),
    ];
    return {
      id: activity.id,
      name: titles.length === 1 ? (titles[0] ?? "Activity") : "Activity",
      status: trafficToProductStatus(activity.status),
      contributors: activity.contributors,
      presentations: activity.presentations,
      currentWeek: activity.currentWeek,
      nextWeek: activity.nextWeek,
      risks: activity.risks,
      decisions: activity.decisions,
    };
  });
}
