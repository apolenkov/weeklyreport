/**
 * Transition `from` values the auto-publish path records. Auto-publish only
 * ever fires on open periods; reopened-period publishes flow through
 * PeriodTelemetry, not this port.
 */
export type PublicationSourceState = "open";

export interface PublicationTelemetry {
  recordPublishedReport(): void;
  recordPeriodPublished(from: PublicationSourceState): void;
}

export const PUBLICATION_TELEMETRY = Symbol("PublicationTelemetry");

export const NOOP_PUBLICATION_TELEMETRY: PublicationTelemetry = {
  recordPublishedReport: () => undefined,
  recordPeriodPublished: () => undefined,
};
