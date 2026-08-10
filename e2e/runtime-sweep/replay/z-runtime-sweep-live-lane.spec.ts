import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { compactFailedCellSummary } from "../evidence/failure-summary.ts";
import { loadRuntimeLaneSelection } from "../lanes/runtime-lane-selection.ts";
import { parseFrozenMatrix } from "../matrix/matrix-finalizer.ts";
import {
  assertFreshRuntimeManifest,
  DEFAULT_RUNTIME_MATRIX_MAX_CELLS,
  loadRuntimeMatrix,
  type RuntimeMatrixSource,
} from "../matrix/runtime-matrix.ts";
import { seedProfileSchema } from "../source/contracts.ts";
import {
  type FrozenCaseLiveRuntime,
  runFrozenCases,
} from "./frozen-case-live-runner.ts";
import {
  createFrozenCaseLiveShardPlan,
  type FrozenCaseLiveShard,
  selectFrozenCasesForReplay,
} from "./frozen-case-live-shards.ts";

const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Runtime live-control lane requires ${name}`);
  return value;
};

const ARCHIVE_ROOT = path.resolve(requiredEnv("RUNTIME_SWEEP_ARCHIVE"));
const SOURCE_SHA = requiredEnv("RUNTIME_SWEEP_SOURCE_SHA");
const PROFILE = seedProfileSchema.parse(requiredEnv("RUNTIME_SWEEP_PROFILE"));
const DATABASE_URL = requiredEnv("E2E_DATABASE_URL");
const BASE_URL = requiredEnv("RUNTIME_SWEEP_BASE_URL");
const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..", "..");
const MAX_CELLS = Math.min(
  DEFAULT_RUNTIME_MATRIX_MAX_CELLS,
  Number.parseInt(
    process.env.RUNTIME_SWEEP_MAX_MATRIX_CELLS ??
      String(DEFAULT_RUNTIME_MATRIX_MAX_CELLS),
    10,
  ),
);

const frozenProfileCases = parseFrozenMatrix(
  JSON.parse(readFileSync(path.join(ARCHIVE_ROOT, "MATRIX.json"), "utf8")),
).cases.filter(({ profile }) => profile === PROFILE);
const laneAssignmentPath = process.env.RUNTIME_SWEEP_LANE_ASSIGNMENT?.trim();
const laneSelection =
  laneAssignmentPath === undefined
    ? undefined
    : loadRuntimeLaneSelection(
        path.resolve(laneAssignmentPath),
        requiredEnv("RUNTIME_SWEEP_LANE_ID"),
        PROFILE,
      );
if (
  laneSelection !== undefined &&
  process.env.RUNTIME_SWEEP_CASE_IDS !== undefined
)
  throw new Error(
    "RUNTIME_SWEEP_LANE_ASSIGNMENT and RUNTIME_SWEEP_CASE_IDS are mutually exclusive",
  );
if (
  laneSelection !== undefined &&
  (laneSelection.assignment.sourceSha !== SOURCE_SHA ||
    laneSelection.assignment.matrixDigest !==
      parseFrozenMatrix(
        JSON.parse(
          readFileSync(path.join(ARCHIVE_ROOT, "MATRIX.json"), "utf8"),
        ),
      ).digest)
)
  throw new Error("Runtime lane assignment does not match the frozen source");
const replayCases = selectFrozenCasesForReplay(
  frozenProfileCases,
  laneSelection?.caseIds ?? process.env.RUNTIME_SWEEP_CASE_IDS,
);
const replayShards = createFrozenCaseLiveShardPlan(replayCases);
const profileCaseIds = frozenProfileCases.map(({ caseId }) => caseId);
const sourceHolder: { value?: RuntimeMatrixSource } = {};

test.beforeAll(async () => {
  const source = await loadRuntimeMatrix({
    archiveRoot: ARCHIVE_ROOT,
    profile: PROFILE,
    maxCells: MAX_CELLS,
  });
  if (source.manifest.sourceSha !== SOURCE_SHA)
    throw new Error(
      `Runtime matrix source SHA mismatch: manifest=${source.manifest.sourceSha}, env=${SOURCE_SHA}`,
    );
  assertFreshRuntimeManifest(source);
  expect(source.selected.cases.map(({ caseId }) => caseId)).toEqual(
    profileCaseIds,
  );
  sourceHolder.value = source;
});

const shardLabel = (shard: FrozenCaseLiveShard): string =>
  `shard ${shard.shardIndex + 1}/${shard.shardCount} (${shard.cases.length} cases)`;

test.describe("replays every frozen runtime case in matrix order", () => {
  test.describe.configure({ mode: "serial", timeout: 15 * 60 * 1000 });

  for (const shard of replayShards) {
    test(`replays ${PROFILE} ${shardLabel(shard)}`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(15 * 60 * 1000);
      const source = sourceHolder.value;
      if (!source) throw new Error("Runtime matrix was not prepared");
      const runtime: FrozenCaseLiveRuntime = {
        archiveRoot: ARCHIVE_ROOT,
        apiLogPath: path.join(ARCHIVE_ROOT, "api-log", PROFILE, "app.log"),
        baseURL: BASE_URL,
        bugsinkDsn: requiredEnv("RUNTIME_SWEEP_BUGSINK_DSN"),
        databaseUrl: DATABASE_URL,
        repoRoot: REPO_ROOT,
      };
      const cells = await runFrozenCases(
        page,
        source,
        shard.cases,
        runtime,
        testInfo,
      );
      await testInfo.attach(
        `${PROFILE}-frozen-runtime-${String(shard.shardIndex).padStart(4, "0")}-summary.json`,
        {
          body: JSON.stringify(
            {
              profile: PROFILE,
              shardIndex: shard.shardIndex,
              shardCount: shard.shardCount,
              cases: shard.caseIds,
              cells: cells.map(({ cellId, execution, verdict }) => ({
                cellId,
                execution: execution.kind,
                verdict,
              })),
            },
            null,
            2,
          ),
          contentType: "application/json",
        },
      );
      expect(cells.map(({ cellId }) => cellId)).toEqual(shard.caseIds);
      const failedCells = cells.filter(({ verdict }) => verdict !== "pass");
      expect(failedCells.length, compactFailedCellSummary(failedCells)).toBe(0);
    });
  }
});
