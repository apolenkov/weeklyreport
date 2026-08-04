import type { UserSession } from "@customreport/shared";

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
  ) => Promise<readonly number[]>;
}

export interface TelemetryCachePort {
  readonly getOrCompute: <T>(
    key: string,
    fn: () => Promise<T>,
    validate?: (value: unknown) => boolean,
  ) => Promise<T>;
}
