import { expect, test } from "vitest";

import type { DriveEnvironment } from "./driver-assignment.ts";
import { createDriverShardPlan } from "./driver-shards.ts";
import {
  buildDriverStatePreparationRequest,
  prepareDriverShardState,
} from "./driver-state-preparation.ts";
import type { MatrixExecutableCase } from "./matrix-finalizer.ts";

const SOURCE_SHA = "a".repeat(40);
const matrixCase: MatrixExecutableCase = {
  caseId: "case-a",
  stateId: "state-case-a",
  sourceSha: SOURCE_SHA,
  profile: "minimal",
  role: "lead",
  catalogRoute: "/lead/report",
  resolvedRoute: "/lead/report",
  state: {
    profileCapability: "canonical-identities",
    lifecycle: "open",
    submission: "draft",
    ownershipDensity: "single",
    permission: "allowed",
    fault: "none",
    controlTransition: "none",
  },
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
};

const environment: DriveEnvironment = {
  archive: "/archive",
  baseURL: "http://127.0.0.1:3105",
  databaseUrl: "postgresql://localhost/customreport_e2e",
  repoRoot: "/repo",
  sourceSha: SOURCE_SHA,
};

test("prepares the exact frozen route target and state before a shard drive", async () => {
  const shard = createDriverShardPlan([matrixCase], "published").assignments[0];
  if (!shard) throw new Error("test shard missing");

  await prepareDriverShardState(
    environment,
    "minimal",
    "lead",
    shard,
    (request) => {
      expect(request).toEqual({
        profile: "minimal",
        axes: {
          lifecycle: "open",
          submission: "draft",
          ownership: "single",
          permission: "allowed",
        },
        databaseUrl: environment.databaseUrl,
        repoRoot: environment.repoRoot,
        routeRole: "lead",
        routeTarget: "published",
      });
      return Promise.resolve({
        observation: { matches: true, mismatches: [] },
      });
    },
  );
});

test("rejects a shard whose state oracle does not match", async () => {
  const shard = createDriverShardPlan([matrixCase], "active").assignments[0];
  if (!shard) throw new Error("test shard missing");

  await expect(
    prepareDriverShardState(environment, "minimal", "lead", shard, () =>
      Promise.resolve({
        observation: {
          matches: false,
          mismatches: [
            {
              axis: "lifecycle",
              field: "periodState",
              expected: "open",
              actual: "published",
            },
          ],
        },
      }),
    ),
  ).rejects.toThrow(/state oracle mismatch/iu);
});

test("builds a state request from shard metadata without route heuristics", () => {
  const shard = createDriverShardPlan([matrixCase], "none").assignments[0];
  if (!shard) throw new Error("test shard missing");

  expect(
    buildDriverStatePreparationRequest(environment, "minimal", "lead", shard),
  ).toMatchObject({
    routeTarget: "none",
    axes: {
      lifecycle: "open",
      submission: "draft",
      ownership: "single",
      permission: "allowed",
    },
  });
});
