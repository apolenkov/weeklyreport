import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { CoverageCell } from "./contracts.ts";
import { readAssignedCells } from "./driver-assignment.ts";
import { createDriverShardPlan } from "./driver-shards.ts";
import type { MatrixExecutableCase } from "./matrix-finalizer.ts";

const SOURCE_SHA = "a".repeat(40);
const cell: CoverageCell = {
  cellId: "case-a",
  sourceSha: SOURCE_SHA,
  profile: "minimal",
  role: "lead",
  catalogRoute: "/lead/report",
  resolvedRoute: "/lead/report",
  viewport: { browser: "chromium", width: 1440, height: 900 },
  state: {
    profileCapability: "canonical-identities",
    lifecycle: "open",
    submission: "draft",
    ownershipDensity: "single",
    permission: "allowed",
    fault: "none",
    controlTransition: "none",
  },
  action: {
    controlKey: "route:lead:/lead/report",
    operation: "navigate",
    safety: "read-only",
    transition: "none",
  },
  execution: {
    kind: "navigation",
    action: {
      controlKey: "route:lead:/lead/report",
      operation: "navigate",
      safety: "read-only",
      transition: "none",
    },
  },
  faultId: null,
  oracle: {
    domainSpecRefs: ["exhaustive-runtime-sweep"],
    function: { required: true, expectation: "route renders" },
    accessibility: { required: true, expectation: "controls are named" },
    visual: { required: true, expectation: "layout is stable" },
  },
  controls: [],
  evidence: {
    before: [],
    action: [],
    after: [],
    observations: [],
    inapplicable: [],
  },
  verdict: "pass",
};

const matrixCase = (caseId: string): MatrixExecutableCase => ({
  caseId,
  stateId: "state-report",
  sourceSha: SOURCE_SHA,
  profile: "minimal",
  role: "lead",
  catalogRoute: "/lead/report",
  resolvedRoute: "/lead/report",
  state: cell.state,
  kind: "executable",
  execution: {
    kind: "navigation",
    action: {
      controlKey: "route:lead:/lead/report",
      operation: "navigate",
      safety: "read-only",
      transition: "none",
    },
  },
});

describe("OpenCode Driver exact cell files", () => {
  it("reads only canonical case files in shard order", async () => {
    const archive = await mkdtemp(
      path.join(os.tmpdir(), "runtime-driver-files-"),
    );
    const cases = [matrixCase("case-a"), matrixCase("case-b")];
    const shard = createDriverShardPlan(cases, "none").assignments[0];
    if (!shard) throw new Error("test shard missing");
    const directory = path.join(archive, "cells", "minimal", "lead");
    try {
      await mkdir(directory, { recursive: true });
      await Promise.all(
        cases.map((candidate) =>
          writeFile(
            path.join(directory, `${candidate.caseId}.json`),
            `${JSON.stringify({ ...cell, cellId: candidate.caseId })}\n`,
          ),
        ),
      );
      await writeFile(path.join(directory, "case-extra.json"), "not-json");

      const cells = await readAssignedCells(archive, shard);

      expect(cells.map(({ cellId }) => cellId)).toEqual(shard.caseIds);
    } finally {
      await rm(archive, { recursive: true, force: true });
    }
  });

  it("rejects a legacy id in a canonical case file", async () => {
    const archive = await mkdtemp(
      path.join(os.tmpdir(), "runtime-driver-legacy-"),
    );
    const shard = createDriverShardPlan([matrixCase("case-a")], "none")
      .assignments[0];
    if (!shard) throw new Error("test shard missing");
    const directory = path.join(archive, "cells", "minimal", "lead");
    try {
      await mkdir(directory, { recursive: true });
      await writeFile(
        path.join(directory, "case-a.json"),
        `${JSON.stringify({ ...cell, cellId: "cell-a" })}\n`,
      );

      await expect(readAssignedCells(archive, shard)).rejects.toThrow(
        /non-canonical cell id cell-a/iu,
      );
    } finally {
      await rm(archive, { recursive: true, force: true });
    }
  });
});
