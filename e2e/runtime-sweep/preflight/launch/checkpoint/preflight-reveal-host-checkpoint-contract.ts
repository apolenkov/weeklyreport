import { z } from "zod";

import { stableIdentifierSchema } from "../../../source/contracts.ts";
import { sha256Hex, stableSerialize } from "../../../support/ids.ts";
import { HOST_ENVELOPE_THRESHOLDS } from "../../diagnostics/preflight-diagnostic-host-envelope.ts";

export const PREFLIGHT_REVEAL_HOST_CHECKPOINT_REQUEST =
  "PREFLIGHT_REVEAL_HOST_CHECKPOINT_REQUEST" as const;
export const PREFLIGHT_REVEAL_HOST_CHECKPOINT =
  "PREFLIGHT_REVEAL_HOST_CHECKPOINT" as const;
export const PREFLIGHT_REVEAL_HOST_CHECKPOINT_COMPLETE =
  "PREFLIGHT_REVEAL_HOST_CHECKPOINT_COMPLETE" as const;
export const PREFLIGHT_REVEAL_HOST_CHECKPOINT_VERSION = 1 as const;
const KIBIBYTE_BYTES = 1024;
const MAX_HOST_CHECKPOINT_KIBIBYTES = 16;
const MAX_PRESSURE_FREE_PERCENT = 100;
export const HOST_CHECKPOINT_MAX_BYTES =
  MAX_HOST_CHECKPOINT_KIBIBYTES * KIBIBYTE_BYTES;
export const HOST_CHECKPOINT_TIMEOUT_MS = 5000;

const digestSchema = z.string().regex(/^[0-9a-f]{64}$/u);
const positiveIntegerSchema = z.number().int().positive();
const nonNegativeIntegerSchema = z.number().int().nonnegative();
const finiteNonNegativeSchema = z.number().nonnegative();
const finitePercentSchema = finiteNonNegativeSchema.max(
  MAX_PRESSURE_FREE_PERCENT,
);

const runSchema = z
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

const streaksSchema = z
  .object({
    rawFreeBytes: nonNegativeIntegerSchema,
    availableBytes: nonNegativeIntegerSchema,
    pressureFreePercent: nonNegativeIntegerSchema,
    compressedBytes: nonNegativeIntegerSchema,
  })
  .strict();

const sampleSchema = z
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

