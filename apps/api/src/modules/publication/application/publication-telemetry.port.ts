export type PublicationSourceState = "open" | "reopened";

export interface PublicationTelemetry {
  recordPublishedReport(): void;
  recordPeriodPublished(from: PublicationSourceState): void;
}

export const PUBLICATION_TELEMETRY = Symbol("PublicationTelemetry");

export const NOOP_PUBLICATION_TELEMETRY: PublicationTelemetry = {
  recordPublishedReport: () => undefined,
  recordPeriodPublished: () => undefined,
};
