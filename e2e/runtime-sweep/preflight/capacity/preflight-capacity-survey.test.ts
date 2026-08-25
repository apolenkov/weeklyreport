import {
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { sha256Hex } from "../../support/ids.ts";
import {
  assertCapacitySurveyPlanMatchesSource,
  assertCapacitySurveyResultMatchesPlan,
  CAPACITY_SURVEY_IMPLEMENTATION_LIMITS,
  CAPACITY_SURVEY_MAX_ARTIFACT_BYTES,
  createCapacitySurveyPlan,
  parseCapacitySurveyPlan,
  parseCapacitySurveyResult,
} from "./preflight-capacity-survey-contract.ts";
import {
  readCapacitySurveyPlan,
  readCapacitySurveyResult,
  writeCapacitySurveyPlan,
  writeCapacitySurveyResult,
} from "./preflight-capacity-survey-io.ts";
import {
  makePlan,
  makeResult,
  SOURCE,
} from "./preflight-capacity-survey-test-support.ts";

describe("capacity survey contracts", () => {
  it("creates and re-parses an exact source-bound diagnostic plan", () => {
    const plan = makePlan();
    expect(parseCapacitySurveyPlan(plan)).toEqual(plan);
    expect(Object.isFrozen(plan)).toBe(true);
    assertCapacitySurveyPlanMatchesSource(plan, SOURCE);
  });

  it("rejects missing, unknown, stale-source, and tampered-selector fields", () => {
    const plan = makePlan();
    const { sourceSha: _sourceSha, ...missingSource } = plan;
    expect(() => parseCapacitySurveyPlan(missingSource)).toThrow(/invalid/iu);
    expect(() =>
      parseCapacitySurveyPlan({ ...plan, unexpected: true }),
    ).toThrow(/invalid/iu);
    expect(() =>
      parseCapacitySurveyPlan({ ...plan, sourceSha: "9".repeat(40) }),
    ).toThrow(/digest|SOURCE/u);
    expect(() =>
      parseCapacitySurveyPlan({
        ...plan,
        selector: { ...plan.selector, role: "head" },
      }),
    ).toThrow(/selector digest|selector\/state/u);
  });

  it("rejects a cap above the fixed implementation ceiling", () => {
    const plan = makePlan();
    const { planArtifactDigest: _planArtifactDigest, ...planBody } = plan;
    expect(() =>
      createCapacitySurveyPlan({
        ...planBody,
        limits: {
          ...plan.limits,
          actions: CAPACITY_SURVEY_IMPLEMENTATION_LIMITS.actions + 1,
        },
      }),
    ).toThrow(/invalid|less than or equal|too big/iu);
  });

  it("requires one child and explicit archive/output ceilings", () => {
    const plan = makePlan();
    expect(plan.limits.maxChildren).toBe(1);
    expect(plan.limits.maxPerFileBytes).toBeGreaterThan(0);
    expect(plan.limits.maxAggregateArchiveBytes).toBeGreaterThan(
      plan.limits.maxPerFileBytes,
    );
    expect(() =>
      parseCapacitySurveyPlan({
        ...plan,
        limits: { ...plan.limits, maxChildren: 2 },
      }),
    ).toThrow(/invalid/iu);
    expect(() =>
      parseCapacitySurveyPlan({
        ...plan,
        limits: {
          ...plan.limits,
          maxAggregateArchiveBytes: plan.limits.maxPerFileBytes - 1,
        },
      }),
    ).toThrow(/aggregate archive bound/iu);
  });

  it("publishes only a COMPLETE empty-frontier result and rejects PASS/nonempty variants", () => {
    const plan = makePlan();
    const result = makeResult(plan);
    expect(parseCapacitySurveyResult(result)).toEqual(result);
    expect(() =>
      parseCapacitySurveyResult({
        ...result,
        status: "PASS",
      }),
    ).toThrow(/invalid/iu);
    expect(() =>
      parseCapacitySurveyResult({
        ...result,
        terminal: { ...result.terminal, queueEmpty: false },
      }),
    ).toThrow(/invalid/iu);
    expect(() =>
      parseCapacitySurveyResult({
        ...result,
        authority: "canary",
      }),
    ).toThrow(/invalid/iu);
    expect(() =>
      parseCapacitySurveyResult({
        ...result,
        grantDigest: "2".repeat(64),
      }),
    ).toThrow(/invalid/iu);
  });

  it("detects result digest drift and exact plan/source mismatch", () => {
    const plan = makePlan();
    const result = makeResult(plan);
    const { resultArtifactDigest: _resultArtifactDigest, ...body } = result;
    expect(() =>
      parseCapacitySurveyResult({
        ...body,
        terminal: { ...result.terminal, controlCount: 3001 },
        resultArtifactDigest: result.resultArtifactDigest,
      }),
    ).toThrow(/digest|bound/u);

    const staleBody = { ...body, sourceSha: "9".repeat(40) };
    const staleResult = parseCapacitySurveyResult({
      ...staleBody,
      resultArtifactDigest: sha256Hex(staleBody),
    });
    expect(() =>
      assertCapacitySurveyResultMatchesPlan(plan, staleResult),
    ).toThrow(/does not match/u);
  });

  it("round-trips immutable canonical plan and result files", async () => {
    const root = await realpath(
      await mkdtemp(path.join(tmpdir(), "capacity-survey-contract-")),
    );
    try {
      const plan = makePlan();
      const result = makeResult(plan);
      const planPath = path.join(root, "survey", "PLAN.json");
      const resultPath = path.join(root, "survey", "RESULT.json");
      await writeCapacitySurveyPlan({
        archiveRoot: root,
        filePath: planPath,
        plan,
      });
      await writeCapacitySurveyResult({
        archiveRoot: root,
        filePath: resultPath,
        result,
      });
      expect(
        await readCapacitySurveyPlan({ archiveRoot: root, filePath: planPath }),
      ).toEqual(plan);
      expect(
        await readCapacitySurveyResult({
          archiveRoot: root,
          filePath: resultPath,
        }),
      ).toEqual(result);
      await expect(
        writeCapacitySurveyPlan({
          archiveRoot: root,
          filePath: planPath,
          plan,
        }),
      ).rejects.toThrow(/immutable|exist/u);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects noncanonical, oversized, symlink, and escaped files", async () => {
    const root = await realpath(
      await mkdtemp(path.join(tmpdir(), "capacity-survey-io-")),
    );
    try {
      const plan = makePlan();
      const planPath = path.join(root, "PLAN.json");
      await writeCapacitySurveyPlan({
        archiveRoot: root,
        filePath: planPath,
        plan,
      });
      await writeFile(planPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
      await expect(
        readCapacitySurveyPlan({ archiveRoot: root, filePath: planPath }),
      ).rejects.toThrow(/canonical/u);

      const oversizedPath = path.join(root, "oversized.json");
      await writeFile(
        oversizedPath,
        "x".repeat(CAPACITY_SURVEY_MAX_ARTIFACT_BYTES + 1),
        "utf8",
      );
      await expect(
        readCapacitySurveyPlan({ archiveRoot: root, filePath: oversizedPath }),
      ).rejects.toThrow(/ceiling/u);

      const symlinkPath = path.join(root, "symlink.json");
      await symlink(oversizedPath, symlinkPath);
      await expect(
        readCapacitySurveyPlan({ archiveRoot: root, filePath: symlinkPath }),
      ).rejects.toThrow(/symlink|regular/u);
      await expect(
        readCapacitySurveyPlan({
          archiveRoot: root,
          filePath: path.join(root, "..", "outside.json"),
        }),
      ).rejects.toThrow(/escaped archive root|archive path/u);
      expect(await readFile(planPath, "utf8")).toContain(
        "PREFLIGHT_CAPACITY_SURVEY_PLAN",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
