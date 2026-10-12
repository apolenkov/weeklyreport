import { AiProviderLifecycle } from "@prisma/client";
import type { AiProviderControlRead } from "@weeklyreport/shared";

import type { ResolvedEmbeddingProfile } from "../domain/provider-profile.js";
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
  sourceFingerprint?: string;
  sourceGeneration?: bigint;
}>;

export const preparationAlreadyCompleted = (
  revision: StoredAiProviderRevision,
): boolean =>
  revision.lifecycle === AiProviderLifecycle.preparing &&
  revision.preparationFinishedAt !== null &&
  revision.preparationTotal > 0 &&
  revision.preparationCompleted === revision.preparationTotal &&
  revision.preparationFailed === 0 &&
  typeof revision.preparationSourceFingerprint === "string" &&
  revision.preparationSourceFingerprint.length > 0 &&
  typeof revision.preparationSourceGeneration === "bigint";

export class AiProviderActivationPreparation {
  constructor(
    private readonly dependencies: AiProviderServiceDependencies,
    private readonly reader: AiProviderReadService,
  ) {}

  async start(
    revisionId: string,
    profile: ResolvedEmbeddingProfile,
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
    profile: ResolvedEmbeddingProfile,
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
    profile: ResolvedEmbeddingProfile,
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
    profile: ResolvedEmbeddingProfile,
    preparation: Readonly<{ result: PreparationResult; startedAt: Date }>,
  ): Promise<AiProviderControlRead> {
    const { result, startedAt } = preparation;
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
    profile: ResolvedEmbeddingProfile["profile"],
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
