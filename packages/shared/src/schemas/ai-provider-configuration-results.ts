import { z } from "zod";

const MAX_FAILURE_CODE_LENGTH = 100;
const MAX_GENERATION_CAPABILITIES = 10;
const MAX_EMBEDDING_CAPABILITIES = 5;

/** Public shared schema or contract constant for ai provider capability status schema. */
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

/** Public shared schema or contract constant for ai provider capability schema. */
export const aiProviderCapabilitySchema = z.union([
  aiProviderGenerationCapabilitySchema,
  aiProviderEmbeddingCapabilitySchema,
]);

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
    capabilities: z
      .array(capabilityResult(aiProviderGenerationCapabilitySchema))
      .max(MAX_GENERATION_CAPABILITIES),
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

/** Public shared schema or contract constant for ai provider capability test result schema. */
export const aiProviderCapabilityTestResultSchema = z
  .object({
    status: aiProviderCapabilityStatusSchema,
    generation: generationLaneSchema,
    embeddings: embeddingsLaneSchema,
    testedAt: z.coerce.date().nullable(),
  })
  .strict();
