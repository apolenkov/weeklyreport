import type { AiProviderControlRead } from "@customreport/shared";
import { AiProviderLifecycle } from "@prisma/client";

import type { ResolvedProviderProfile } from "../domain/provider-profile.js";
import type { StoredAiProviderRevision } from "../infrastructure/ai-provider.repository.js";
import { AiProviderReadService } from "./ai-provider.read-service.js";
import {
  type AiProviderServiceDependencies,
  now,
} from "./ai-provider.service-support.js";

export type PreparationResult = Readonly<{
  completed: number;
  total: number;
  failed: number;
  elapsedMs: number;
}>;

export class AiProviderActivationPreparation {
  constructor(
    private readonly dependencies: AiProviderServiceDependencies,
    private readonly reader: AiProviderReadService,
  ) {}

  async start(
    revisionId: string,
    profile: ResolvedProviderProfile,
  ): Promise<StoredAiProviderRevision> {
    const startedAt = now();
    const preparing = await this.dependencies.repository.updateProgress(
      revisionId,
      {
        completed: 0,
        total: 0,
        failed: 0,
        elapsedMs: 0,
        startedAt,
        finishedAt: null,
        lifecycle: AiProviderLifecycle.preparing,
      },
    );
    this.record(profile.profile, preparing);
    return preparing;
  }

  async update(
    revisionId: string,
    profile: ResolvedProviderProfile,
    progress: PreparationResult,
    startedAt: Date,
  ): Promise<void> {
    const updated = await this.dependencies.repository.updateProgress(
      revisionId,
      {
        ...progress,
        startedAt,
        finishedAt: null,
        lifecycle: AiProviderLifecycle.preparing,
      },
    );
    this.record(profile.profile, updated);
  }

  async complete(
    revisionId: string,
    profile: ResolvedProviderProfile,
    result: PreparationResult,
    startedAt: Date | null,
  ): Promise<void> {
    const completed = await this.dependencies.repository.updateProgress(
      revisionId,
      { ...result, startedAt, finishedAt: now() },
    );
    this.record(profile.profile, completed);
  }

  async fail(
    revisionId: string,
    actorId: string,
    profile: ResolvedProviderProfile,
    result: PreparationResult,
    startedAt: Date,
  ): Promise<AiProviderControlRead> {
    const failed = await this.dependencies.repository.updateProgress(
      revisionId,
      {
        ...result,
        startedAt,
        finishedAt: now(),
        lifecycle: AiProviderLifecycle.failed,
      },
    );
    this.record(profile.profile, failed);
    this.dependencies.audit.record({
      event: "ai_provider.activation_failed",
      actorId,
      revisionId,
      profile: profile.profile,
    });
    this.dependencies.metrics.recordActivation({
      profile: profile.profile,
      result: "failed",
    });
    return this.reader.read();
  }

  private record(
    profile: ResolvedProviderProfile["profile"],
    revision: StoredAiProviderRevision,
  ): void {
    this.dependencies.metrics.recordPreparation({
      profile,
      completed: revision.preparationCompleted,
      total: revision.preparationTotal,
      failed: revision.preparationFailed,
      elapsedMs: revision.preparationElapsedMs,
    });
  }
}
