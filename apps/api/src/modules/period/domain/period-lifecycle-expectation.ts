import type { CurrentPeriodLifecycle } from "@weeklyreport/shared";

export type PeriodLifecycleExpectation = CurrentPeriodLifecycle & {
  readonly periodStart: Date;
  readonly periodEnd: Date;
};
