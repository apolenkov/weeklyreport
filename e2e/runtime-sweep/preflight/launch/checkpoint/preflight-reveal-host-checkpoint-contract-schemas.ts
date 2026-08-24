import { z } from "zod";

import { stableIdentifierSchema } from "../../../source/contracts.ts";

const MAX_PRESSURE_FREE_PERCENT = 100;

const createPrimitiveSchemas = () => {
  const digestSchema = z.string().regex(/^[0-9a-f]{64}$/u);
  const positiveIntegerSchema = z.number().int().positive();
  const nonNegativeIntegerSchema = z.number().int().nonnegative();
  const finiteNonNegativeSchema = z.number().nonnegative();
  const finitePercentSchema = finiteNonNegativeSchema.max(
    MAX_PRESSURE_FREE_PERCENT,
  );
  return {
    digestSchema,
    positiveIntegerSchema,
    nonNegativeIntegerSchema,
    finiteNonNegativeSchema,
    finitePercentSchema,
  };
};

type PrimitiveSchemas = ReturnType<typeof createPrimitiveSchemas>;

const createRunSchema = (digestSchema: PrimitiveSchemas["digestSchema"]) =>
  z
    .object({
      campaignId: z.string().min(1),
      sourceSha: z.string().regex(/^[0-9a-f]{40}$/u),
      sourceTree: z.string().regex(/^[0-9a-f]{40}$/u),
      treeDigest: digestSchema,
      sourceDigest: digestSchema,
      planDigest: digestSchema,
      attemptId: stableIdentifierSchema,
      stateId: z.string().min(1),
      stateDigest: digestSchema,
      profile: z.string().min(1),
      role: z.string().min(1),
      route: z.string().min(1),
      routeDigest: digestSchema,
    })
    .strict();

const createSampleSchema = ({
  positiveIntegerSchema,
  nonNegativeIntegerSchema,
  finiteNonNegativeSchema,
  finitePercentSchema,
}: PrimitiveSchemas) => {
  const streaksSchema = z
    .object({
      rawFreeBytes: nonNegativeIntegerSchema,
      availableBytes: nonNegativeIntegerSchema,
      pressureFreePercent: nonNegativeIntegerSchema,
      compressedBytes: nonNegativeIntegerSchema,
    })
    .strict();
  return z
    .object({
      eventSequence: positiveIntegerSchema,
      timestampWall: finiteNonNegativeSchema,
      phase: z.literal("runtime"),
      status: z.literal("healthy"),
      reasons: z.array(z.string()),
      breachStreaks: streaksSchema,
      pressureState: z.literal("normal"),
      metrics: z
        .object({
          rawFreeBytes: finiteNonNegativeSchema,
          availableBytes: finiteNonNegativeSchema,
          totalBytes: finiteNonNegativeSchema,
          swapFreeBytes: finiteNonNegativeSchema,
          pressureFreePercent: finitePercentSchema,
          swapUsedBytes: finiteNonNegativeSchema,
          compressedBytes: finiteNonNegativeSchema,
          cumulativeCounters: z
            .object({
              pageins: nonNegativeIntegerSchema,
              pageouts: nonNegativeIntegerSchema,
              swapins: nonNegativeIntegerSchema,
              swapouts: nonNegativeIntegerSchema,
            })
            .strict(),
        })
        .strict(),
      nextCounters: z
        .object({
          pageins: nonNegativeIntegerSchema,
          pageouts: nonNegativeIntegerSchema,
          swapins: nonNegativeIntegerSchema,
          swapouts: nonNegativeIntegerSchema,
        })
        .strict(),
    })
    .strict();
};

const createRequestBodySchema = <
  const TRequestArtifact extends string,
  const TVersion extends number,
>(
  input: {
    readonly requestArtifact: TRequestArtifact;
    readonly version: TVersion;
  },
  runSchema: ReturnType<typeof createRunSchema>,
  {
    digestSchema,
    positiveIntegerSchema,
    nonNegativeIntegerSchema,
    finiteNonNegativeSchema,
  }: PrimitiveSchemas,
) =>
  z
    .object({
      artifact: z.literal(input.requestArtifact),
      version: z.literal(input.version),
      run: runSchema,
      checkpointSequence: positiveIntegerSchema,
      completedChildOrdinal: nonNegativeIntegerSchema,
      boundaryTimestamp: finiteNonNegativeSchema,
      receiptHead: digestSchema.nullable(),
      receiptCount: nonNegativeIntegerSchema,
      chunkHead: digestSchema.nullable(),
      chunkCount: nonNegativeIntegerSchema,
      completedCandidateCount: nonNegativeIntegerSchema,
      previousCheckpointDigest: digestSchema.nullable(),
      previousSampleSequence: positiveIntegerSchema.nullable(),
    })
    .strict();

