import { sha256Hex } from "../../support/ids.ts";
import { preflightJournalStateDigest } from "../journal/preflight-journal-contract.ts";
import {
  CAPACITY_SURVEY_MAX_ARTIFACT_BYTES,
  type CapacitySurveyPlan,
  type CapacitySurveyResult,
  createCapacitySurveyPlan,
  createCapacitySurveyResult,
  createCapacitySurveySelector,
} from "./preflight-capacity-survey-contract.ts";

const GIT_SHA_LENGTH = 40;
const SHA256_LENGTH = 64;

export const SOURCE = {
  sourceSha: "a".repeat(GIT_SHA_LENGTH),
  sourceTree: "b".repeat(GIT_SHA_LENGTH),
  treeDigest: "c".repeat(SHA256_LENGTH),
  sourceDigest: "d".repeat(SHA256_LENGTH),
  planDigest: "e".repeat(SHA256_LENGTH),
} as const;

const state = {
  stateId: "state-capacity-fixture",
  pairwiseDigest: "f".repeat(SHA256_LENGTH),
  profile: "minimal" as const,
  axes: {
    role: "lead" as const,
    route: "lead:/reports/latest",
    profileCapability: "admin-examples" as const,
    lifecycle: "open" as const,
    submission: "draft" as const,
    ownershipDensity: "single" as const,
    permission: "allowed" as const,
    fault: "none" as const,
    controlTransition: "none" as const,
  },
} as const;

const route = {
  kind: "unconditional" as const,
  role: "lead" as const,
  catalogRoute: "/reports/latest",
  resolvedRoute: "/reports/active",
  landingRoute: "/reports/active",
  target: "active" as const,
};

const selector = createCapacitySurveySelector({
  stateId: state.stateId,
  stateDigest: preflightJournalStateDigest({
    state,
    role: route.role,
    catalogRoute: route.catalogRoute,
    resolvedRoute: route.resolvedRoute,
  }),
  pairwiseDigest: state.pairwiseDigest,
  profile: state.profile,
  axes: state.axes,
  role: route.role,
  catalogRoute: route.catalogRoute,
  resolvedRoute: route.resolvedRoute,
});

const limits = {
  maxDepth: 8,
  materialEdges: 2000,
  actions: 4000,
  controls: 4000,
  maxDurationMs: 60_000,
  maxChildren: 1 as const,
  maxPerFileBytes: CAPACITY_SURVEY_MAX_ARTIFACT_BYTES,
  maxAggregateArchiveBytes: CAPACITY_SURVEY_MAX_ARTIFACT_BYTES * 2,
} as const;

export const makePlan = (): CapacitySurveyPlan =>
  createCapacitySurveyPlan({
    artifact: "PREFLIGHT_CAPACITY_SURVEY_PLAN",
    version: 1,
    authority: "diagnostic-only",
    campaignId: "runtime-sweep-r199",
    surveyId: "capacity-survey-r199",
    ...SOURCE,
    selector,
    state,
    route,
    viewport: { browser: "chromium", width: 1440, height: 900 },
    limits,
  });

export const makeResult = (plan = makePlan()): CapacitySurveyResult =>
  createCapacitySurveyResult({
    plan,
    terminal: {
      completedCandidateCount: 2000,
      revealActionCount: 3000,
      materialEdgeCount: 1500,
      controlCount: 3000,
      visitedStateCount: 100,
      maxQueueLength: 32,
      initialSurfaceDigest: sha256Hex({ initial: "fixture" }),
      queueEmpty: true,
    },
    startedAt: "2026-08-16T00:00:00.000Z",
    completedAt: "2026-08-16T00:00:05.000Z",
    durationMs: 5000,
  });
