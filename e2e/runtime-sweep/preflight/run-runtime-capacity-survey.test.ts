import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { writeCapacitySurveyPlan } from "./capacity/preflight-capacity-survey-io.ts";
import {
  makePlan,
  makeResult,
} from "./capacity/preflight-capacity-survey-test-support.ts";
import {
  assertBoundedCapacitySurveyByteSet,
  assertBoundedCapacitySurveyDirectory,
  capacitySurveyChildEnvironment,
  publishBoundedCapacitySurveyResult,
} from "./launch/preflight-capacity-survey-launcher-support.ts";

const fixtureRoot = path.join(process.cwd(), ".capacity-survey-fixture");
const environmentInput = {
  archiveRoot: path.join(fixtureRoot, "archive"),
  sourcePath: path.join(fixtureRoot, "archive", "SOURCE.json"),
  planPath: path.join(
    fixtureRoot,
    "archive",
    "survey",
    "PREFLIGHT_CAPACITY_SURVEY_PLAN.json",
  ),
  resultPath: path.join(
    fixtureRoot,
    "candidate",
    "PREFLIGHT_CAPACITY_SURVEY.candidate.json",
  ),
  resultRoot: path.join(fixtureRoot, "candidate"),
  tempRoot: path.join(fixtureRoot, "candidate"),
  maxDurationMs: 1234,
} as const;

describe("capacity survey launcher boundary", () => {
  it("removes every acceptance environment surface from the browser child", () => {
    const environment = capacitySurveyChildEnvironment({
      ...environmentInput,
      inherited: {
        npm_execpath: "/pnpm.cjs",
        SAFE_VALUE: "retained",
        RUNTIME_SWEEP_CAMPAIGN_KIND: "repair",
        RUNTIME_SWEEP_CANARY_STATE_ID: "state",
        RUNTIME_SWEEP_PREFLIGHT: "/authority/preflight.json",
        RUNTIME_SWEEP_PREFLIGHT_CANARY: "/authority/canary.json",
        RUNTIME_SWEEP_PREFLIGHT_REVEAL_CONTINUATION_OUTPUT:
          "/authority/chunk.json",
        RUNTIME_SWEEP_CAPACITY_SURVEY_RESULT: "/stale/result.json",
      },
    });

    expect(environment).toMatchObject({
      SAFE_VALUE: "retained",
      RUNTIME_SWEEP_PREFLIGHT_MODE: "capacity-survey",
      RUNTIME_SWEEP_CAPACITY_SURVEY_RESULT: environmentInput.resultPath,
    });
    expect(environment.RUNTIME_SWEEP_CAMPAIGN_KIND).toBeUndefined();
    expect(environment.RUNTIME_SWEEP_CANARY_STATE_ID).toBeUndefined();
    expect(environment.RUNTIME_SWEEP_PREFLIGHT).toBeUndefined();
    expect(environment.RUNTIME_SWEEP_PREFLIGHT_CANARY).toBeUndefined();
    expect(
      environment.RUNTIME_SWEEP_PREFLIGHT_REVEAL_CONTINUATION_OUTPUT,
    ).toBeUndefined();
  });

  it("accepts only the exact bounded plan/result file set", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "capacity-survey-bound-"));
    try {
      await writeFile(path.join(root, "PLAN.json"), "plan", "utf8");
      await assertBoundedCapacitySurveyDirectory({
        directory: root,
        expectedNames: ["PLAN.json"],
        maxPerFileBytes: 8,
        maxAggregateArchiveBytes: 8,
      });
      await writeFile(path.join(root, "RESULT.json"), "result", "utf8");
      await expect(
        assertBoundedCapacitySurveyDirectory({
          directory: root,
          expectedNames: ["PLAN.json"],
          maxPerFileBytes: 8,
          maxAggregateArchiveBytes: 16,
        }),
      ).rejects.toThrow(/unexpected files/iu);
      await expect(
        assertBoundedCapacitySurveyDirectory({
          directory: root,
          expectedNames: ["PLAN.json", "RESULT.json"],
          maxPerFileBytes: 8,
          maxAggregateArchiveBytes: 8,
        }),
      ).rejects.toThrow(/maxAggregateArchiveBytes/iu);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("rejects an oversized result before immutable publication", () => {
    expect(() =>
      assertBoundedCapacitySurveyByteSet({
        fileBytes: [4, 6],
        maxPerFileBytes: 8,
        maxAggregateArchiveBytes: 8,
      }),
    ).toThrow(/maxAggregateArchiveBytes/iu);
    expect(() =>
      assertBoundedCapacitySurveyByteSet({
        fileBytes: [9],
        maxPerFileBytes: 8,
        maxAggregateArchiveBytes: 16,
      }),
    ).toThrow(/maxPerFileBytes/iu);
  });

  it("leaves no COMPLETE result when the final directory bound fails", async () => {
    const root = await realpath(
      await mkdtemp(path.join(tmpdir(), "capacity-survey-publish-")),
    );
    const surveyDirectory = path.join(root, "survey");
    const planPath = path.join(surveyDirectory, "PLAN.json");
    const resultPath = path.join(surveyDirectory, "RESULT.json");
    const plan = makePlan();
    try {
      await writeCapacitySurveyPlan({
        archiveRoot: root,
        filePath: planPath,
        plan,
      });
      await writeFile(
        path.join(surveyDirectory, "unexpected.txt"),
        "x",
        "utf8",
      );

      await expect(
        publishBoundedCapacitySurveyResult({
          archiveRoot: root,
          planPath,
          resultPath,
          plan,
          result: makeResult(plan),
        }),
      ).rejects.toThrow(/unexpected files/iu);
      await expect(readFile(resultPath, "utf8")).rejects.toMatchObject({
        code: "ENOENT",
      });
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
});
