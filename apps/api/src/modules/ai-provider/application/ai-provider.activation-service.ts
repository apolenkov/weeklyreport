import type { AiProviderControlRead } from "@customreport/shared";
import { AiProviderLifecycle } from "@prisma/client";

import { embeddingScopeChanged } from "../domain/provider-profile.js";
import {
  AiProviderActivationPreparation,
  preparationAlreadyCompleted,
} from "./ai-provider.activation-preparation.js";
import { AiProviderReadService } from "./ai-provider.read-service.js";
import {
  AiProviderConfigurationError,
  type AiProviderServiceDependencies,
  completeCapabilityResult,
  now,
  requireRevision,
  resolveProfileFromRevision,
  toSharedProfile,
} from "./ai-provider.service-support.js";

const RETAINED_LIFECYCLES: readonly AiProviderLifecycle[] = [
  AiProviderLifecycle.validated,
  AiProviderLifecycle.active,
  AiProviderLifecycle.superseded,
];

const assertRevisionReady = (
  revision: Awaited<ReturnType<typeof requireRevision>>,
  allowedLifecycles: readonly AiProviderLifecycle[],
): void => {
  if (!allowedLifecycles.includes(revision.lifecycle)) {
    throw new AiProviderConfigurationError(
      "Only a validated AI provider revision can be activated",
    );
  }
  if (!completeCapabilityResult(revision.testResult)) {
    throw new AiProviderConfigurationError(
      "Current passing generation and embedding evidence is required",
    );
  }
  if (
    revision.latestExecution?.state !== "completed" ||
    revision.latestExecution.outcome !== "passed"
  ) {
    throw new AiProviderConfigurationError(
      "A current composite capability execution is required",
    );
  }
};

const failActivation = (
  dependencies: AiProviderServiceDependencies,
  profile: ReturnType<typeof toSharedProfile>,
  message: string,
): never => {
  dependencies.metrics.recordActivation({ profile, result: "failed" });
  throw new AiProviderConfigurationError(message);
};

export class AiProviderActivationService {
  private readonly preparationState: AiProviderActivationPreparation;

  constructor(
    private readonly dependencies: AiProviderServiceDependencies,
    private readonly reader: AiProviderReadService,
  ) {
    this.preparationState = new AiProviderActivationPreparation(
      dependencies,
      reader,
    );
  }

  async activate(
    revisionId: string,
    actorId: string,
  ): Promise<AiProviderControlRead> {
    return this.activateWithLifecycles(revisionId, actorId, [
      AiProviderLifecycle.validated,
      AiProviderLifecycle.preparing,
    ]);
  }

  private async activateWithLifecycles(
    revisionId: string,
    actorId: string,
    allowedLifecycles: readonly AiProviderLifecycle[],
  ): Promise<AiProviderControlRead> {
    const revision = await requireRevision(this.dependencies, revisionId);
    assertRevisionReady(revision, allowedLifecycles);
    const control = await this.dependencies.repository.getControl();
    const previous = control?.activeConfiguration ?? null;
    const embeddingScope = resolveProfileFromRevision(revision);
    const generationProfile = toSharedProfile(revision.generationProfile);
    const changed = previous
      ? embeddingScopeChanged(
          embeddingScope,
          resolveProfileFromRevision(previous),
        )
      : true;
    this.dependencies.audit.record({
      event: "ai_provider.activation_requested",
      actorId,
      revisionId,
      profile: generationProfile,
    });
    this.dependencies.metrics.recordActivation({
      profile: generationProfile,
      result: "requested",
    });
    if (changed && !this.dependencies.preparation)
      return failActivation(
        this.dependencies,
        generationProfile,
        "Embedding preparation is not configured",
      );
    const preparationFailure = await this.prepareIfChanged(
      changed && !preparationAlreadyCompleted(revision),
      revisionId,
      actorId,
      embeddingScope,
      previous,
    );
    if (preparationFailure) return preparationFailure;
    const activated = await this.dependencies.repository.activateRevision(
      revisionId,
      now(),
    );
    if (!activated) {
      return failActivation(
        this.dependencies,
        generationProfile,
        "AI provider activation lost a lifecycle race",
      );
    }
    this.dependencies.audit.record({
      event: "ai_provider.activation_succeeded",
      actorId,
      revisionId,
      profile: generationProfile,
    });
    this.dependencies.metrics.recordActivation({
      profile: generationProfile,
      result: "succeeded",
    });
    return this.reader.read();
  }

  private async prepareIfChanged(
    changed: boolean,
    revisionId: string,
    actorId: string,
    embeddingScope: ReturnType<typeof resolveProfileFromRevision>,
    previous: Awaited<ReturnType<typeof requireRevision>> | null,
  ): Promise<AiProviderControlRead | null> {
    if (!changed || !this.dependencies.preparation) return null;
    const preparing = await this.preparationState.start(
      revisionId,
      embeddingScope,
    );
    try {
      const result = await this.dependencies.preparation.prepare(
        preparing,
        previous,
        (progress) =>
          this.preparationState.update(
            revisionId,
            embeddingScope,
            progress,
            preparing.preparationStartedAt ?? now(),
          ),
      );
      if (result.failed > 0 || result.completed < result.total) {
        return await this.preparationState.fail(
          revisionId,
          actorId,
          embeddingScope,
          result,
          preparing.preparationStartedAt ?? now(),
        );
      }
      await this.preparationState.complete(
        revisionId,
        embeddingScope,
        result,
        preparing.preparationStartedAt,
      );
      return null;
    } catch {
      return this.preparationState.fail(
        revisionId,
        actorId,
        embeddingScope,
        {
          completed: preparing.preparationCompleted,
          total: Math.max(1, preparing.preparationTotal),
          failed: Math.max(1, preparing.preparationFailed),
          elapsedMs: Math.max(
            0,
            Date.now() - (preparing.preparationStartedAt ?? now()).getTime(),
          ),
        },
        preparing.preparationStartedAt ?? now(),
      );
    }
  }

  async disable(actorId: string): Promise<AiProviderControlRead> {
    await this.dependencies.repository.disable();
    this.dependencies.audit.record({
      event: "ai_provider.disabled",
      actorId,
      revisionId: null,
    });
    return this.reader.read();
  }

  async restore(
    revisionId: string,
    actorId: string,
  ): Promise<AiProviderControlRead> {
    const revision = await requireRevision(this.dependencies, revisionId);
    if (!RETAINED_LIFECYCLES.includes(revision.lifecycle)) {
      throw new AiProviderConfigurationError(
        "Only a tested retained revision can be restored",
      );
    }
    const result = await this.activateWithLifecycles(
      revisionId,
      actorId,
      RETAINED_LIFECYCLES,
    );
    this.dependencies.audit.record({
      event: "ai_provider.restored",
      actorId,
      revisionId,
      profile: toSharedProfile(revision.generationProfile),
    });
    return result;
  }
}
