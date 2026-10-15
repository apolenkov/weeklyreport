import { AiProviderLifecycle } from "@prisma/client";
import type { AiProviderControlRead } from "@weeklyreport/shared";

import type { ResolvedEmbeddingProfile } from "../domain/provider-profile.js";
import type { StoredAiProviderRevision } from "../infrastructure/ai-provider.repository.js";
import {
  failActivation,
  type RequestedActivation,
} from "./ai-provider.activation-guards.js";
import { AiProviderReadService } from "./ai-provider.read-service.js";
import {
  AiProviderConflictError,
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

const PREPARATION_OWNER_CONFLICT = "AI provider preparation lost its owner";

/**
 * Closed audit categories for a failed preparation. An exception's name,
 * message and stack are never recorded: they are caller-controlled strings.
 */
export type PreparationFailureCause =
  "preparation_exception" | "preparation_incomplete";

const preparationAlreadyCompleted = (
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

  async isFresh(revision: StoredAiProviderRevision): Promise<boolean> {
    if (!preparationAlreadyCompleted(revision)) return false;
    const preparation = this.dependencies.preparation;
    if (!preparation?.currentSourceFingerprint) return true;
    const current = await preparation.currentSourceFingerprint(revision);
    return current === revision.preparationSourceFingerprint;
  }

  rethrowConflict(
    error: unknown,
    profile: ResolvedEmbeddingProfile["profile"],
    requested: RequestedActivation,
  ): never {
    if (error instanceof AiProviderConflictError) {
      return failActivation(this.dependencies, profile, error.message, {
        requested,
        errorClass: AiProviderConflictError,
      });
    }
    throw error;
  }

  async start(
    revision: StoredAiProviderRevision,
    profile: ResolvedEmbeddingProfile,
  ): Promise<StoredAiProviderRevision> {
    // Existing timestamps also identify preparation ownership. Advance it even
    // when retries share a millisecond or a frozen clock.
    const startedAt = new Date(
      Math.max(
        now().getTime(),
        (revision.preparationStartedAt?.getTime() ?? -1) + 1,
      ),
    );
    const preparing = await this.dependencies.repository.updateProgress(
      revision.id,
      {
        completed: 0,
        total: 0,
        failed: 0,
        elapsedMs: 0,
        startedAt,
        finishedAt: null,
        lifecycle: AiProviderLifecycle.preparing,
        expectedRevision: {
          updatedAt: revision.updatedAt,
          lifecycle: revision.lifecycle,
          preparationStartedAt: revision.preparationStartedAt,
          preparationFinishedAt: revision.preparationFinishedAt,
        },
      },
    );
    if (!preparing)
      throw new AiProviderConflictError(
        "AI provider preparation lost a lifecycle race",
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
    if (!updated) throw new AiProviderConflictError(PREPARATION_OWNER_CONFLICT);
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
      {
        ...result,
        elapsedMs: Math.max(0, result.elapsedMs),
        startedAt,
        finishedAt: new Date(
          Math.max(now().getTime(), startedAt?.getTime() ?? 0),
        ),
      },
    );
    if (!completed)
      throw new AiProviderConflictError(PREPARATION_OWNER_CONFLICT);
    this.record(profile.profile, completed);
  }

  async fail(
    revisionId: string,
    actorId: string,
    profile: ResolvedEmbeddingProfile,
    preparation: Readonly<{
      result: PreparationResult;
      startedAt: Date;
      cause: PreparationFailureCause;
    }>,
  ): Promise<AiProviderControlRead> {
    const { result, startedAt, cause } = preparation;
    const failed = await this.dependencies.repository.updateProgress(
      revisionId,
      {
        ...result,
        elapsedMs: Math.max(0, result.elapsedMs),
        startedAt,
        finishedAt: new Date(Math.max(now().getTime(), startedAt.getTime())),
        lifecycle: AiProviderLifecycle.failed,
      },
    );
    if (!failed) throw new AiProviderConflictError(PREPARATION_OWNER_CONFLICT);
    this.record(profile.profile, failed);
    this.dependencies.audit.record({
      event: "ai_provider.activation_failed",
      actorId,
      revisionId,
      profile: profile.profile,
      cause,
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
