import type { PeriodStatus } from "@weeklyreport/shared";

// S is the telemetry port's label-union width so priorStatus stays in bounds.
interface PublishSideEffectsTelemetry<S extends PeriodStatus> {
  readonly recordPublishedReport: () => void;
  readonly recordPeriodPublished: (from: S) => void;
}

export interface PublishSideEffectsDeps<S extends PeriodStatus = PeriodStatus> {
  telemetry: PublishSideEffectsTelemetry<S>;
  invalidateAnalyticsCache: () => Promise<void>;
  // Handles post-commit telemetry/cache failures: a committed write must not
  // fail the API response because a side-effect blipped; the failure is
  // observable (logged/metric) but never reverses the committed write.
  onSideEffectError: (error: unknown) => void;
}

export interface PublishSideEffectsParams<
  S extends PeriodStatus = PeriodStatus,
> {
  priorStatus: S;
}

// The report of a side-effect failure is itself post-commit work: a reporter
// that throws (a log transport that fails, say) must not reject the committed
// publish, nor skip the other side effect, so the reporter is guarded like the
// side effects it describes.
function reportSideEffectError(
  onSideEffectError: (error: unknown) => void,
  error: unknown,
): void {
  try {
    onSideEffectError(error);
  } catch {
    // No further report path exists; the committed outcome stays authoritative.
  }
}

// Only after a real transition (telemetry → cache).
// NoInfer pins S to the telemetry port so priorStatus cannot widen inference.
export async function emitPublishSideEffects<S extends PeriodStatus>(
  deps: PublishSideEffectsDeps<S>,
  params: PublishSideEffectsParams<NoInfer<S>>,
): Promise<void> {
  // Telemetry and cache run AFTER the publish transaction has already
  // committed, so a failure here must degrade observability, never fail the
  // successful write — the side-effect failure is routed to onSideEffectError.
  // Each is guarded independently so one blip cannot skip the other.
  try {
    deps.telemetry.recordPublishedReport();
    deps.telemetry.recordPeriodPublished(params.priorStatus);
  } catch (error) {
    reportSideEffectError(deps.onSideEffectError, error);
  }
  try {
    await deps.invalidateAnalyticsCache();
  } catch (error) {
    reportSideEffectError(deps.onSideEffectError, error);
  }
}
