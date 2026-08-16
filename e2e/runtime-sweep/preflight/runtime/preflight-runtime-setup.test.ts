import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CampaignMatrixState } from "../../matrix/campaign-matrix.ts";
import type { SourceArtifact } from "../../source/source-artifact.ts";
import type { PreflightRoute } from "../execution/playwright-preflight-support.ts";
import {
  createPreflightRuntimeSetupTestHarness,
  hiddenMutationSentinel,
  type PreflightRuntimeSetupTestHarness,
} from "./preflight-runtime-setup.test-fixture.ts";

const mocks = vi.hoisted(() => ({
  reseed: vi.fn(),
  login: vi.fn(),
  clearStorage: vi.fn(),
  drain: vi.fn(),
  createDatabase: vi.fn(),
}));

vi.mock("../../../integration/helpers/db.ts", () => ({ prisma: {} }));
vi.mock("../../../helpers/e2e-database-setup.ts", () => ({
  e2eSetupCommands: vi.fn(() => []),
  reseedE2eDatabase: mocks.reseed,
}));
vi.mock("../../../sweep/helpers/dev-auth.ts", () => ({
  loginByCookie: mocks.login,
}));
vi.mock("../../replay/browser-state/client-storage.ts", () => ({
  clearClientStorage: mocks.clearStorage,
}));
vi.mock("../../support/runtime-api-drain.ts", () => ({
  awaitRuntimeApiDrain: mocks.drain,
}));
vi.mock("./prisma-state-database.ts", () => ({
  createPrismaRuntimeStateDatabase: mocks.createDatabase,
}));

import {
  createPreflightRuntimePreparation,
  preflightPreparationKeyFor,
} from "./preflight-runtime-setup.ts";

const route = {
  role: "lead",
  catalogRoute: "/lead/report",
  resolvedRoute: "/lead/report",
  landingRoute: "/lead/report",
  target: "active",
} as const satisfies PreflightRoute;

const publishedRoute = {
  ...route,
  catalogRoute: "/reports/published",
  resolvedRoute: "/reports/published",
  landingRoute: "/reports/published",
  target: "published",
} as const satisfies PreflightRoute;

const stateFor = (
  overrides: Partial<CampaignMatrixState> = {},
): CampaignMatrixState => ({
  stateId: "state-full-lead",
  pairwiseDigest: "pairwise-full-lead",
  profile: "full",
  axes: {
    role: "lead",
    route: "lead:/lead/report",
    profileCapability: "canonical-identities",
    lifecycle: "open",
    submission: "draft",
    ownershipDensity: "single",
    permission: "allowed",
    fault: "none",
    controlTransition: "none",
  },
  ...overrides,
});

const sourceFor = (
  states: readonly CampaignMatrixState[] = [stateFor()],
  sourceSha = "a".repeat(40),
  sourceDigest = "b".repeat(64),
  planDigest = "c".repeat(64),
  sourceTree = "d".repeat(40),
  treeDigest = "e".repeat(64),
): SourceArtifact =>
  ({
    sourceSha,
    sourceTree,
    treeDigest,
    sourceDigest,
    plan: { states, digest: planDigest },
    routes: [
      {
        role: "lead",
        catalogRoute: "/lead/report",
        resolvedRoute: "/lead/report",
        landingRoute: "/lead/report",
        bindings: [
          {
            profile: "full",
            status: "assigned",
            kind: "unconditional",
            target: "active",
            resolvedRoute: "/lead/report",
            landingRoute: "/lead/report",
          },
        ],
      },
    ],
  }) as unknown as SourceArtifact;

const setupFor = (
  harness: PreflightRuntimeSetupTestHarness,
  source: SourceArtifact = sourceFor(),
) => ({ ...harness.getPage(), source });

const createPreparation = (
  setup: ReturnType<typeof setupFor>,
): ReturnType<typeof createPreflightRuntimePreparation> =>
  createPreflightRuntimePreparation({
    source: setup.source,
    page: setup.page,
    databaseUrl: "postgresql://localhost/customreport_e2e",
    repoRoot: "/workspace/customreport",
    apiUrl: "http://127.0.0.1:3002",
  });

let harness: PreflightRuntimeSetupTestHarness;

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "postgresql://localhost/customreport_dev");
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION", "давай");
  harness = createPreflightRuntimeSetupTestHarness(mocks);
  harness.reset();
});