const createResponseBodySchema = <
  const TResponseArtifact extends string,
  const TVersion extends number,
>(
  input: {
    readonly responseArtifact: TResponseArtifact;
    readonly version: TVersion;
  },
  runSchema: ReturnType<typeof createRunSchema>,
  sampleSchema: ReturnType<typeof createSampleSchema>,
  {
    digestSchema,
    positiveIntegerSchema,
    nonNegativeIntegerSchema,
    finiteNonNegativeSchema,
  }: PrimitiveSchemas,
) =>
  z
    .object({
      artifact: z.literal(input.responseArtifact),
      version: z.literal(input.version),
      status: z.literal("HEALTHY"),
      run: runSchema,
      checkpointSequence: positiveIntegerSchema,
      completedChildOrdinal: nonNegativeIntegerSchema,
      requestDigest: digestSchema,
      predecessorCheckpointDigest: digestSchema.nullable(),
      baselineReceiptDigest: digestSchema,
      controllerObservationTimestamp: finiteNonNegativeSchema,
      sample: sampleSchema,
      coverage: z
        .object({
          priorSequence: nonNegativeIntegerSchema,
          firstSequence: positiveIntegerSchema,
          lastSequence: positiveIntegerSchema,
          coveredCount: positiveIntegerSchema,
        })
        .strict(),
      thresholdDigest: digestSchema,
      hostRecordDigest: digestSchema,
    })
    .strict();

const createCompletionBodySchema = <
  const TCompletionArtifact extends string,
  const TVersion extends number,
>(
  input: {
    readonly completionArtifact: TCompletionArtifact;
    readonly version: TVersion;
  },
  runSchema: ReturnType<typeof createRunSchema>,
  {
    digestSchema,
    positiveIntegerSchema,
    nonNegativeIntegerSchema,
    finiteNonNegativeSchema,
  }: PrimitiveSchemas,
) =>
  z
    .object({
      artifact: z.literal(input.completionArtifact),
      version: z.literal(input.version),
      run: runSchema,
      terminalChildOrdinal: nonNegativeIntegerSchema,
      lastCheckpointSequence: nonNegativeIntegerSchema,
      lastResponseDigest: digestSchema.nullable(),
      receiptHead: digestSchema.nullable(),
      receiptCount: nonNegativeIntegerSchema,
      chunkHead: digestSchema.nullable(),
      chunkCount: nonNegativeIntegerSchema,
      completedCandidateCount: nonNegativeIntegerSchema,
      lastSampleSequence: positiveIntegerSchema.nullable(),
      parentPassDigest: digestSchema,
      terminalTimestamp: finiteNonNegativeSchema,
    })
    .strict();

export const createHostCheckpointSchemas = <
  const TRequestArtifact extends string,
  const TResponseArtifact extends string,
  const TCompletionArtifact extends string,
  const TVersion extends number,
>(input: {
  readonly requestArtifact: TRequestArtifact;
  readonly responseArtifact: TResponseArtifact;
  readonly completionArtifact: TCompletionArtifact;
  readonly version: TVersion;
}) => {
  const primitives = createPrimitiveSchemas();
  const runSchema = createRunSchema(primitives.digestSchema);
  const sampleSchema = createSampleSchema(primitives);
  const requestBodySchema = createRequestBodySchema(
    input,
    runSchema,
    primitives,
  );
  const responseBodySchema = createResponseBodySchema(
    input,
    runSchema,
    sampleSchema,
    primitives,
  );
  const completionBodySchema = createCompletionBodySchema(
    input,
    runSchema,
    primitives,
  );

  return {
    digestSchema: primitives.digestSchema,
    runSchema,
    sampleSchema,
    requestBodySchema,
    responseBodySchema,
    completionBodySchema,
  };
};
