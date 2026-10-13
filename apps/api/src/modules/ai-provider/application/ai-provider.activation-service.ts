import { AiProviderLifecycle } from "@prisma/client";
import type { AiProviderControlRead } from "@weeklyreport/shared";

import { embeddingScopeChanged } from "../domain/provider-profile.js";
import {
  assertRevisionReady,
  failActivation,
  type RequestedActivation,
  requireOutboundApproval,
  requirePreparationEvidence,
  requirePreparedRevision,
  verifyCurrentSourceFingerprint,
} from "./ai-provider.activation-guards.js";
import {
  AiProviderActivationPreparation,
  type PreparationResult,
} from "./ai-provider.activation-preparation.js";
import { AiProviderReadService } from "./ai-provider.read-service.js";
import {
  AiProviderConfigurationError,
  AiProviderConflictError,
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
    this.recordActivationRequested(actorId, revisionId, generationProfile);
    const requested = { actorId, revisionId };
    if (changed && !this.dependencies.preparation)
      return failActivation(
        this.dependencies,
        generationProfile,
        "Embedding preparation is not configured",
        { requested },
      );
    const preparationFailure = await this.prepareIfChanged(
      changed && !(await this.preparationState.isFresh(revision)),
      requested,
      previous,
      revision,
    ).catch((error: unknown) =>
      this.preparationState.rethrowConflict(
        error,
        generationProfile,
        requested,
      ),
    );
    if (preparationFailure) return preparationFailure;
    const readyRevision = changed
      ? await requirePreparedRevision(
          this.dependencies,
          revisionId,
          generationProfile,
          requested,
        )
      : requirePreparationEvidence(
          this.dependencies,
          generationProfile,
          previous ??
            failActivation(
              this.dependencies,
              generationProfile,
              "Current embedding-scope readiness evidence is unavailable",
              { requested },
            ),
          requested,
        );
    if (changed) {
      await verifyCurrentSourceFingerprint(
        this.dependencies,
        generationProfile,
        readyRevision,
        requested,
      );
    }
    return this.commitActivation({
      revisionId,
      actorId,
      operation,
      generationProfile,
      changed,
      readyRevision,
      requested,
    });
  }

  private recordActivationRequested(
    actorId: string,
    revisionId: string,
    profile: ReturnType<typeof toSharedProfile>,
  ): void {
    this.dependencies.audit.record({
      event: "ai_provider.activation_requested",
      actorId,
      revisionId,
      profile,
    });
    this.dependencies.metrics.recordActivation({
      profile,
      result: "requested",
    });
  }

  private async commitActivation({
    revisionId,
    actorId,
    operation,
    generationProfile,
    changed,
    readyRevision,
    requested,
  }: {
    revisionId: string;
    actorId: string;
    operation: "activate" | "restore";
    generationProfile: ReturnType<typeof toSharedProfile>;
    changed: boolean;
    readyRevision: Awaited<ReturnType<typeof requirePreparedRevision>>;
    requested: RequestedActivation;
  }): Promise<AiProviderControlRead> {
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
    if (!activated)
      return failActivation(
        this.dependencies,
        generationProfile,
        "AI provider activation lost a lifecycle race",
        { requested, errorClass: AiProviderConflictError },
      );
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

  private async prepareIfChanged(
    changed: boolean,
    requested: RequestedActivation,
    previous: Awaited<ReturnType<typeof requireRevision>> | null,
    revision: Awaited<ReturnType<typeof requireRevision>>,
  ): Promise<AiProviderControlRead | null> {
    if (!changed || !this.dependencies.preparation) return null;
    const embeddingScope = resolveProfileFromRevision(revision);
    const { revisionId, actorId } = requested;
    const preparing = await this.preparationState.start(
      revision,
      embeddingScope,
    );
    const state: { progress: PreparationResult | null } = { progress: null };
    try {
      const result = await this.dependencies.preparation.prepare(
        preparing,
        previous,
        (progress) => {
          state.progress = progress;
          return this.preparationState.update(
            revisionId,
            embeddingScope,
            progress,
            preparing.preparationStartedAt ?? now(),
          );
        },
      );
      if (result.failed > 0 || result.completed < result.total) {
        return await this.preparationState.fail(
          revisionId,
          actorId,
          embeddingScope,
          { result, startedAt: preparing.preparationStartedAt ?? now() },
        );
      }
      await this.preparationState.complete(
        revisionId,
        embeddingScope,
        result,
        preparing.preparationStartedAt,
      );
      return null;
    } catch (error) {
      if (error instanceof AiProviderConflictError) throw error;
      const observed = state.progress;
      return this.preparationState.fail(revisionId, actorId, embeddingScope, {
        result: {
          completed: observed?.completed ?? preparing.preparationCompleted,
          total: Math.max(1, observed?.total ?? preparing.preparationTotal),
          failed: observed?.failed ?? Math.max(1, preparing.preparationFailed),
          elapsedMs: Math.max(
            0,
            Date.now() - (preparing.preparationStartedAt ?? now()).getTime(),
          ),
        },
        startedAt: preparing.preparationStartedAt ?? now(),
      });
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
