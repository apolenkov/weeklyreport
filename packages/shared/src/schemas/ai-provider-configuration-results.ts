import { z } from "zod";

import {
  AI_PROMPT_EVALUATION_CHECK_LIMIT,
  aiFeatureKeySchema,
  aiPromptEvaluationCheckSchema,
} from "./ai-prompt-management";

const MAX_FAILURE_CODE_LENGTH = 100;
const MAX_GENERATION_CAPABILITIES = 10;
const MAX_EMBEDDING_CAPABILITIES = 5;
const MAX_EVALUATOR_VERSION_LENGTH = 120;
const MAX_FEATURE_COMPATIBILITY = 20;

export const aiProviderAnswerProtocolSchema = z.enum([
  "json_object",
  "json_schema",
  "forced_tool",
]);

export const aiProviderCapabilityStatusSchema = z.enum([
  "passed",
  "failed",
  "inconclusive",
]);

const aiProviderGenerationCapabilitySchema = z.enum([
  "authentication",
  "structured_planner",
  "planner_tool_call",
  "structured_answer",
  "token_usage",
]);

const aiProviderEmbeddingCapabilitySchema = z.enum([
  "authentication",
  "batch_embeddings",
  "token_usage",
]);

export const aiProviderCapabilitySchema = z.union([
  aiProviderGenerationCapabilitySchema,
  aiProviderEmbeddingCapabilitySchema,
]);

export const aiProviderFeatureCompatibilitySchema = z
  .object({
    featureKey: aiFeatureKeySchema,
    promptRevisionId: z.uuid(),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/u),
    evaluatorVersion: z
      .string()
      .trim()
      .min(1)
      .max(MAX_EVALUATOR_VERSION_LENGTH),
    outcome: aiProviderCapabilityStatusSchema,
    checks: z
      .array(aiPromptEvaluationCheckSchema)
      .min(1)
      .max(AI_PROMPT_EVALUATION_CHECK_LIMIT),
  })
  .strict();

const capabilityResult = <TSchema extends z.ZodType>(capability: TSchema) =>
  z
    .object({
      capability,
      status: aiProviderCapabilityStatusSchema,
      failureCode: z
        .string()
        .trim()
        .min(1)
        .max(MAX_FAILURE_CODE_LENGTH)
        .optional(),
    })
    .strict();

const generationLaneSchema = z
  .object({
    status: aiProviderCapabilityStatusSchema,
    answerProtocol: aiProviderAnswerProtocolSchema.nullable(),
    capabilities: z
      .array(capabilityResult(aiProviderGenerationCapabilitySchema))
      .max(MAX_GENERATION_CAPABILITIES),
    featureCompatibility: z
      .array(aiProviderFeatureCompatibilitySchema)
      .max(MAX_FEATURE_COMPATIBILITY),
  })
  .strict();

const embeddingsLaneSchema = z
  .object({
    status: aiProviderCapabilityStatusSchema,
    capabilities: z
      .array(capabilityResult(aiProviderEmbeddingCapabilitySchema))
      .max(MAX_EMBEDDING_CAPABILITIES),
  })
  .strict();

export const aiProviderCapabilityTestResultSchema = z
  .object({
    status: aiProviderCapabilityStatusSchema,
    generation: generationLaneSchema,
    embeddings: embeddingsLaneSchema,
    testedAt: z.coerce.date().nullable(),
  })
  .strict();
