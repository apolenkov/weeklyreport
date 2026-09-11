import type { AiProviderControlRead } from "@customreport/shared";
import { AiProviderLifecycle } from "@prisma/client";

import { embeddingScopeChanged } from "../domain/provider-profile.js";
import {
  assertRevisionReady,
  failActivation,
  requireOutboundApproval,
  requirePreparationEvidence,
  requirePreparedRevision,
  verifyCurrentSourceFingerprint,
} from "./ai-provider.activation-guards.js";
import {
  AiProviderActivationPreparation,
  preparationAlreadyCompleted,
} from "./ai-provider.activation-preparation.js";
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
    return this.activateWithLifecycles(
      revisionId,
      actorId,
      [
        AiProviderLifecycle.validated,
        AiProviderLifecycle.preparing,
        AiProviderLifecycle.failed,
      ],
      "activate",
    );
  }

  private async activateWithLifecycles(
    revisionId: string,
    actorId: string,
    allowedLifecycles: readonly AiProviderLifecycle[],
    operation: "activate" | "restore",
  ): Promise<AiProviderControlRead> {
    const revision = await requireRevision(this.dependencies, revisionId);
    assertRevisionReady(revision, allowedLifecycles);
    requireOutboundApproval(this.dependencies, actorId, revision);
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
      changed && !(await this.preparationIsFresh(revision)),
      revisionId,
      actorId,
      embeddingScope,
      previous,
    );
    if (preparationFailure) return preparationFailure;
    const readyRevision = changed
      ? await requirePreparedRevision(
          this.dependencies,
          revisionId,
          generationProfile,
        )
      : requirePreparationEvidence(
          this.dependencies,
          generationProfile,
          previous ??
            failActivation(
              this.dependencies,
              generationProfile,
              "Current embedding-scope readiness evidence is unavailable",
            ),
        );
    if (changed) {
      await verifyCurrentSourceFingerprint(
        this.dependencies,
        generationProfile,
        readyRevision,
      );
    }
    const activated = await this.dependencies.repository.activateRevision(
      revisionId,
      now(),
      changed
        ? {
            mode: "prepared",
            sourceFingerprint: readyRevision.preparationSourceFingerprint,
            sourceGeneration: readyRevision.preparationSourceGeneration,
          }
        : {
            mode: "reuse_active_scope",
            activeRevisionId: readyRevision.id,
            sourceFingerprint: readyRevision.preparationSourceFingerprint,
            sourceGeneration: readyRevision.preparationSourceGeneration,
          },
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
    if (operation === "restore") {
      this.dependencies.audit.record({
        event: "ai_provider.restored",
        actorId,
        revisionId,
        profile: generationProfile,
      });
    }
    return this.reader.read();
  }

  // Completed preparation is reusable only while its source fingerprint still
  // matches the current sources; a stale fingerprint must re-prepare so retries
  // are not permanently stuck on "activation must be retried".
  private async preparationIsFresh(
    revision: Awaited<ReturnType<typeof requireRevision>>,
  ): Promise<boolean> {
    if (!preparationAlreadyCompleted(revision)) return false;
    const preparation = this.dependencies.preparation;
    if (!preparation?.currentSourceFingerprint) return true;
    const current = await preparation.currentSourceFingerprint(revision);
    return current === revision.preparationSourceFingerprint;
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
    return this.activateWithLifecycles(
      revisionId,
      actorId,
      RETAINED_LIFECYCLES,
      "restore",
    );
  }
}
