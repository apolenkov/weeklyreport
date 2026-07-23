import type { PeriodStatus } from "@customreport/shared";

/**
 * Post-publish ingestion seam: awaited after a successful publish with the
 * just-published section ids, so its latency is on the publish response path.
 * Only errors are isolated — swallowed by {@link emitPublishSideEffects} so a
 * downstream consumer blip cannot fail a real-user publish action. No
 * consumer is currently wired; the seam exists so one can attach without
 * touching either publish path.
 */
export type IngestionPublishHook = (
  sectionIds: readonly string[],
) => Promise<void>;

/**
 * The counter pair both publish paths bump on a real transition. `S` is the
 * label-union width the concrete telemetry port can honor — `PeriodTelemetry`
 * accepts any `PeriodStatus`, `PublicationTelemetry` only `"open"` — so the
 * compiler, not a call-site literal, keeps `priorStatus` inside that width.
 */
interface PublishSideEffectsTelemetry<S extends PeriodStatus> {
  recordPublishedReport(): void;
  recordPeriodPublished(from: S): void;
}

/** Collaborators required after every successful publish transition. */
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
  /** The report's periodStatus immediately before the write that just transitioned it. */
  priorStatus: S;
  /**
   * Resolves the section ids to hand to the ingestion hook. `publishPeriod`
   * re-reads them from the repository AFTER the transaction (picking up
   * sections that raced in before commit); `publishAuto` already holds them
   * on the just-saved assembled report, so its resolver is synchronous.
   */
  getSectionIds: () => Promise<readonly string[]> | readonly string[];
}

/**
 * Emitted only after a real publish transition, so a redundant or failed
 * write never inflates the on-time-ratio numerator: telemetry pair first,
 * then cache invalidation, then the awaited-but-swallowed ingestion enqueue.
 */
// `NoInfer` pins `S` to what the telemetry port declares: `priorStatus` must
// fit the port's width, and can never widen the inference instead.
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
