import type { UserSession } from "@weeklyreport/shared";

export interface TelemetryOnTimeWindow {
  readonly latestPeriodRatio: number | null;
  readonly ratios: readonly number[];
}

export interface TelemetryRepository {
  readonly reportsThisPeriodCount: (session: UserSession) => Promise<number>;
  readonly activeLeadsLastPublishedPeriod: (
    session: UserSession,
  ) => Promise<number>;
  readonly lateSectionsLastPublishedPeriod: (
    session: UserSession,
  ) => Promise<number>;
  readonly pendingReopenCount: (session: UserSession) => Promise<number>;
  readonly pdfExportsLast7d: (session: UserSession) => Promise<number>;
  readonly onTimeRatioPerPeriod: (
    n: number,
    session: UserSession,
  ) => Promise<TelemetryOnTimeWindow>;
}

export interface TelemetryCachePort {
  readonly getOrCompute: <T>(
    key: string,
    fn: () => Promise<T>,
    validate?: (value: unknown) => value is T,
  ) => Promise<T>;
}
