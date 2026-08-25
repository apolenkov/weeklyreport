import { z } from "zod";

import {
  sha256DigestSchema,
  sourceShaSchema,
  sourceTreeSchema,
} from "../../source/contracts.ts";
import { freezeDeep } from "../../source/manifest-source.ts";
import { sha256Hex, stableSerialize } from "../../support/ids.ts";
import type { CapacitySurveyPlan } from "./preflight-capacity-survey-contract.ts";
import {
  assertCapacitySurveyBindings,
  CapacitySurveyContractError,
  capacitySurveyIdentifierSchema,
  capacitySurveyLimitsSchema,
  capacitySurveyRouteSchema,
  capacitySurveySelectorSchema,
  capacitySurveyStateSchema,
  capacitySurveyViewportSchema,
  nonnegativeSafeInteger,
  parseCapacitySurveyTimestamp,
  PREFLIGHT_CAPACITY_SURVEY_AUTHORITY,
  PREFLIGHT_CAPACITY_SURVEY_RESULT,
  PREFLIGHT_CAPACITY_SURVEY_VERSION,
} from "./preflight-capacity-survey-primitives.ts";

const terminalCounterSchema = z
  .object({
    completedCandidateCount: nonnegativeSafeInteger,
    revealActionCount: nonnegativeSafeInteger,
    materialEdgeCount: nonnegativeSafeInteger,
    controlCount: nonnegativeSafeInteger,
    visitedStateCount: nonnegativeSafeInteger,
    maxQueueLength: nonnegativeSafeInteger,
    initialSurfaceDigest: sha256DigestSchema,
    queueEmpty: z.literal(true),
  })
  .strict();

export type CapacitySurveyTerminalCounters = z.infer<
  typeof terminalCounterSchema
>;

const capacitySurveyResultBodySchema = z
  .object({
    artifact: z.literal(PREFLIGHT_CAPACITY_SURVEY_RESULT),
    version: z.literal(PREFLIGHT_CAPACITY_SURVEY_VERSION),
    authority: z.literal(PREFLIGHT_CAPACITY_SURVEY_AUTHORITY),
    status: z.literal("COMPLETE"),
    campaignId: capacitySurveyIdentifierSchema,
    surveyId: capacitySurveyIdentifierSchema,
    sourceSha: sourceShaSchema,
    sourceTree: sourceTreeSchema,
    treeDigest: sha256DigestSchema,
    sourceDigest: sha256DigestSchema,
    planDigest: sha256DigestSchema,
    planArtifactDigest: sha256DigestSchema,
    selector: capacitySurveySelectorSchema,
    state: capacitySurveyStateSchema,
    route: capacitySurveyRouteSchema,
    viewport: capacitySurveyViewportSchema,
    limits: capacitySurveyLimitsSchema,
    terminal: terminalCounterSchema,
    startedAt: z.iso.datetime(),
    completedAt: z.iso.datetime(),
    durationMs: nonnegativeSafeInteger,
  })
  .strict();

const capacitySurveyResultSchema = capacitySurveyResultBodySchema
  .extend({ resultArtifactDigest: sha256DigestSchema })
  .strict();

export type CapacitySurveyResult = z.infer<typeof capacitySurveyResultSchema>;

const resultBodyFor = (
  result: CapacitySurveyResult,
): z.infer<typeof capacitySurveyResultBodySchema> => {
  const { resultArtifactDigest: _resultArtifactDigest, ...body } = result;
  return body;
};

const assertResultBounds = (result: CapacitySurveyResult): void => {
  const { terminal, limits } = result;
  const checks: readonly [string, boolean][] = [
    ["material-edge", terminal.materialEdgeCount <= limits.materialEdges],
    ["action", terminal.revealActionCount <= limits.actions],
    ["control", terminal.controlCount <= limits.controls],
  ];
  const exceeded = checks.filter(([, valid]) => !valid).map(([name]) => name);
  if (exceeded.length > 0)
    throw new CapacitySurveyContractError(
      `Capacity survey result exceeds explicit ${exceeded.join(", ")} bound`,
    );
};

