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
      profile: result.active?.profile ?? "none",
      state: result.active?.lifecycle ?? "not_configured",
    };
    this.dependencies.metrics.recordState(metrics);
    return result;
  }

  async availability(): Promise<AiProviderAvailabilityRead> {
    return availabilityOf(await this.read());
  }

  async progress(revisionId: string): Promise<AiProviderPreparationProgress> {
    return progressOf(await requireRevision(this.dependencies, revisionId));
  }
}
