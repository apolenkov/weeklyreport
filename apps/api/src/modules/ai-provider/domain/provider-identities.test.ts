import { describe, expect, it } from "vitest";

import { AesGcmCredentialCodec } from "../infrastructure/credential-codec.js";
import {
  buildCompositeTestIdentity,
  buildEmbeddingScopeIdentity,
  buildGenerationCompatibilityIdentity,
} from "./provider-identities.js";

const evaluatorVersion = "provider-compatibility-v5";
const codec = new AesGcmCredentialCodec("a".repeat(64), 1);

const generationIdentity = (answerModel = "answer-1") =>
  buildGenerationCompatibilityIdentity({
    profile: "openai",
    endpointIdentity: "openai:stable-endpoint",
    credentialFingerprint: codec.fingerprint("generation-secret"),
    plannerModel: "planner-1",
    answerModel,
    reasoningMode: "provider_default",
    reasoningCustomValue: null,
    answerProtocol: "json_schema",
    evaluatorVersion,
  });

const embeddingScope = (model = "text-embedding-3-small") =>
  buildEmbeddingScopeIdentity({
    endpointIdentity: "openai:stable-endpoint",
    model,
    semanticInputVersion: "report-assistant/v1",
    dimensions: 1536,
  });

describe("provider compatibility identities", () => {
  it("retains generation compatibility across embedding-only changes", () => {
    const generation = generationIdentity();
    const firstComposite = buildCompositeTestIdentity({
      generationCompatibilityIdentity: generation,
      embeddings: { mode: "reuse_generation", model: "text-embedding-3-small" },
      evaluatorVersion,
    });
    const secondComposite = buildCompositeTestIdentity({
      generationCompatibilityIdentity: generation,
      embeddings: { mode: "reuse_generation", model: "text-embedding-3-large" },
      evaluatorVersion,
    });

    expect(generation).toBe(generationIdentity());
    expect(secondComposite).not.toBe(firstComposite);
  });

  it("keeps embedding scope stable when generation behavior changes", () => {
    const scope = embeddingScope();

    expect(generationIdentity("answer-2")).not.toBe(generationIdentity());
    expect(scope).toBe(embeddingScope());
  });

  it("excludes embedding credential rotation from cache scope", () => {
    const scope = embeddingScope();
    const firstComposite = buildCompositeTestIdentity({
      generationCompatibilityIdentity: generationIdentity(),
      embeddings: {
        mode: "separate",
        profile: "jina",
        endpointIdentity: "jina:stable-endpoint",
        credentialFingerprint: codec.fingerprint("embedding-secret-1"),
        model: "jina-embeddings-v3",
      },
      evaluatorVersion,
    });
    const rotatedComposite = buildCompositeTestIdentity({
      generationCompatibilityIdentity: generationIdentity(),
      embeddings: {
        mode: "separate",
        profile: "jina",
        endpointIdentity: "jina:stable-endpoint",
        credentialFingerprint: codec.fingerprint("embedding-secret-2"),
        model: "jina-embeddings-v3",
      },
      evaluatorVersion,
    });

    expect(rotatedComposite).not.toBe(firstComposite);
    expect(scope).toBe(embeddingScope());
  });

  it("fingerprints retained plaintext independently of encryption randomness", () => {
    const first = codec.encrypt("same-secret", {
      revisionId: "11111111-1111-4111-8111-111111111111",
      role: "generation",
    });
    const second = codec.encrypt("same-secret", {
      revisionId: "22222222-2222-4222-8222-222222222222",
      role: "generation",
    });

    expect(first.ciphertext).not.toBe(second.ciphertext);
    expect(
      codec.fingerprint(
        codec.decrypt(first, {
          revisionId: "11111111-1111-4111-8111-111111111111",
          role: "generation",
        }),
      ),
    ).toBe(
      codec.fingerprint(
        codec.decrypt(second, {
          revisionId: "22222222-2222-4222-8222-222222222222",
          role: "generation",
        }),
      ),
    );
  });
});