describe("preflight prepared-state reuse", () => {
  it("prepares one exact read-only baseline while repeating each boundary", async () => {
    const setup = setupFor(harness);
    const prepare = createPreparation(setup);
    const first = await prepare(stateFor(), route, true);
    setup.setUrl("http://127.0.0.1:3000/lead/report");
    const second = await prepare(stateFor(), route, false);

    expect(harness.preparationWrites).toBe(1);
    expect(mocks.reseed).toHaveBeenCalledOnce();
    expect(mocks.drain).toHaveBeenCalledTimes(5);
    expect(mocks.clearStorage).toHaveBeenCalledTimes(2);
    expect(harness.pageContext.clearCookies).toHaveBeenCalledTimes(4);
    expect(harness.pageContext.addCookies).toHaveBeenCalledTimes(3);
    expect(first).not.toBe(second);
  });

  it.each([
    [
      "state",
      stateFor({ axes: { ...stateFor().axes, lifecycle: "reopened" } }),
      route,
    ],
    ["route", stateFor(), publishedRoute],
    ["profile", stateFor({ profile: "demo" }), route],
    [
      "fault",
      stateFor({ axes: { ...stateFor().axes, fault: "http-5xx" } }),
      route,
    ],
    [
      "control transition",
      stateFor({ axes: { ...stateFor().axes, controlTransition: "submit" } }),
      route,
    ],
  ] as const)(
    "invalidates the baseline when %s changes",
    async (_label, changedState, changedRoute) => {
      const setup = setupFor(
        harness,
        sourceFor([stateFor(), stateFor({ profile: "demo" })]),
      );
      const prepare = createPreparation(setup);

      await prepare(stateFor(), route, true);
      await prepare(changedState, changedRoute, false);

      expect(harness.preparationWrites).toBe(2);
    },
  );

  it("binds the key to source, state, route, and ownership identity", () => {
    const base = {
      source: sourceFor(),
      state: stateFor(),
      route,
      databaseUrl: "postgresql://localhost/customreport_e2e",
      repoRoot: "/workspace/customreport",
    } as const;
    const key = preflightPreparationKeyFor(base);

    expect(
      preflightPreparationKeyFor({
        ...base,
        source: sourceFor([stateFor()], "f".repeat(40), "g".repeat(64)),
      }),
    ).not.toBe(key);
    expect(
      preflightPreparationKeyFor({
        ...base,
        source: sourceFor(
          [stateFor()],
          "a".repeat(40),
          "b".repeat(64),
          "c".repeat(64),
          "h".repeat(40),
        ),
      }),
    ).not.toBe(key);
    expect(
      preflightPreparationKeyFor({
        ...base,
        state: stateFor({
          axes: { ...stateFor().axes, ownershipDensity: "multiple" },
        }),
      }),
    ).not.toBe(key);
    expect(
      preflightPreparationKeyFor({ ...base, route: publishedRoute }),
    ).not.toBe(key);
  });

  it("rejects a hidden version mutation before the action and drops the cache", async () => {
    const setup = setupFor(harness);
    const prepare = createPreparation(setup);
    const preparation = await prepare(stateFor(), route, true);
    harness.setSectionVersion(2);
    const action = vi.fn(() => Promise.resolve());

    await expect(preparation.proveNonMutation(action)).rejects.toThrow(
      /before reveal/iu,
    );
    expect(action).not.toHaveBeenCalled();
    await prepare(stateFor(), route, false);
    expect(harness.preparationWrites).toBe(2);
  });

  it("revalidates cached state before zero-reveal navigation", async () => {
    const setup = setupFor(harness);
    const prepare = createPreparation(setup);
    await prepare(stateFor(), route, true);
    harness.setSectionVersion(2);
    const navigation = vi.fn<() => void>(() => undefined);
    const inventory = vi.fn<() => void>(() => undefined);
    const runZeroRevealSegment = async (): Promise<void> => {
      await prepare(stateFor(), route, false);
      navigation();
      inventory();
    };

    await expect(runZeroRevealSegment()).rejects.toThrow(/before navigation/iu);
    expect(navigation).not.toHaveBeenCalled();
    expect(inventory).not.toHaveBeenCalled();
    expect(harness.preparationWrites).toBe(1);

    await prepare(stateFor(), route, false);
    expect(harness.preparationWrites).toBe(2);

    navigation.mockClear();
    inventory.mockClear();
    harness.setMutationSentinel(hiddenMutationSentinel);
    await expect(runZeroRevealSegment()).rejects.toThrow(/before navigation/iu);
    expect(navigation).not.toHaveBeenCalled();
    expect(inventory).not.toHaveBeenCalled();
    await prepare(stateFor(), route, false);
    expect(harness.preparationWrites).toBe(3);
  });

  it("rejects a hidden ownership mutation after the action and drops the cache", async () => {
    const setup = setupFor(harness);
    const prepare = createPreparation(setup);
    const preparation = await prepare(stateFor(), route, true);
    const action = vi.fn(() => {
      harness.setOwners(["foreign-owner"]);
      return Promise.resolve();
    });

    await expect(preparation.proveNonMutation(action)).rejects.toThrow(
      /after reveal/iu,
    );
    expect(action).toHaveBeenCalledOnce();
    await prepare(stateFor(), route, false);
    expect(harness.preparationWrites).toBe(2);
  });

  it("rejects same-owner stage A-to-B drift before and after reveal", async () => {
    const setup = setupFor(harness);
    const prepare = createPreparation(setup);
    const before = await prepare(stateFor(), route, true);
    harness.setAssignmentStage("stage-b");

    await expect(
      before.proveNonMutation(() => Promise.resolve()),
    ).rejects.toThrow(/before reveal/iu);

    const after = await prepare(stateFor(), route, true);
    const action = vi.fn(() => {
      harness.setAssignmentStage("stage-b");
      return Promise.resolve();
    });
    await expect(after.proveNonMutation(action)).rejects.toThrow(
      /after reveal/iu,
    );
    expect(action).toHaveBeenCalledOnce();
  });

  it("invalidates the cache for explicit reset and disposable-boundary recreation", async () => {
    const setup = setupFor(harness);
    const prepare = createPreparation(setup);

    await prepare(stateFor(), route, true);
    await prepare(stateFor(), route, false);
    expect(harness.preparationWrites).toBe(1);
    await prepare(stateFor(), route, true);
    expect(harness.preparationWrites).toBe(2);
    await prepare.recreateDisposableBoundary();
    expect(harness.preparationWrites).toBe(3);
  });
});
