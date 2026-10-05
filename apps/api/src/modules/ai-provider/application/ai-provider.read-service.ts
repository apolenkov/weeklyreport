import type {
  AiProviderAvailabilityRead,
  AiProviderControlRead,
  AiProviderPreparationProgress,
} from "@customreport/shared";

import {
  type AiProviderServiceDependencies,
  type AiProviderStateMetrics,
} from "./ai-provider.service-support.js";
import {
  availabilityOf,
  emptyControl,
  progressOf,
  requireRevision,
  toControl,
} from "./ai-provider.service-support.js";

export class AiProviderReadService {
  constructor(private readonly dependencies: AiProviderServiceDependencies) {}

  async read(): Promise<AiProviderControlRead> {
    const stored = await this.dependencies.repository.getControl();
    const result = stored
      ? toControl(stored, this.dependencies.codec)
      : emptyControl();
    const metrics: AiProviderStateMetrics = {
      profile: result.active?.generation.profile ?? "none",
      state: result.active?.lifecycle ?? "not_configured",
    };
    this.dependencies.metrics.recordState(metrics);
    return { ...result, runtimeFailure: await this.runtimeFailure(result) };
  }

  // A failure older than the current activation belongs to a replaced provider.
  private async runtimeFailure(
    control: AiProviderControlRead,
  ): Promise<AiProviderControlRead["runtimeFailure"]> {
    const failure = await this.dependencies.runtimeHealth?.lastFailure();
    const activatedAt = control.active?.activatedAt;
    if (!failure || control.availability !== "available" || !activatedAt) {
      return null;
    }
    return new Date(failure.occurredAt) > activatedAt ? failure : null;
  }

  async availability(): Promise<AiProviderAvailabilityRead> {
    if (!this.dependencies.env.REPORT_ASSISTANT_OUTBOUND_DATA_APPROVED) {
      return { availability: "not_configured" };
    }
    return availabilityOf(await this.read());
  }

  async progress(revisionId: string): Promise<AiProviderPreparationProgress> {
    return progressOf(await requireRevision(this.dependencies, revisionId));
  }
}
