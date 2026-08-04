// Transition `from` values the auto-publish path records: auto-publish only
// fires on open periods; reopened-period publishes flow through PeriodTelemetry.
export type PublicationSourceState = "open";

export interface PublicationTelemetry {
  readonly recordPublishedReport: () => void;
  readonly recordPeriodPublished: (from: PublicationSourceState) => void;
}

export const PUBLICATION_TELEMETRY = Symbol("PublicationTelemetry");

export const NOOP_PUBLICATION_TELEMETRY: PublicationTelemetry = {
  recordPublishedReport: () => undefined,
  recordPeriodPublished: () => undefined,
};
