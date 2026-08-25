import type { Cookie } from "@playwright/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CampaignMatrixState } from "../../matrix/campaign-matrix.ts";
import type { SourceArtifact } from "../../source/source-artifact.ts";
import type { PreflightRoute } from "../execution/playwright-preflight-support.ts";
import { createPreflightRuntimeSetupTestHarness } from "./preflight-runtime-setup.test-fixture.ts";

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

import { createPreflightRuntimePreparation } from "./preflight-runtime-setup.ts";

const route = {
  role: "lead",
  catalogRoute: "/lead/report",
  resolvedRoute: "/lead/report",
  landingRoute: "/lead/report",
  target: "active",
} as const satisfies PreflightRoute;

const state: CampaignMatrixState = {
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
};

const source = {
  sourceSha: "a".repeat(40),
  sourceTree: "b".repeat(40),
  treeDigest: "c".repeat(64),
  sourceDigest: "d".repeat(64),
  plan: { states: [state], digest: "e".repeat(64) },
  routes: [],
} as unknown as SourceArtifact;

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "postgresql://localhost/customreport_dev");
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION", "давай");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("preflight runtime session ordering", () => {
  it("quiesces a refreshed login before revalidating the prepared baseline", async () => {
    const harness = createPreflightRuntimeSetupTestHarness(mocks);
    harness.reset();
    const setup = harness.getPage();
    const prepare = createPreflightRuntimePreparation({
      source,
      page: setup.page,
      databaseUrl: "postgresql://localhost/customreport_e2e",
      repoRoot: "/workspace/customreport",
      apiUrl: "http://127.0.0.1:3002",
    });
    await prepare(state, route, true);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime((4_000_000_000 - 300) * 1000);
    setup.setUrl("http://127.0.0.1:3000/lead/report");
    mocks.login.mockClear();
    mocks.clearStorage.mockClear();
    mocks.drain.mockClear();
    const goto = vi.mocked(setup.page.goto);
    goto.mockClear();
    const transaction = vi.spyOn(harness.database, "transaction");
    transaction.mockClear();
    mocks.login.mockImplementation(async (page: unknown) => {
      setup.setUrl("http://127.0.0.1:3000/");
      const context = (
        page as {
          context: () => {
            addCookies: (cookies: readonly Cookie[]) => Promise<void>;
          };
        }
      ).context();
      await context.addCookies([
        {
          name: "customreport_session",
          value: "session-lead-refreshed",
          domain: "127.0.0.1",
          path: "/",
          expires: 4_000_003_600,
          httpOnly: true,
          secure: false,
          sameSite: "Lax",
        },
      ]);
    });

    await prepare(state, route, false);

    const orders = [
      mocks.login.mock.invocationCallOrder.at(-1),
      mocks.clearStorage.mock.invocationCallOrder.at(-1),
      goto.mock.invocationCallOrder.at(-1),
      mocks.drain.mock.invocationCallOrder.at(-1),
      transaction.mock.invocationCallOrder.at(-1),
    ];
    const ordered = [...new Set(orders)]
      .filter((entry): entry is number => entry !== undefined)
      .sort((left, right) => left - right);
    expect(orders).toEqual(ordered);
    expect(transaction).toHaveBeenCalled();
  });
});
