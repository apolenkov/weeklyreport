import type { AiProviderControlRead } from "@customreport/shared";
import { AiProviderLifecycle } from "@prisma/client";

import { embeddingScopeChanged } from "../domain/provider-profile.js";
import { AiProviderActivationPreparation } from "./ai-provider.activation-preparation.js";
import { AiProviderReadService } from "./ai-provider.read-service.js";
import {
  AiProviderConfigurationError,
  type AiProviderServiceDependencies,
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
    ]);
  }

  private async activateWithLifecycles(
    revisionId: string,
    actorId: string,
    allowedLifecycles: readonly AiProviderLifecycle[],
  ): Promise<AiProviderControlRead> {
    const revision = await requireRevision(this.dependencies, revisionId);
    if (!allowedLifecycles.includes(revision.lifecycle)) {
      throw new AiProviderConfigurationError(
        "Only a validated AI provider revision can be activated",
      );
    }
    const control = await this.dependencies.repository.getControl();
    const previous = control?.activeConfiguration ?? null;
    const profile = resolveProfileFromRevision(revision);
    const changed = previous
      ? embeddingScopeChanged(profile, resolveProfileFromRevision(previous))
      : true;
    this.dependencies.audit.record({
      event: "ai_provider.activation_requested",
      actorId,
      revisionId,
      profile: profile.profile,
    });
    this.dependencies.metrics.recordActivation({
      profile: profile.profile,
      result: "requested",
    });
    if (changed && !this.dependencies.preparation) {
      this.dependencies.metrics.recordActivation({
        profile: profile.profile,
        result: "failed",
      });
      throw new AiProviderConfigurationError(
        "Embedding preparation is not configured",
      );
    }
    if (changed && this.dependencies.preparation) {
      const preparing = await this.preparationState.start(revisionId, profile);
      try {
        const result = await this.dependencies.preparation.prepare(
          preparing,
          previous,
          (progress) =>
            this.preparationState.update(
              revisionId,
              profile,
              progress,
              preparing.preparationStartedAt ?? now(),
            ),
        );
        if (result.failed > 0 || result.completed < result.total) {
          return await this.preparationState.fail(
            revisionId,
            actorId,
            profile,
            result,
            preparing.preparationStartedAt ?? now(),
          );
        }
        await this.preparationState.complete(
          revisionId,
          profile,
          result,
          preparing.preparationStartedAt,
        );
      } catch {
        return this.preparationState.fail(
          revisionId,
          actorId,
          profile,
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
    await this.dependencies.repository.activateRevision(revisionId, now());
    this.dependencies.audit.record({
      event: "ai_provider.activation_succeeded",
      actorId,
      revisionId,
      profile: profile.profile,
    });
    this.dependencies.metrics.recordActivation({
      profile: profile.profile,
      result: "succeeded",
    });
    return this.reader.read();
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
      profile: toSharedProfile(revision.profile),
    });
    return result;
  }
}