const requestBodySchema = z
  .object({
    artifact: z.literal(PREFLIGHT_REVEAL_HOST_CHECKPOINT_REQUEST),
    version: z.literal(PREFLIGHT_REVEAL_HOST_CHECKPOINT_VERSION),
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

const responseBodySchema = z
  .object({
    artifact: z.literal(PREFLIGHT_REVEAL_HOST_CHECKPOINT),
    version: z.literal(PREFLIGHT_REVEAL_HOST_CHECKPOINT_VERSION),
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

const completionBodySchema = z
  .object({
    artifact: z.literal(PREFLIGHT_REVEAL_HOST_CHECKPOINT_COMPLETE),
    version: z.literal(PREFLIGHT_REVEAL_HOST_CHECKPOINT_VERSION),
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

export type HostCheckpointRun = z.infer<typeof runSchema>;
export type HostCheckpointRequest = z.infer<typeof requestBodySchema> & {
  readonly requestDigest: string;
};
export type HostCheckpointSample = z.infer<typeof sampleSchema>;
export type HostCheckpointResponse = z.infer<typeof responseBodySchema> & {
  readonly responseDigest: string;
};
export type HostCheckpointCompletion = z.infer<typeof completionBodySchema> & {
  readonly completionDigest: string;
};
export type HostCheckpointCompletionBody = Omit<
  HostCheckpointCompletion,
  "completionDigest" | "parentPassDigest" | "terminalTimestamp"
>;

export const hostCheckpointThresholdDigest = (): string =>
  sha256Hex({
    domain: "customreport/runtime-sweep/host-checkpoint/thresholds/v1",
    value: HOST_ENVELOPE_THRESHOLDS,
  });

const bodyDigestFor = (domain: string, value: unknown): string =>
  sha256Hex({
    domain: `customreport/runtime-sweep/host-checkpoint/${domain}/v1`,
    value,
  });

export const requestDigestForBody = (
  value: Omit<HostCheckpointRequest, "requestDigest">,
): string => bodyDigestFor("request", value);

export const responseDigestForBody = (
  value: Omit<HostCheckpointResponse, "responseDigest">,
): string => bodyDigestFor("response", value);

export const completionDigestForBody = (
  value: Omit<HostCheckpointCompletion, "completionDigest">,
): string => bodyDigestFor("completion", value);

export const hostRecordDigestFor = (value: HostCheckpointSample): string =>
  bodyDigestFor("host-record", value);

export const canonicalHostCheckpointBytes = (value: unknown): string =>
  `${stableSerialize(value)}\n`;

const parseCanonical = <T>(text: string, parse: (value: unknown) => T): T => {
  if (
    !text.endsWith("\n") ||
    Buffer.byteLength(text, "utf8") > HOST_CHECKPOINT_MAX_BYTES
  )
    throw new Error("Host checkpoint bytes are not canonical or exceed 16 KiB");
  const value: unknown = JSON.parse(text);
  const parsed = parse(value);
  if (canonicalHostCheckpointBytes(parsed) !== text)
    throw new Error("Host checkpoint bytes are not canonical");
  return parsed;
};

export const createHostCheckpointRequest = (
  body: z.input<typeof requestBodySchema>,
): HostCheckpointRequest => {
  const parsed = requestBodySchema.parse(body);
  assertRequestSequence(parsed);
  return { ...parsed, requestDigest: requestDigestForBody(parsed) };
};

const assertRequestSequence = (
  parsed: z.infer<typeof requestBodySchema>,
): void => {
  if ((parsed.receiptCount === 0) !== (parsed.receiptHead === null))
    throw new Error("Host checkpoint receipt head does not match its count");
  if ((parsed.chunkCount === 0) !== (parsed.chunkHead === null))
    throw new Error("Host checkpoint chunk head does not match its count");
  if (parsed.completedCandidateCount === 0)
    throw new Error("Host checkpoint request has no completed candidates");
  if (parsed.checkpointSequence !== parsed.completedChildOrdinal + 1)
    throw new Error(
      "Host checkpoint request sequence is not the next child ordinal",
    );
  if (parsed.checkpointSequence === 1) {
    if (
      parsed.previousCheckpointDigest !== null ||
      parsed.previousSampleSequence !== null
    )
      throw new Error("First host checkpoint request must have no predecessor");
  } else if (
    parsed.previousCheckpointDigest === null ||
    parsed.previousSampleSequence === null
  ) {
    throw new Error("Non-first host checkpoint request requires a predecessor");
  }
};

export const parseHostCheckpointRequest = (
  value: unknown,
): HostCheckpointRequest => {
  const parsed = requestBodySchema
    .extend({ requestDigest: digestSchema })
    .parse(value);
  const { requestDigest, ...body } = parsed;
  if (requestDigest !== requestDigestForBody(body))
    throw new Error("Host checkpoint request digest mismatch");
  assertRequestSequence(body);
  return parsed;
};

export const parseCanonicalHostCheckpointRequest = (
  text: string,
): HostCheckpointRequest => parseCanonical(text, parseHostCheckpointRequest);

export const createHostCheckpointResponse = (
  body: z.input<typeof responseBodySchema>,
): HostCheckpointResponse => {
  const parsed = responseBodySchema.parse(body);
  assertResponseSequence(parsed);
  return { ...parsed, responseDigest: responseDigestForBody(parsed) };
};
const assertCompletionSequence = (
  parsed: z.infer<typeof completionBodySchema>,
): void => {
  if (parsed.terminalChildOrdinal !== parsed.lastCheckpointSequence)
    throw new Error("Host checkpoint completion child sequence drifted");
  if (
    (parsed.lastCheckpointSequence === 0) !==
    (parsed.lastResponseDigest === null)
  )
    throw new Error("Host checkpoint completion response predecessor drifted");
  if ((parsed.receiptCount === 0) !== (parsed.receiptHead === null))
    throw new Error(
      "Host checkpoint completion receipt head does not match its count",
    );
  if ((parsed.chunkCount === 0) !== (parsed.chunkHead === null))
    throw new Error(
      "Host checkpoint completion chunk head does not match its count",
    );
  if ((parsed.receiptCount === 0) !== (parsed.completedCandidateCount === 0))
    throw new Error(
      "Host checkpoint completion candidate count does not match its receipt count",
    );
  if (
    (parsed.lastCheckpointSequence === 0) !==
    (parsed.lastSampleSequence === null)
  )
    throw new Error("Host checkpoint completion sample predecessor drifted");
  if (parsed.terminalTimestamp <= 0)
    throw new Error("Host checkpoint completion timestamp must be positive");
};
export const createHostCheckpointCompletion = (
  body: z.input<typeof completionBodySchema>,
): HostCheckpointCompletion => {
  const parsed = completionBodySchema.parse(body);
  assertCompletionSequence(parsed);
  return { ...parsed, completionDigest: completionDigestForBody(parsed) };
};
export const parseHostCheckpointCompletion = (
  value: unknown,
): HostCheckpointCompletion => {
  const parsed = completionBodySchema
    .extend({ completionDigest: digestSchema })
    .parse(value);
  const { completionDigest, ...body } = parsed;
  if (completionDigest !== completionDigestForBody(body))
    throw new Error("Host checkpoint completion digest mismatch");
  assertCompletionSequence(body);
  return parsed;
};

export const parseCanonicalHostCheckpointCompletion = (
  text: string,
): HostCheckpointCompletion =>
  parseCanonical(text, parseHostCheckpointCompletion);

const assertResponseSequence = (
  parsed: z.infer<typeof responseBodySchema>,
): void => {
  if (parsed.checkpointSequence !== parsed.completedChildOrdinal + 1)
    throw new Error(
      "Host checkpoint response sequence is not the completed child successor",
    );
};

export const parseHostCheckpointResponse = (
  value: unknown,
): HostCheckpointResponse => {
  const parsed = responseBodySchema
    .extend({ responseDigest: digestSchema })
    .parse(value);
  const { responseDigest, ...body } = parsed;
  if (responseDigest !== responseDigestForBody(body))
    throw new Error("Host checkpoint response digest mismatch");
  if (parsed.thresholdDigest !== hostCheckpointThresholdDigest())
    throw new Error("Host checkpoint threshold digest mismatch");
  if (parsed.hostRecordDigest !== hostRecordDigestFor(parsed.sample))
    throw new Error("Host checkpoint host-record digest mismatch");
  if (parsed.coverage.firstSequence > parsed.coverage.lastSequence)
    throw new Error("Host checkpoint coverage sequence is reversed");
  if (
    parsed.coverage.coveredCount !==
    parsed.coverage.lastSequence - parsed.coverage.firstSequence + 1
  )
    throw new Error("Host checkpoint coverage is not contiguous");
  if (parsed.coverage.priorSequence + 1 !== parsed.coverage.firstSequence)
    throw new Error(
      "Host checkpoint coverage has a gap before the first sequence",
    );
  if (parsed.sample.eventSequence !== parsed.coverage.lastSequence)
    throw new Error("Host checkpoint sample is not the last covered sequence");
  assertResponseSequence(parsed);
  return parsed;
};

export const parseCanonicalHostCheckpointResponse = (
  text: string,
): HostCheckpointResponse => parseCanonical(text, parseHostCheckpointResponse);
