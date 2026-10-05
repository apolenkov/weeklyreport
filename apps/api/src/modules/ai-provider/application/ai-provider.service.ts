import type {
  AiProviderAvailabilityRead,
  AiProviderConfigurationRead,
  AiProviderControlRead,
  AiProviderDiscardResult,
  AiProviderDraft,
  AiProviderPreparationProgress,
} from "@customreport/shared";
import { Inject, Injectable, Optional } from "@nestjs/common";

import { ENV_CONFIG } from "../../../infrastructure/config/config.module.js";
import { AiProviderPrometheusMetrics } from "../../../infrastructure/metrics/ai-provider.metrics.js";
import { APP_LOGGER } from "../../../lib/audit-logger.js";
import { type AppLogger, createNullLogger } from "../../../lib/logger.js";
import { AiProviderConfigurationRepository } from "../infrastructure/ai-provider.repository.js";
import { AI_PROVIDER_TEST_ENQUEUER } from "../infrastructure/ai-provider-test.queue.js";
import { AesGcmCredentialCodec } from "../infrastructure/credential-codec.js";
import { AiProviderActivationService } from "./ai-provider.activation-service.js";
import { AiProviderDraftService } from "./ai-provider.draft-service.js";
import { AiProviderReadService } from "./ai-provider.read-service.js";
import {
  AI_PROVIDER_CAPABILITY_TESTER,
  AI_PROVIDER_PREPARATION_COORDINATOR,
  type AiProviderAuditSink,
  type AiProviderCapabilityTester,
  AiProviderConfigurationError,
  type AiProviderMetricsSink,
  AiProviderNotFoundError,
  type AiProviderPreparationCoordinator,
  type AiProviderServiceDependencies,
  NOOP_METRICS,
} from "./ai-provider.service-support.js";
import type {
  AiProviderEnvironment,
  AiProviderExecutionClaim,
  AiProviderTestEnqueuer,
} from "./ai-provider.service-types.js";
import {
  AI_RUNTIME_HEALTH,
  type AiRuntimeHealth,
} from "./ai-runtime-health.js";

export type {
  AiProviderCapabilityRuntimeConfig,
  AiProviderCapabilityTester,
  AiProviderCapabilityTestMetrics,
  AiProviderMetricsSink,
  AiProviderPreparationCoordinator,
  AiProviderPreparationMetrics,
  AiProviderStateMetrics,
} from "./ai-provider.service-support.js";
export {
  AiProviderConfigurationError,
  AiProviderConflictError,
  AiProviderNotFoundError,
} from "./ai-provider.service-support.js";

@Injectable()
export class AiProviderConfigurationService {
  private readonly dependencies: Readonly<{
    repository: AiProviderConfigurationRepository;
    audit: AiProviderAuditSink;
  }>;
  private readonly reader: AiProviderReadService;
  private readonly drafts: AiProviderDraftService;
  private readonly activations: AiProviderActivationService;

  constructor(
    @Inject(AiProviderConfigurationRepository)
    repository: AiProviderConfigurationRepository,
    @Inject(AesGcmCredentialCodec)
    codec: AesGcmCredentialCodec,
    @Inject(ENV_CONFIG)
    env: AiProviderEnvironment,
    @Inject(AI_PROVIDER_CAPABILITY_TESTER)
    tester?: AiProviderCapabilityTester,
    @Inject(AI_PROVIDER_PREPARATION_COORDINATOR)
    preparation?: AiProviderPreparationCoordinator,
    @Inject(APP_LOGGER)
    logger: AppLogger = createNullLogger(),
    @Inject(AiProviderPrometheusMetrics)
    metrics: AiProviderMetricsSink = NOOP_METRICS,
    @Inject(AI_PROVIDER_TEST_ENQUEUER)
    testEnqueuer?: AiProviderTestEnqueuer,
    @Optional()
    @Inject(AI_RUNTIME_HEALTH)
    runtimeHealth?: AiRuntimeHealth,
  ) {
    const audit: AiProviderAuditSink = {
      record: (event) => logger.info("ai_provider.audit", { ...event }),
    };
    this.dependencies = { repository, audit };
    const dependencies = {
      repository,
      codec,
      env,
      audit,
      metrics,
      ...(tester ? { tester } : {}),
      ...(preparation ? { preparation } : {}),
      ...(testEnqueuer ? { testEnqueuer } : {}),
      ...(runtimeHealth ? { runtimeHealth } : {}),
    } satisfies AiProviderServiceDependencies;
    this.reader = new AiProviderReadService(dependencies);
    this.drafts = new AiProviderDraftService(dependencies);
    this.activations = new AiProviderActivationService(
      dependencies,
      this.reader,
    );
  }

  read(): Promise<AiProviderControlRead> {
    return this.reader.read();
  }

  availability(): Promise<AiProviderAvailabilityRead> {
    return this.reader.availability();
  }

  save(
    input: AiProviderDraft,
    actorId: string,
  ): Promise<AiProviderConfigurationRead> {
    return this.drafts.save(input, actorId);
  }

  test(
    revisionId: string,
    actorId: string,
  ): Promise<AiProviderConfigurationRead> {
    return this.drafts.test(revisionId, actorId);
  }

  executeTest(
    revisionId: string,
    actorId = "worker",
    executionClaim?: AiProviderExecutionClaim,
  ): Promise<AiProviderConfigurationRead> {
    return this.drafts.executeTest(revisionId, actorId, executionClaim);
  }

  activate(
    revisionId: string,
    actorId: string,
  ): Promise<AiProviderControlRead> {
    return this.activations.activate(revisionId, actorId);
  }

  disable(actorId: string): Promise<AiProviderControlRead> {
    return this.activations.disable(actorId);
  }

  restore(revisionId: string, actorId: string): Promise<AiProviderControlRead> {
    return this.activations.restore(revisionId, actorId);
  }

  async discard(
    revisionId: string,
    actorId: string,
  ): Promise<AiProviderDiscardResult> {
    const revision = await this.dependencies.repository.getRevision(revisionId);
    if (!revision) throw new AiProviderNotFoundError();
    if (revision.lifecycle !== "draft" && revision.lifecycle !== "failed") {
      throw new AiProviderConfigurationError(
        "Only draft or failed AI provider attempts can be discarded",
      );
    }
    if (!(await this.dependencies.repository.discardDisposable(revisionId))) {
      throw new AiProviderConfigurationError(
        "AI provider attempt could not be discarded",
      );
    }
    this.dependencies.audit.record({
      event: "ai_provider.discarded",
      actorId,
      revisionId,
      generationProfile: revision.generationProfile,
      embeddingMode: revision.embeddingMode,
      plannerModel: revision.plannerModel,
      answerModel: revision.answerModel,
      embeddingModel: revision.embeddingModel,
    });
    return { discarded: true };
  }

  progress(revisionId: string): Promise<AiProviderPreparationProgress> {
    return this.reader.progress(revisionId);
  }
}
