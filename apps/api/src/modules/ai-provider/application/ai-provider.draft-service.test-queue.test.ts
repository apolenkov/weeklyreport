import {
  AiProviderLifecycle,
  AiProviderProfile,
  AiProviderReasoningMode,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { StoredAiProviderRevision } from "../infrastructure/ai-provider.repository.js";
import { AI_PROVIDER_TEST_SUITE_VERSION } from "../infrastructure/ai-provider-test.queue.js";
import { AesGcmCredentialCodec } from "../infrastructure/credential-codec.js";
import { AiProviderDraftService } from "./ai-provider.draft-service.js";

const codec = new AesGcmCredentialCodec("a".repeat(64), 1);
const now = new Date("2026-08-10T00:00:00.000Z");
const revisionId = "11111111-1111-4111-8111-111111111111";
const executionId = "44444444-4444-4444-8444-444444444444";

type LatestExecution = NonNullable<StoredAiProviderRevision["latestExecution"]>;
type ExecutionState = LatestExecution["state"];

const execution = (state: ExecutionState): LatestExecution => ({
  id: executionId,
  testSuiteVersion: AI_PROVIDER_TEST_SUITE_VERSION,
  state,
  outcome: null,
  failureCode: null,
  checks: [],
  requestedAt: now,
  startedAt: state === "queued" ? null : now,
  completedAt: state === "completed" ? now : null,
});

const revision = (
  latestExecution: LatestExecution | null,
): StoredAiProviderRevision => ({
  id: revisionId,
  generationProfile: AiProviderProfile.mistral,
  generationBaseUrl: "https://api.mistral.ai/v1",
  generationEndpointIdentity: "mistral:api",
  plannerModel: "planner",
  answerModel: "answer",
  reasoningMode: AiProviderReasoningMode.provider_default,
  reasoningCustomValue: null,
  generationCredentialCiphertext: "ciphertext-secret",
  generationCredentialNonce: "nonce-secret",
  generationCredentialTag: "tag-secret",
  generationCredentialKeyVersion: 1,
  generationCredentialMaskedSuffix: "••••cret",
  embeddingMode: "reuse_generation",
  embeddingProfile: null,
  embeddingBaseUrl: null,
  embeddingEndpointIdentity: null,
  embeddingModel: "embed",
  embeddingDimensions: 1024,
  embeddingCredentialCiphertext: null,
  embeddingCredentialNonce: null,
  embeddingCredentialTag: null,
  embeddingCredentialKeyVersion: null,
  embeddingCredentialMaskedSuffix: null,
  semanticInputVersion: "report-assistant/v1",
  generationCompatibilityIdentity: "generation-identity",
  embeddingScopeIdentity: "embedding-identity",
  compositeTestIdentity: "composite-identity",
  lifecycle: AiProviderLifecycle.draft,
  testResult: null,
  latestExecution,
  testedAt: null,
  preparationCompleted: 0,
  preparationTotal: 0,
  preparationFailed: 0,
  preparationStartedAt: null,
  preparationFinishedAt: null,
  preparationElapsedMs: 0,
  preparationSourceFingerprint: null,
  preparationSourceGeneration: null,
  activatedAt: null,
  supersededAt: null,
  createdAt: now,
  updatedAt: now,
});

interface Reuse {
  readonly id: string;
  readonly created: boolean;
  readonly state: ExecutionState;
}

interface EnqueueRequest {
  readonly traceId: string;
  readonly executionId: string;
}

const harness = (
  reuse: Reuse,
  reads: Readonly<{
    before: LatestExecution | null;
    after: LatestExecution | null;
  }>,
) => {
  const enqueue = vi
    .fn<(request: EnqueueRequest) => Promise<void>>()
    .mockResolvedValue(undefined);
  const record = vi.fn();
  const createOrReuseProviderExecution = vi.fn().mockResolvedValue(reuse);
  const getRevision = vi
    .fn()
    .mockResolvedValueOnce(revision(reads.before))
    .mockResolvedValue(revision(reads.after));
  const service = new AiProviderDraftService({
    repository: { createOrReuseProviderExecution, getRevision },
    testEnqueuer: { enqueue },
    audit: { record },
    codec,
  } as never);
  return { service, enqueue, record };
};

const auditedEvents = (record: ReturnType<typeof vi.fn>): string[] =>
  record.mock.calls.map(([entry]) => (entry as { event: string }).event);

describe("AiProviderDraftService.test enqueue, audit and returned state (TASK-503.50 C0890)", () => {
  it("control: a created execution is enqueued once, audited once and returned as queued", async () => {
    const { service, enqueue, record } = harness(
      { id: executionId, created: true, state: "queued" },
      { before: null, after: execution("queued") },
    );

    const read = await service.test(revisionId, "admin-1");

    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue.mock.calls[0]?.[0]).toMatchObject({ executionId });
    expect(enqueue.mock.calls[0]?.[0]?.traceId).toEqual(expect.any(String));
    expect(auditedEvents(record)).toEqual(["ai_provider.test_queued"]);
    expect(read.latestExecution).toMatchObject({
      id: executionId,
      state: "queued",
    });
  });

  it("control: a reused queued execution is enqueued again, audited once and returned as queued", async () => {
    const { service, enqueue, record } = harness(
      { id: executionId, created: false, state: "queued" },
      { before: execution("queued"), after: execution("queued") },
    );

    const read = await service.test(revisionId, "admin-1");

    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(auditedEvents(record)).toEqual(["ai_provider.test_queued"]);
    expect(read.latestExecution).toMatchObject({ state: "queued" });
  });

  it("does not enqueue, does not audit and returns the current running state for an execution that is already running", async () => {
    const { service, enqueue, record } = harness(
      { id: executionId, created: false, state: "running" },
      { before: execution("queued"), after: execution("running") },
    );

    const read = await service.test(revisionId, "admin-1");

    expect(enqueue).not.toHaveBeenCalled();
    expect(auditedEvents(record)).not.toContain("ai_provider.test_queued");
    expect(read.latestExecution).toMatchObject({
      id: executionId,
      state: "running",
    });
  });
});
