import type { PeriodStatus } from "@customreport/shared";

export interface PeriodTelemetry {
  readonly recordPublishedReport: () => void;
  readonly recordPeriodPublished: (from: PeriodStatus) => void;
}

export const PERIOD_TELEMETRY = Symbol("PeriodTelemetry");

export const NOOP_PERIOD_TELEMETRY: PeriodTelemetry = {
  recordPublishedReport: () => undefined,
  recordPeriodPublished: () => undefined,
};
