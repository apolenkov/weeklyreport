import type { Cookie, Page } from "@playwright/test";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

const route = {
  role: "lead",
  catalogRoute: "/lead/report",
  resolvedRoute: "/lead/report",
  landingRoute: "/lead/report",
  target: "active",
} as const satisfies PreflightRoute;

const source = {
  sourceSha: "a".repeat(40),
  sourceTree: "b".repeat(40),
  treeDigest: "c".repeat(64),
  sourceDigest: "d".repeat(64),
  plan: { states: [state], digest: "e".repeat(64) },
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
} as unknown as SourceArtifact;

const expiringCookie = (): Cookie => ({
  name: "customreport_session",
  value: "session-lead",
  domain: "127.0.0.1",
  path: "/",
  expires: 1000,
  httpOnly: true,
  secure: false,
  sameSite: "Lax",
});

describe("preflight runtime session depth", () => {
  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/customreport_dev");
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION", "давай");
  });

  it("threads a custom reveal depth into the session replay window", async () => {
    const harness = createPreflightRuntimeSetupTestHarness(mocks);
    harness.reset();
    vi.spyOn(Date, "now").mockReturnValue(460_000);
    mocks.login.mockImplementation((page: Page) =>
      page.context().addCookies([expiringCookie()]),
    );
    const prepare = createPreflightRuntimePreparation({
      source,
      page: harness.getPage().page,
      databaseUrl: "postgresql://localhost/customreport_e2e",
      repoRoot: "/workspace/customreport",
      apiUrl: "http://127.0.0.1:3002",
      maxRevealDepth: 8,
    });

    await expect(prepare(state, route, true)).rejects.toThrow(
      /remains inside the replay safety window/iu,
    );
    expect(mocks.login).toHaveBeenCalledTimes(2);
  });
});
