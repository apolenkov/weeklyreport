import type { CurrentPeriodLifecycle } from "@customreport/shared";

export type PeriodLifecycleExpectation = CurrentPeriodLifecycle & {
  readonly periodStart: Date;
  readonly periodEnd: Date;
};
