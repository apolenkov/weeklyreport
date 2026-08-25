import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { assertE2eRuntimeDestructiveTarget } from "../../../prisma/guards/_destructive-guard.ts";
import { assertRuntimeSourceAuthorityFromEnvironment } from "../source/runtime-source-authority.ts";
import type { SourceArtifact } from "../source/source-artifact.ts";
import {
  assertLivePreflightSourceIdentity,
  resolvePreflightCanarySelection,
} from "./canary/preflight-canary.ts";
import {
  assertCapacitySurveyResultMatchesPlan,
  type CapacitySurveyPlan,
  createCapacitySurveyPlan,
  createCapacitySurveySelector,
  PREFLIGHT_CAPACITY_SURVEY_AUTHORITY,
  PREFLIGHT_CAPACITY_SURVEY_PLAN,
  PREFLIGHT_CAPACITY_SURVEY_VERSION,
} from "./capacity/preflight-capacity-survey-contract.ts";
import {
  readCapacitySurveyResult,
  serializeCapacitySurveyPlan,
  writeCapacitySurveyPlan,
} from "./capacity/preflight-capacity-survey-io.ts";
import { preflightJournalStateDigest } from "./journal/preflight-journal-contract.ts";
import { runPreflightCapacitySurveyChild } from "./launch/preflight-capacity-survey-child.ts";
import {
  assertBoundedCapacitySurveyByteSet,
  assertBoundedCapacitySurveyDirectory,
  capacitySurveyChildEnvironment,
  publishBoundedCapacitySurveyResult,
} from "./launch/preflight-capacity-survey-launcher-support.ts";
import {
  assertPreflightArchivePath,
  ensurePreflightArchiveRoot,
} from "./preflight-archive-path.ts";

