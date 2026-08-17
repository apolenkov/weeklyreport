import { randomUUID } from "node:crypto";

import type {
  AiProviderConfigurationRead,
  AiProviderDraft,
} from "@customreport/shared";

import { AI_PROVIDER_EVALUATOR_VERSION } from "../infrastructure/ai-compatibility.queue.js";
import { bootstrapAiProvider } from "./ai-provider.bootstrap.js";
import { saveAiProviderDraft } from "./ai-provider.draft-service.save.js";
import { executeAiProviderTest } from "./ai-provider.draft-service.test-execution.js";
import { AiProviderReadService } from "./ai-provider.read-service.js";
import {
  AiProviderConfigurationError,
  type AiProviderServiceDependencies,
  requireRevision,
  safeRevision,
  toSharedProfile,
} from "./ai-provider.service-support.js";

export class AiProviderDraftService {
  constructor(
    private readonly dependencies: AiProviderServiceDependencies,
    private readonly reader: AiProviderReadService,
  ) {}

  save(
    input: AiProviderDraft,
    actorId: string,
  ): Promise<AiProviderConfigurationRead> {
    return saveAiProviderDraft(this.dependencies, input, actorId);
  }

  async test(
    revisionId: string,
    actorId: string,
  ): Promise<AiProviderConfigurationRead> {
    const revision = await requireRevision(this.dependencies, revisionId);
    const enqueuer = this.dependencies.testEnqueuer;
    if (!enqueuer) {
      throw new AiProviderConfigurationError(
        "AI provider compatibility queue is not wired",
      );
    }
    const execution =
      await this.dependencies.repository.createOrReuseProviderExecution(
        revision.id,
        { evaluatorVersion: AI_PROVIDER_EVALUATOR_VERSION },
      );
    if (execution.created) {
      await enqueuer.enqueue({
        traceId: randomUUID(),
        executionId: execution.id,
        kind: "provider_test",
      });
    }
    const queued = await requireRevision(this.dependencies, revisionId);
    this.dependencies.audit.record({
      event: "ai_provider.test_queued",
      actorId,
      revisionId,
      profile: toSharedProfile(revision.generationProfile),
    });
    return safeRevision(queued, this.dependencies.codec);
  }

  executeTest(
    revisionId: string,
    actorId = "worker",
    executionId?: string,
  ): Promise<AiProviderConfigurationRead> {
    return executeAiProviderTest(
      this.dependencies,
      revisionId,
      actorId,
      executionId,
    );
  }

  bootstrap(actorId: string) {
    return bootstrapAiProvider(this.dependencies, this.reader, actorId);
  }
}