const assertResultTiming = (result: CapacitySurveyResult): void => {
  const started = parseCapacitySurveyTimestamp(result.startedAt);
  const completed = parseCapacitySurveyTimestamp(result.completedAt);
  if (completed < started || completed - started !== result.durationMs)
    throw new CapacitySurveyContractError(
      "Capacity survey result has inconsistent timestamps and duration",
    );
  if (result.durationMs > result.limits.maxDurationMs)
    throw new CapacitySurveyContractError(
      "Capacity survey result exceeds the explicit wall-time bound",
    );
};

export function createCapacitySurveyResult(input: {
  readonly plan: CapacitySurveyPlan;
  readonly terminal: CapacitySurveyTerminalCounters;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly durationMs: number;
}): CapacitySurveyResult {
  const body = capacitySurveyResultBodySchema.parse({
    artifact: PREFLIGHT_CAPACITY_SURVEY_RESULT,
    version: PREFLIGHT_CAPACITY_SURVEY_VERSION,
    authority: PREFLIGHT_CAPACITY_SURVEY_AUTHORITY,
    status: "COMPLETE",
    campaignId: input.plan.campaignId,
    surveyId: input.plan.surveyId,
    sourceSha: input.plan.sourceSha,
    sourceTree: input.plan.sourceTree,
    treeDigest: input.plan.treeDigest,
    sourceDigest: input.plan.sourceDigest,
    planDigest: input.plan.planDigest,
    planArtifactDigest: input.plan.planArtifactDigest,
    selector: input.plan.selector,
    state: input.plan.state,
    route: input.plan.route,
    viewport: input.plan.viewport,
    limits: input.plan.limits,
    terminal: input.terminal,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    durationMs: input.durationMs,
  });
  assertCapacitySurveyBindings(body);
  assertResultTiming({ ...body, resultArtifactDigest: sha256Hex(body) });
  assertResultBounds({ ...body, resultArtifactDigest: sha256Hex(body) });
  return parseCapacitySurveyResult({
    ...body,
    resultArtifactDigest: sha256Hex(body),
  });
}

export function assertCapacitySurveyResultMatchesPlan(
  plan: CapacitySurveyPlan,
  result: CapacitySurveyResult,
): void {
  const fields = [
    "campaignId",
    "surveyId",
    "sourceSha",
    "sourceTree",
    "treeDigest",
    "sourceDigest",
    "planDigest",
    "planArtifactDigest",
  ] as const;
  const mismatches: string[] = fields.filter(
    (field) => result[field] !== plan[field],
  );
  if (
    stableSerialize(result.selector) !== stableSerialize(plan.selector) ||
    stableSerialize(result.state) !== stableSerialize(plan.state) ||
    stableSerialize(result.route) !== stableSerialize(plan.route) ||
    stableSerialize(result.viewport) !== stableSerialize(plan.viewport) ||
    stableSerialize(result.limits) !== stableSerialize(plan.limits)
  )
    mismatches.push("selector/state/route/viewport/limits");
  if (mismatches.length > 0)
    throw new CapacitySurveyContractError(
      `Capacity survey result does not match its plan: ${mismatches.join(", ")}`,
    );
}

export function parseCapacitySurveyResult(
  value: unknown,
): CapacitySurveyResult {
  const parsed = capacitySurveyResultSchema.safeParse(value);
  if (!parsed.success)
    throw new CapacitySurveyContractError(
      `Invalid capacity survey result: ${parsed.error.message}`,
    );
  assertCapacitySurveyBindings(parsed.data);
  assertResultTiming(parsed.data);
  assertResultBounds(parsed.data);
  if (
    sha256Hex(resultBodyFor(parsed.data)) !== parsed.data.resultArtifactDigest
  )
    throw new CapacitySurveyContractError(
      "Capacity survey result digest does not match contents",
    );
  return freezeDeep(parsed.data);
}
