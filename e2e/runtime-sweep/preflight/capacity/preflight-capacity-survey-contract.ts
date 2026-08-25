import { z } from "zod";

import {
  sha256DigestSchema,
  sourceShaSchema,
  sourceTreeSchema,
} from "../../source/contracts.ts";
import { freezeDeep } from "../../source/manifest-source.ts";
import { sha256Hex } from "../../support/ids.ts";
import {
  assertCapacitySurveyBindings,
  CapacitySurveyContractError,
  capacitySurveyIdentifierSchema,
  capacitySurveyLimitsSchema,
  capacitySurveyRouteSchema,
  type CapacitySurveySelector,
  capacitySurveySelectorBodySchema,
  capacitySurveySelectorSchema,
  type CapacitySurveySourceIdentity,
  capacitySurveyStateSchema,
  capacitySurveyViewportSchema,
  PREFLIGHT_CAPACITY_SURVEY_AUTHORITY,
  PREFLIGHT_CAPACITY_SURVEY_PLAN,
  PREFLIGHT_CAPACITY_SURVEY_VERSION,
} from "./preflight-capacity-survey-primitives.ts";

export {
  CAPACITY_SURVEY_IMPLEMENTATION_LIMITS,
  CAPACITY_SURVEY_MAX_ARTIFACT_BYTES,
  CapacitySurveyContractError,
  PREFLIGHT_CAPACITY_SURVEY_AUTHORITY,
  PREFLIGHT_CAPACITY_SURVEY_PLAN,
  PREFLIGHT_CAPACITY_SURVEY_RESULT,
  PREFLIGHT_CAPACITY_SURVEY_VERSION,
} from "./preflight-capacity-survey-primitives.ts";

const capacitySurveyPlanBodySchema = z
  .object({
    artifact: z.literal(PREFLIGHT_CAPACITY_SURVEY_PLAN),
    version: z.literal(PREFLIGHT_CAPACITY_SURVEY_VERSION),
    authority: z.literal(PREFLIGHT_CAPACITY_SURVEY_AUTHORITY),
    campaignId: capacitySurveyIdentifierSchema,
    surveyId: capacitySurveyIdentifierSchema,
    sourceSha: sourceShaSchema,
    sourceTree: sourceTreeSchema,
    treeDigest: sha256DigestSchema,
    sourceDigest: sha256DigestSchema,
    planDigest: sha256DigestSchema,
    selector: capacitySurveySelectorSchema,
    state: capacitySurveyStateSchema,
    route: capacitySurveyRouteSchema,
    viewport: capacitySurveyViewportSchema,
    limits: capacitySurveyLimitsSchema,
  })
  .strict();

const capacitySurveyPlanSchema = capacitySurveyPlanBodySchema
  .extend({ planArtifactDigest: sha256DigestSchema })
  .strict();

export type CapacitySurveyPlan = z.infer<typeof capacitySurveyPlanSchema>;

const planBodyFor = (
  plan: CapacitySurveyPlan,
): z.infer<typeof capacitySurveyPlanBodySchema> => {
  const { planArtifactDigest: _planArtifactDigest, ...body } = plan;
  return body;
};

export function createCapacitySurveySelector(
  input: z.input<typeof capacitySurveySelectorBodySchema>,
): CapacitySurveySelector {
  const body = capacitySurveySelectorBodySchema.parse(input);
  return capacitySurveySelectorSchema.parse({
    ...body,
    selectorDigest: sha256Hex(body),
  });
}

export function createCapacitySurveyPlan(
  input: z.input<typeof capacitySurveyPlanBodySchema>,
): CapacitySurveyPlan {
  const body = capacitySurveyPlanBodySchema.parse(input);
  assertCapacitySurveyBindings(body);
  return parseCapacitySurveyPlan({
    ...body,
    planArtifactDigest: sha256Hex(body),
  });
}

export function parseCapacitySurveyPlan(value: unknown): CapacitySurveyPlan {
  const parsed = capacitySurveyPlanSchema.safeParse(value);
  if (!parsed.success)
    throw new CapacitySurveyContractError(
      `Invalid capacity survey plan: ${parsed.error.message}`,
    );
  assertCapacitySurveyBindings(parsed.data);
  if (sha256Hex(planBodyFor(parsed.data)) !== parsed.data.planArtifactDigest)
    throw new CapacitySurveyContractError(
      "Capacity survey plan digest does not match contents",
    );
  return freezeDeep(parsed.data);
}

export function assertCapacitySurveyPlanMatchesSource(
  plan: CapacitySurveyPlan,
  source: CapacitySurveySourceIdentity,
): void {
  const fields = [
    "sourceSha",
    "sourceTree",
    "treeDigest",
    "sourceDigest",
    "planDigest",
  ] as const;
  const mismatches = fields.filter((field) => plan[field] !== source[field]);
  if (mismatches.length > 0)
    throw new CapacitySurveyContractError(
      `Capacity survey plan does not match exact SOURCE identity: ${mismatches.join(", ")}`,
    );
}

export type { CapacitySurveySourceIdentity } from "./preflight-capacity-survey-primitives.ts";
export type { CapacitySurveyResult } from "./preflight-capacity-survey-result-contract.ts";
export {
  assertCapacitySurveyResultMatchesPlan,
  createCapacitySurveyResult,
  parseCapacitySurveyResult,
} from "./preflight-capacity-survey-result-contract.ts";