const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Runtime capacity survey requires ${name}`);
  return value;
};

const optionalEnv = (name: string): string | undefined => {
  const value = process.env[name]?.trim();
  return value === undefined || value === "" ? undefined : value;
};

const requiredPositiveInteger = (name: string): number => {
  const value = Number(requiredEnv(name));
  if (!Number.isSafeInteger(value) || value < 1)
    throw new Error(`${name} must be a positive safe integer`);
  return value;
};

const assertArtifactName = (
  name: string,
  filePath: string,
  expected: string,
): void => {
  if (path.basename(filePath) !== expected)
    throw new Error(`${name} must name ${expected}`);
};

type CapacitySurveyPaths = Readonly<{
  archiveRoot: string;
  sourcePath: string;
  planPath: string;
  resultPath: string;
  failureFrontierRoot?: string;
}>;

export const createCapacitySurveyTempRoot = async (): Promise<string> =>
  realpath(await mkdtemp(path.join(tmpdir(), "customreport-capacity-survey-")));

const capacitySurveyPaths = async (): Promise<CapacitySurveyPaths> => {
  const archiveRoot = await ensurePreflightArchiveRoot(
    path.resolve(requiredEnv("RUNTIME_SWEEP_ARCHIVE")),
  );
  const sourcePath = path.resolve(requiredEnv("RUNTIME_SWEEP_SOURCE"));
  const planPath = path.resolve(
    requiredEnv("RUNTIME_SWEEP_CAPACITY_SURVEY_PLAN"),
  );
  const resultPath = path.resolve(
    requiredEnv("RUNTIME_SWEEP_CAPACITY_SURVEY_RESULT"),
  );
  const configuredFailureRoot = optionalEnv(
    "RUNTIME_SWEEP_CAPACITY_SURVEY_FAILURE_FRONTIER_ROOT",
  );
  const failureFrontierRoot =
    configuredFailureRoot === undefined
      ? undefined
      : path.resolve(configuredFailureRoot);
  await Promise.all(
    [sourcePath, planPath, resultPath].map((filePath) =>
      assertPreflightArchivePath(archiveRoot, filePath),
    ),
  );
  assertArtifactName(
    "RUNTIME_SWEEP_CAPACITY_SURVEY_PLAN",
    planPath,
    "PREFLIGHT_CAPACITY_SURVEY_PLAN.json",
  );
  assertArtifactName(
    "RUNTIME_SWEEP_CAPACITY_SURVEY_RESULT",
    resultPath,
    "PREFLIGHT_CAPACITY_SURVEY.json",
  );
  if (path.dirname(planPath) !== path.dirname(resultPath))
    throw new Error("Capacity survey plan and result must share one directory");
  if (failureFrontierRoot !== undefined) {
    await assertPreflightArchivePath(
      archiveRoot,
      path.join(failureFrontierRoot, ".failure-frontier-boundary"),
    );
    if (
      failureFrontierRoot === path.dirname(planPath) ||
      failureFrontierRoot === archiveRoot
    )
      throw new Error(
        "Capacity survey failure-frontier root must be separate from plan/result and archive roots",
      );
  }
  return {
    archiveRoot,
    sourcePath,
    planPath,
    resultPath,
    ...(failureFrontierRoot === undefined ? {} : { failureFrontierRoot }),
  };
};

const capacitySurveySelection = (source: SourceArtifact) => {
  const role = optionalEnv("RUNTIME_SWEEP_CAPACITY_SURVEY_ROLE");
  const route = optionalEnv("RUNTIME_SWEEP_CAPACITY_SURVEY_ROUTE");
  const profile = optionalEnv("RUNTIME_SWEEP_CAPACITY_SURVEY_PROFILE");
  return resolvePreflightCanarySelection({
    source,
    selector: {
      stateId: requiredEnv("RUNTIME_SWEEP_CAPACITY_SURVEY_STATE_ID"),
      ...(role === undefined ? {} : { role }),
      ...(route === undefined ? {} : { route }),
      ...(profile === undefined ? {} : { profile }),
    },
    expectedSourceSha: source.sourceSha,
  });
};

const capacitySurveyLimitsFromEnvironment =
  (): CapacitySurveyPlan["limits"] => ({
    maxDepth: requiredPositiveInteger(
      "RUNTIME_SWEEP_CAPACITY_SURVEY_MAX_DEPTH",
    ),
    materialEdges: requiredPositiveInteger(
      "RUNTIME_SWEEP_CAPACITY_SURVEY_MAX_MATERIAL_EDGES",
    ),
    actions: requiredPositiveInteger(
      "RUNTIME_SWEEP_CAPACITY_SURVEY_MAX_ACTIONS",
    ),
    controls: requiredPositiveInteger(
      "RUNTIME_SWEEP_CAPACITY_SURVEY_MAX_CONTROLS",
    ),
    maxDurationMs: requiredPositiveInteger(
      "RUNTIME_SWEEP_CAPACITY_SURVEY_MAX_DURATION_MS",
    ),
    maxChildren: 1,
    maxPerFileBytes: requiredPositiveInteger(
      "RUNTIME_SWEEP_CAPACITY_SURVEY_MAX_PER_FILE_BYTES",
    ),
    maxAggregateArchiveBytes: requiredPositiveInteger(
      "RUNTIME_SWEEP_CAPACITY_SURVEY_MAX_AGGREGATE_ARCHIVE_BYTES",
    ),
  });

const capacitySurveyPlan = (
  source: SourceArtifact,
  selection: ReturnType<typeof capacitySurveySelection>,
): CapacitySurveyPlan => {
  const selector = createCapacitySurveySelector({
    stateId: selection.state.stateId,
    stateDigest: preflightJournalStateDigest({
      state: selection.state,
      role: selection.route.role,
      catalogRoute: selection.route.catalogRoute,
      resolvedRoute: selection.route.resolvedRoute,
    }),
    pairwiseDigest: selection.state.pairwiseDigest,
    profile: selection.state.profile,
    axes: selection.state.axes,
    role: selection.route.role,
    catalogRoute: selection.route.catalogRoute,
    resolvedRoute: selection.route.resolvedRoute,
  });
  return createCapacitySurveyPlan({
    artifact: PREFLIGHT_CAPACITY_SURVEY_PLAN,
    version: PREFLIGHT_CAPACITY_SURVEY_VERSION,
    authority: PREFLIGHT_CAPACITY_SURVEY_AUTHORITY,
    campaignId: source.campaignId,
    surveyId: requiredEnv("RUNTIME_SWEEP_CAPACITY_SURVEY_ID"),
    sourceSha: source.sourceSha,
    sourceTree: source.sourceTree,
    treeDigest: source.treeDigest,
    sourceDigest: source.sourceDigest,
    planDigest: source.plan.digest,
    selector,
    state: selection.state,
    route: selection.route,
    viewport: source.viewport,
    limits: capacitySurveyLimitsFromEnvironment(),
  });
};

const runCapacitySurveyChildAndPublish = async (input: {
  readonly repoRoot: string;
  readonly source: SourceArtifact;
  readonly plan: CapacitySurveyPlan;
  readonly paths: CapacitySurveyPaths;
}): Promise<void> => {
  const tempRoot = await createCapacitySurveyTempRoot();
  const candidatePath = path.join(
    tempRoot,
    "PREFLIGHT_CAPACITY_SURVEY.candidate.json",
  );
  try {
    await runPreflightCapacitySurveyChild({
      repoRoot: input.repoRoot,
      environment: capacitySurveyChildEnvironment({
        inherited: process.env,
        archiveRoot: input.paths.archiveRoot,
        sourcePath: input.paths.sourcePath,
        planPath: input.paths.planPath,
        resultPath: candidatePath,
        resultRoot: tempRoot,
        tempRoot,
        maxDurationMs: input.plan.limits.maxDurationMs,
        ...(input.paths.failureFrontierRoot === undefined
          ? {}
          : { failureFrontierRoot: input.paths.failureFrontierRoot }),
      }),
      maxDurationMs: input.plan.limits.maxDurationMs,
    });
    const result = await readCapacitySurveyResult({
      archiveRoot: tempRoot,
      filePath: candidatePath,
    });
    assertCapacitySurveyResultMatchesPlan(input.plan, result);
    await assertLivePreflightSourceIdentity({
      source: input.source,
      repoRoot: input.repoRoot,
      expectedSourceSha: input.plan.sourceSha,
    });
    await publishBoundedCapacitySurveyResult({
      archiveRoot: input.paths.archiveRoot,
      planPath: input.paths.planPath,
      resultPath: input.paths.resultPath,
      plan: input.plan,
      result,
    });
  } finally {
    await rm(tempRoot, { force: true, recursive: true });
  }
};

export const runRuntimeCapacitySurvey = async (): Promise<void> => {
  const sourceAuthority = await assertRuntimeSourceAuthorityFromEnvironment();
  const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");
  const databaseUrl = requiredEnv("E2E_DATABASE_URL");
  assertE2eRuntimeDestructiveTarget(
    "runtime-capacity-survey-launch",
    databaseUrl,
    process.env,
  );
  const paths = await capacitySurveyPaths();
  const source = sourceAuthority.source;
  await assertLivePreflightSourceIdentity({
    source,
    repoRoot,
    expectedSourceSha: source.sourceSha,
  });
  const plan = capacitySurveyPlan(source, capacitySurveySelection(source));
  assertBoundedCapacitySurveyByteSet({
    fileBytes: [Buffer.byteLength(serializeCapacitySurveyPlan(plan), "utf8")],
    maxPerFileBytes: plan.limits.maxPerFileBytes,
    maxAggregateArchiveBytes: plan.limits.maxAggregateArchiveBytes,
  });
  await writeCapacitySurveyPlan({
    archiveRoot: paths.archiveRoot,
    filePath: paths.planPath,
    plan,
  });
  await assertBoundedCapacitySurveyDirectory({
    directory: path.dirname(paths.planPath),
    expectedNames: [path.basename(paths.planPath)],
    maxPerFileBytes: plan.limits.maxPerFileBytes,
    maxAggregateArchiveBytes: plan.limits.maxAggregateArchiveBytes,
  });
  await runCapacitySurveyChildAndPublish({ repoRoot, source, plan, paths });
};

if (
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await runRuntimeCapacitySurvey();
