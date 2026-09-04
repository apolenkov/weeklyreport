import type {
  CanonicalStatus,
  LeadStatusOverviewOutput,
  ReportSectionReadModel,
} from "@customreport/shared";
import { MS_PER_WEEK } from "@customreport/shared";

import { formatPeriodRangeWithYear } from "../../../shared/lib/format/format-date";
import {
  buildStatusOverviewUnit,
  collectOrderedStatusOverviewUnitIds,
  hasStatusOverviewParent,
} from "./status-overview-projector";

export type StatusOverviewSection = Pick<
  ReportSectionReadModel,
  "projects" | "referencedProjects" | "activities" | "items" | "risks"
>;

export interface StatusOverviewPeriodLabels {
  readonly previouslyPlanned: string | null;
  readonly currentWeek: string;
  readonly nextWeek: string;
}

type StatusOverviewPreviousPlan =
  | {
      readonly availability: "available";
      readonly source: "published" | "submitted";
      readonly section: StatusOverviewSection;
    }
  | {
      readonly availability: "unavailable";
      readonly reason: string;
    };

export interface StatusOverviewProjectionSource {
  readonly currentSection: StatusOverviewSection;
  readonly previousPlan: StatusOverviewPreviousPlan;
  readonly periods: StatusOverviewPeriodLabels;
  readonly currentItemsEditable: boolean;
}

export type StatusOverviewUnitKind = "product" | "activity";

export interface StatusOverviewEditTarget {
  readonly recordId: string;
  readonly source: "current" | "next";
}

export interface StatusOverviewCreateTarget {
  readonly source: "current" | "next";
  readonly unitKind: "product" | "activity";
  readonly unitId: string;
}

export interface StatusOverviewItem {
  readonly key: string;
  readonly recordId: string | null;
  readonly source: "previous" | "current" | "next";
  readonly editTarget: StatusOverviewEditTarget | null;
  readonly stableId: string | null;
  readonly text: string;
  readonly tag: string;
  readonly workflowStatus: ReportSectionReadModel["items"][number]["workflowStatus"];
  readonly continuity: "continued" | "unplanned" | null;
}

export type StatusOverviewColumn =
  | {
      readonly availability: "available";
      readonly items: readonly StatusOverviewItem[];
    }
  | {
      readonly availability: "unavailable";
      readonly reason: string;
      readonly items: readonly [];
    };

export interface StatusOverviewStage {
  readonly name: string;
  readonly status: CanonicalStatus;
}

export interface StatusOverviewUnit {
  readonly key: string;
  readonly id: string;
  readonly kind: StatusOverviewUnitKind;
  readonly name: string;
  readonly historical: boolean;
  readonly status: CanonicalStatus;
  readonly stages: readonly StatusOverviewStage[];
  readonly linkedProducts: readonly string[];
  readonly columns: {
    readonly previouslyPlanned: StatusOverviewColumn;
    readonly currentWeek: StatusOverviewColumn;
    readonly nextWeek: StatusOverviewColumn;
  };
}

export interface StatusOverviewModel {
  readonly periods: StatusOverviewPeriodLabels;
  readonly previousPlanSource: "published" | "submitted" | null;
  readonly units: readonly StatusOverviewUnit[];
  readonly sourceCounts: {
    readonly previouslyPlanned: number;
    readonly currentWeek: number;
    readonly nextWeek: number;
  };
}

export interface StatusOverviewProjectionOptions {
  readonly currentSection?: ReportSectionReadModel | undefined;
  readonly currentItemsEditable?: boolean | undefined;
}

const PREVIOUS_PLAN_UNAVAILABLE_LABEL: Readonly<
  Record<
    Extract<
      LeadStatusOverviewOutput["predecessor"],
      { availability: "unavailable" }
    >["reason"],
    string
  >
> = {
  no_predecessor: "No previous reporting period",
  section_unavailable: "No submitted prior plan is available",
  invalid_published_snapshot: "The published prior plan is unavailable",
};

function shiftPeriod(date: Date): Date {
  return new Date(date.getTime() + MS_PER_WEEK);
}

function normalizeOverviewInput(
  output: LeadStatusOverviewOutput,
  options: StatusOverviewProjectionOptions,
): StatusOverviewProjectionSource {
  const predecessor = output.predecessor;
  return {
    currentSection: options.currentSection ?? output.current.section,
    currentItemsEditable: options.currentItemsEditable === true,
    previousPlan:
      predecessor.availability === "available"
        ? {
            availability: "available",
            source: predecessor.source,
            section: predecessor.section,
          }
        : {
            availability: "unavailable",
            reason: PREVIOUS_PLAN_UNAVAILABLE_LABEL[predecessor.reason],
          },
    periods: {
      previouslyPlanned:
        "periodStart" in predecessor
          ? formatPeriodRangeWithYear(
              predecessor.periodStart,
              predecessor.periodEnd,
            )
          : null,
      currentWeek: formatPeriodRangeWithYear(
        output.current.periodStart,
        output.current.periodEnd,
      ),
      nextWeek: formatPeriodRangeWithYear(
        shiftPeriod(output.current.periodStart),
        shiftPeriod(output.current.periodEnd),
      ),
    },
  };
}

/** Projects the validated wire response into the route-independent Overview UI model. */
export function projectStatusOverview(
  output: LeadStatusOverviewOutput,
  options: StatusOverviewProjectionOptions = {},
): StatusOverviewModel {
  const input = normalizeOverviewInput(output, options);
  const previousSection =
    input.previousPlan.availability === "available"
      ? input.previousPlan.section
      : null;
  const units = (["product", "activity"] as const).flatMap((kind) =>
    collectOrderedStatusOverviewUnitIds(
      input.currentSection,
      previousSection,
      kind,
    ).map((id) => buildStatusOverviewUnit(kind, id, input, previousSection)),
  );

  return {
    periods: input.periods,
    previousPlanSource:
      input.previousPlan.availability === "available"
        ? input.previousPlan.source
        : null,
    units,
    sourceCounts: {
      previouslyPlanned:
        previousSection?.items.filter(
          (item) => item.type === "next" && hasStatusOverviewParent(item),
        ).length ?? 0,
      currentWeek: input.currentSection.items.filter(
        (item) => item.type === "current" && hasStatusOverviewParent(item),
      ).length,
      nextWeek: input.currentSection.items.filter(
        (item) => item.type === "next" && hasStatusOverviewParent(item),
      ).length,
    },
  };
}
