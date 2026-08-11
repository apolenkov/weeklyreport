import type {
  AiProviderAvailabilityRead,
  AiProviderConfigurationRead,
  AiProviderControlRead,
  AiProviderDraft,
  AiProviderPreparationProgress,
} from "@customreport/shared";

import { AiProviderConfigurationRepository } from "../infrastructure/ai-provider.repository.js";
import { AesGcmCredentialCodec } from "../infrastructure/credential-codec.js";
import { AiProviderActivationService } from "./ai-provider.activation-service.js";
import { AiProviderDraftService } from "./ai-provider.draft-service.js";
import { AiProviderReadService } from "./ai-provider.read-service.js";
import {
  type AiProviderAuditSink,
  type AiProviderCapabilityTester,
  type AiProviderMetricsSink,
  type AiProviderPreparationCoordinator,
  NOOP_AUDIT,
  NOOP_METRICS,
} from "./ai-provider.service-support.js";
import type { AiProviderEnvironment } from "./ai-provider.service-types.js";

export type {
  AiProviderCapabilityTester,
  AiProviderCapabilityTestMetrics,
  AiProviderMetricsSink,
  AiProviderPreparationCoordinator,
  AiProviderPreparationMetrics,
  AiProviderStateMetrics,
} from "./ai-provider.service-support.js";
export {
  AiProviderConfigurationError,
  AiProviderNotFoundError,
} from "./ai-provider.service-support.js";

export class AiProviderConfigurationService {
  private readonly reader: AiProviderReadService;
  private readonly drafts: AiProviderDraftService;
  private readonly activations: AiProviderActivationService;

  constructor(
    repository: AiProviderConfigurationRepository,
    codec: AesGcmCredentialCodec,
    env: AiProviderEnvironment,
    tester?: AiProviderCapabilityTester,
    preparation?: AiProviderPreparationCoordinator,
    audit: AiProviderAuditSink = NOOP_AUDIT,
    metrics: AiProviderMetricsSink = NOOP_METRICS,
  ) {
    const dependencies = {
      repository,
      codec,
      env,
      tester,
      preparation,
      audit,
      metrics,
    } as const;
    this.reader = new AiProviderReadService(dependencies);
    this.drafts = new AiProviderDraftService(dependencies, this.reader);
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

  progress(revisionId: string): Promise<AiProviderPreparationProgress> {
    return this.reader.progress(revisionId);
  }

  bootstrap(actorId = "bootstrap"): Promise<AiProviderControlRead> {
    return this.drafts.bootstrap(actorId);
  }
}
