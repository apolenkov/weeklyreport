import type { PeriodStatus } from "@customreport/shared";

/**
 * Fire-and-forget post-publish ingestion seam, called after a successful
 * publish with the just-published section ids. Errors are swallowed by
 * {@link emitPublishSideEffects} so a downstream consumer blip cannot fail a
 * real-user publish action.
 *
 * The original AI/RAG consumer was removed; the seam is kept so a rebuilt
 * pipeline — or any other async consumer — can re-wire without touching
 * either publish path.
 */
export type IngestionPublishHook = (
  sectionIds: readonly string[],
) => Promise<void>;

/**
 * The counter pair both publish paths bump on a real transition. Structurally
 * matches both `PeriodTelemetry` and `PublicationTelemetry` (their
 * `recordPeriodPublished` label unions differ in width, but method-shorthand
 * members are checked bivariantly, so either port satisfies this shape).
 */
interface PublishSideEffectsTelemetry {
  recordPublishedReport(): void;
  recordPeriodPublished(from: PeriodStatus): void;
}

/** Collaborators required after every successful publish transition. */
export interface PublishSideEffectsDeps {
  telemetry: PublishSideEffectsTelemetry;
  ingestionHook: IngestionPublishHook;
  invalidateAnalyticsCache: () => Promise<void>;
  onIngestionError?: (error: unknown) => void;
  skipIngestionWhenEmpty?: boolean;
}

export interface PublishSideEffectsParams {
  /** The report's periodStatus immediately before the write that just transitioned it. */
  priorStatus: PeriodStatus;
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
export async function emitPublishSideEffects(
  deps: PublishSideEffectsDeps,
  params: PublishSideEffectsParams,
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
