import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { expect, test } from "vitest";

import type { CoverageCell } from "./contracts.ts";
import {
  type DriveEnvironment,
  type DriverAssignment,
  DriverAssignmentError,
  readAssignedCells,
  resolveDriverAssignment,
} from "./driver-assignment.ts";
import { createDriverShardPlan } from "./driver-shards.ts";
import type { MatrixExecutableCase } from "./matrix-finalizer.ts";
import {
  assertRuntimeSweepBaseURLLive,
  renderDriverPrompt,
  requireRuntimeSweepBaseURL,
} from "./run-opencode-drives.ts";

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
  controls: [
    {
      controlKey: "link:Report:1",
      cellId: "case-a",
      ariaRole: "link",
      accessibleName: "Report",
      enabled: true,
      order: 0,
      actionResult: {
        kind: "not-exercised",
        policy: "unavailable",
        reason: "driver pending",
      },
    },
  ],
  evidence: {
    before: [],
    action: [],
    after: [],
    observations: [],
    inapplicable: [],
  },
  verdict: "pending",
};

const matrixCase: MatrixExecutableCase = {
  caseId: "case-a",
  stateId: "state-case-a",
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
      controlKey: cell.action.controlKey,
      operation: "navigate",
      safety: "read-only",
      transition: "none",
    },
  },
};

const notApplicableRoute = (
  profile: "minimal" | "demo" | "full" | "stress",
) => ({
  status: "not-applicable" as const,
  profile,
  target: "published" as const,
  requiredCapability: "published-period" as const,
  resolvedRoute: "/reports/published",
  reason: "fixture",
});

const assignedRoute = (profile: "minimal" | "demo" | "full" | "stress") => ({
  status: "assigned" as const,
  profile,
  target: "published" as const,
  requiredCapability: "published-period" as const,
  resolvedRoute: "/reports/published",
  rationale: "fixture",
});

const manifest = {
  routes: [
    {
      role: "head" as const,
      catalogRoute: "/reports/[reportId]",
      resolvedRoute: "/reports/published",
      bindings: [
        notApplicableRoute("minimal"),
        assignedRoute("demo"),
        notApplicableRoute("full"),
        notApplicableRoute("stress"),
      ],
    },
  ],
};

test("binds the oracle to the SHA-owning worktree", () => {
  const shard = createDriverShardPlan([matrixCase], "none").assignments[0];
  if (!shard) throw new Error("test shard missing");
  const rendered = renderDriverPrompt({
    template: "Oracle <REPO_ROOT>/<CATALOG>\nBase <BASE_URL>\n<ASSIGNED_CELLS>",
    role: "lead",
    profile: "minimal",
    sourceSha: SOURCE_SHA,
    repoRoot: "/baseline-worktree",
    baseURL: "http://127.0.0.1:3105",
    shard,
    validation: {
      sourceSha: SOURCE_SHA,
      profile: "minimal",
      role: "lead",
      cells: [cell],
    },
  });

  expect(rendered).toContain("Oracle /baseline-worktree/e2e/catalog/lead.yaml");
  expect(rendered).toContain("Base http://127.0.0.1:3105");
  expect(rendered).toContain(shard.shardId);
  expect(rendered).toContain('"case-a"');
  expect(rendered).toContain('"driverMode": "browser-action"');
  expect(rendered).toContain('"executionKind": "navigation"');
  expect(rendered).not.toContain("<BASE_URL>");
  expect(rendered).not.toContain("/Users/ap/work/weeklyreport");
});

test("rejects a missing or non-loopback Driver base URL", () => {
  expect(() => requireRuntimeSweepBaseURL()).toThrow(
    "RUNTIME_SWEEP_BASE_URL is required",
  );
  expect(() => requireRuntimeSweepBaseURL("https://example.com")).toThrow(
    "loopback host",
  );
});

test("requires a live response from the injected Driver base URL", async () => {
  await expect(
    assertRuntimeSweepBaseURLLive("http://127.0.0.1:3105", () =>
      Promise.resolve(200),
    ),
  ).resolves.toBe("http://127.0.0.1:3105");
  await expect(
    assertRuntimeSweepBaseURLLive("http://127.0.0.1:3105", () =>
      Promise.resolve(503),
    ),
  ).rejects.toThrow("HTTP 503");
});

test("records a not-applicable scope when the manifest assigns no routes", () => {
  const assignment = resolveDriverAssignment(manifest, "minimal", "head", []);

  expect(assignment).toEqual<DriverAssignment>({
    status: "not-applicable",
    profile: "minimal",
    role: "head",
    routes: [],
    shards: [],
    reason: "Manifest assigns no routes to minimal/head",
  });
});

test("assigns finalized cases to deterministic route-local shards", () => {
  const cases = Array.from({ length: 33 }, (_, index) => ({
    ...matrixCase,
    caseId: `case-demo-${String(index).padStart(2, "0")}`,
    stateId: "state-demo",
    profile: "demo" as const,
    role: "head" as const,
    catalogRoute: "/reports/[reportId]",
    resolvedRoute: "/reports/published",
  }));

  const assignment = resolveDriverAssignment(manifest, "demo", "head", cases);

  expect(assignment.status).toBe("assigned");
  if (assignment.status !== "assigned") return;
  expect(assignment.routes).toHaveLength(1);
  expect(
    assignment.routes[0]?.shards.map(({ caseIds }) => caseIds.length),
  ).toEqual([32, 1]);
  expect(assignment.shards[0]).toMatchObject({
    profile: "demo",
    role: "head",
    catalogRoute: "/reports/[reportId]",
    resolvedRoute: "/reports/published",
    shardIndex: 0,
    shardCount: 2,
  });
});

test("fails when an assigned scope has no runtime cell directory", async () => {
  const archive = await mkdtemp(path.join(os.tmpdir(), "runtime-driver-"));
  const demoCase = {
    ...matrixCase,
    caseId: "case-demo",
    stateId: "state-case-demo",
    profile: "demo" as const,
    role: "head" as const,
    catalogRoute: "/reports/[reportId]",
    resolvedRoute: "/reports/published",
  };
  const shard = createDriverShardPlan([demoCase], "published").assignments[0];
  if (!shard) throw new Error("test shard missing");
  const environment: DriveEnvironment = {
    archive,
    baseURL: "http://127.0.0.1:3105",
    databaseUrl: "postgresql://localhost/customreport_e2e",
    repoRoot: "/repo",
    sourceSha: "a".repeat(40),
  };

  try {
    await expect(readAssignedCells(environment.archive, shard)).rejects.toThrow(
      DriverAssignmentError,
    );
    await expect(readAssignedCells(environment.archive, shard)).rejects.toThrow(
      /Missing or invalid runtime cell for assigned case case-demo/iu,
    );
  } finally {
    await rm(archive, { recursive: true, force: true });
  }
});
