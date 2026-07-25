import type { PeriodStatus } from "@customreport/shared";

// Post-publish ingestion seam; errors are swallowed so a consumer blip
// cannot fail a real-user publish. Attach a consumer without touching publish paths.
export type IngestionPublishHook = (
  sectionIds: readonly string[],
) => Promise<void>;

// S is the telemetry port's label-union width so priorStatus stays in bounds.
interface PublishSideEffectsTelemetry<S extends PeriodStatus> {
  recordPublishedReport(): void;
  recordPeriodPublished(from: S): void;
}

export interface PublishSideEffectsDeps<S extends PeriodStatus = PeriodStatus> {
  telemetry: PublishSideEffectsTelemetry<S>;
  ingestionHook: IngestionPublishHook;
  invalidateAnalyticsCache: () => Promise<void>;
  onIngestionError?: (error: unknown) => void;
  skipIngestionWhenEmpty?: boolean;
}

export interface PublishSideEffectsParams<
  S extends PeriodStatus = PeriodStatus,
> {
  priorStatus: S;
  // publishPeriod re-reads section ids after the tx; publishAuto already has them.
  getSectionIds: () => Promise<readonly string[]> | readonly string[];
}

// Only after a real transition (telemetry → cache → swallowed ingestion).
// NoInfer pins S to the telemetry port so priorStatus cannot widen inference.
export async function emitPublishSideEffects<S extends PeriodStatus>(
  deps: PublishSideEffectsDeps<S>,
  params: PublishSideEffectsParams<NoInfer<S>>,
): Promise<void> {
  deps.telemetry.recordPublishedReport();
  deps.telemetry.recordPeriodPublished(params.priorStatus);

  await deps.invalidateAnalyticsCache();

  // The section-id read shares the ingestion swallow: it runs after the
  // publish transaction has already committed, so a transient read failure
  // must degrade ingestion, never fail the successful publish.
  try {
    const sectionIds = await params.getSectionIds();
    if (deps.skipIngestionWhenEmpty && sectionIds.length === 0) {
      return;
    }
    await deps.ingestionHook(sectionIds);
  } catch (error) {
    deps.onIngestionError?.(error);
  }
}
