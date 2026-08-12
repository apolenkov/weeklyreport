import type { Page, TestInfo } from "@playwright/test";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MatrixExecutableCase } from "../../../matrix/matrix-finalizer.ts";
import {
  routeForState,
  type RuntimeMatrixSource,
} from "../../../matrix/runtime-matrix.ts";
import type { FrozenCaseCoverageCell } from "../../evidence/frozen-case-evidence.ts";
import { matrixCase } from "../../test-fixtures/frozen-case-live-runner.test-fixture.ts";
import {
  type FrozenCaseLiveRuntime,
  stateForCase,
} from "./frozen-case-live-actions.ts";
import {
  runFrozenCaseCampaign,
  type RuntimeFrozenCaseExecutor,
} from "./frozen-case-live-group-runner.ts";
import {
  buildFrozenCasePreparationPlan,
  type FrozenCasePreparationRoute,
} from "./frozen-case-live-shards.ts";

const harness = vi.hoisted(() => ({
  drain: vi.fn(() => Promise.resolve()),
  prepare: vi.fn(),
  reseed: vi.fn(() => Promise.resolve()),
}));

vi.mock("../../../../helpers/e2e-runtime-state-setup.ts", () => ({
  reseedE2eRuntimeState: harness.reseed,
}));

vi.mock("../../../support/runtime-api-drain.ts", () => ({
  awaitRuntimeApiDrain: harness.drain,
}));

vi.mock("./frozen-case-live-actions.ts", () => ({
  prepareCase: harness.prepare,
  stateForCase: vi.fn((candidate: MatrixExecutableCase) => ({
    profile: candidate.profile,
    axes: { route: `${candidate.role}:${candidate.catalogRoute}` },
  })),
}));

vi.mock("../../../matrix/runtime-matrix.ts", () => ({
  routeForState: vi.fn(
    (_source: unknown, state: { axes: { route: string } }) =>
      state.axes.route.includes("published")
        ? { resolvedRoute: "/reports/published", target: "published" }
        : { resolvedRoute: "/lead/report", target: "active" },
  ),
  runtimeStateGroupKey: vi.fn(
    (profile: string, target: string) => `${profile}:${target}`,
  ),
}));

const runtime: FrozenCaseLiveRuntime = {
  archiveRoot: "/archive",
  apiLogPath: "/archive/api-log/minimal/app.log",
  apiURL: "http://127.0.0.1:3102",
  baseURL: "http://127.0.0.1:3105",
  bugsinkDsn: "http://runtime@bugsink.test/1",
  databaseUrl: "postgresql://runtime",
  repoRoot: "/repo",
};

const page = (): Page =>
  ({ goto: vi.fn(() => Promise.resolve(null)) }) as unknown as Page;

const cellFor = (
  candidate: MatrixExecutableCase,
  verdict: FrozenCaseCoverageCell["verdict"] = "pass",
): FrozenCaseCoverageCell =>
  ({ cellId: candidate.caseId, verdict }) as FrozenCaseCoverageCell;

const campaign = (
  cases: readonly MatrixExecutableCase[],
  execute: RuntimeFrozenCaseExecutor,
  campaignPage = page(),
) =>
  runFrozenCaseCampaign({
    page: campaignPage,
    source: {} as RuntimeMatrixSource,
    cases,
    runtime,
    testInfo: {} as TestInfo,
    execute,
  });

const passingExecutor = () =>
  vi.fn<RuntimeFrozenCaseExecutor>((_page, _source, candidate) =>
    Promise.resolve(cellFor(candidate)),
  );

beforeEach(() => {
  harness.drain.mockClear();
  harness.prepare.mockClear();
  harness.reseed.mockClear();
  harness.prepare.mockImplementation(
    (
      source: RuntimeMatrixSource,
      candidate: MatrixExecutableCase,
      candidateRuntime: FrozenCaseLiveRuntime,
    ) => {
      const route: FrozenCasePreparationRoute = routeForState(
        source,
        stateForCase(candidate),
      );
      return Promise.resolve({
        prepared: {
          plan: buildFrozenCasePreparationPlan(
            candidate,
            route,
            candidateRuntime.repoRoot,
          ),
          observation: { matches: true },
        },
      });
    },
  );
});

describe("frozen case live preparation groups", () => {
  it("prepares an equivalent read-only group once but executes every cell", async () => {
    const second = { ...matrixCase, caseId: "case-second" };
    const execute = passingExecutor();

    const cells = await campaign([matrixCase, second], execute);

    expect(harness.prepare).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledTimes(2);
    expect(execute.mock.calls.map((call) => call[5])).toEqual([
      expect.any(Object),
      expect.any(Object),
    ]);
    expect(cells.map(({ cellId }) => cellId)).toEqual([
      matrixCase.caseId,
      second.caseId,
    ]);
    expect(harness.drain).toHaveBeenCalledTimes(2);
  });

  it("prepares distinct read-only state keys independently", async () => {
    const differentPermission = {
      ...matrixCase,
      caseId: "case-denied",
      state: { ...matrixCase.state, permission: "forbidden" },
    } satisfies MatrixExecutableCase;
    const execute = passingExecutor();

    await campaign([matrixCase, differentPermission], execute);

    expect(harness.prepare).toHaveBeenCalledTimes(2);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("never injects shared preparation into mutating or faulted cells", async () => {
    const mutating = {
      ...matrixCase,
      caseId: "case-mutating",
      execution: {
        kind: "control",
        action: {
          controlKey: "button:After:1",
          operation: "click",
          safety: "reversible",
          transition: "none",
        },
      },
    } satisfies MatrixExecutableCase;
    const faulted = {
      ...matrixCase,
      caseId: "case-faulted",
      state: { ...matrixCase.state, fault: "network-timeout" },
    } satisfies MatrixExecutableCase;
    const execute = passingExecutor();

    await campaign([mutating, faulted], execute);

    expect(harness.prepare).not.toHaveBeenCalled();
    expect(execute.mock.calls.map((call) => call[5])).toEqual([
      undefined,
      undefined,
    ]);
  });

  it("rejects a prepared plan digest mismatch before execution", async () => {
    harness.prepare.mockResolvedValueOnce({
      prepared: { plan: { digest: "wrong-plan" } },
    });
    const execute = passingExecutor();

    await expect(campaign([matrixCase], execute)).rejects.toThrow(
      "prepared plan digest mismatch",
    );
    expect(execute).not.toHaveBeenCalled();
  });
  it("stops a reusable group on every non-pass verdict", async () => {
    const second = { ...matrixCase, caseId: "case-never-executed" };
    const execute = vi
      .fn<RuntimeFrozenCaseExecutor>()
      .mockResolvedValueOnce(cellFor(matrixCase, "fail"))
      .mockResolvedValueOnce(cellFor(second));

    await expect(campaign([matrixCase, second], execute)).rejects.toThrow(
      /case-rerender.*verdict=fail/u,
    );
    expect(execute).toHaveBeenCalledOnce();
    expect(harness.reseed).not.toHaveBeenCalled();
  });
  it("stops an isolated range on every non-pass verdict", async () => {
    const first = {
      ...matrixCase,
      caseId: "case-mutating-failed",
      execution: {
        kind: "control",
        action: {
          controlKey: "button:After:1",
          operation: "click",
          safety: "reversible",
          transition: "none",
        },
      },
    } satisfies MatrixExecutableCase;
    const second = { ...first, caseId: "case-mutating-never-executed" };
    const execute = vi
      .fn<RuntimeFrozenCaseExecutor>()
      .mockResolvedValueOnce(cellFor(first, "blocked"))
      .mockResolvedValueOnce(cellFor(second));

    await expect(campaign([first, second], execute)).rejects.toThrow(
      /case-mutating-failed.*verdict=blocked/u,
    );
    expect(execute).toHaveBeenCalledOnce();
    expect(harness.reseed).not.toHaveBeenCalled();
  });
  it("stops outer groups before reset and the next execution", async () => {
    const published = {
      ...matrixCase,
      caseId: "case-published-failed",
      profile: "full",
      catalogRoute: "/reports/published",
      resolvedRoute: "/reports/published",
    } satisfies MatrixExecutableCase;
    const active = {
      ...matrixCase,
      caseId: "case-active-never-executed",
      profile: "full",
    } satisfies MatrixExecutableCase;
    const execute = vi
      .fn<RuntimeFrozenCaseExecutor>()
      .mockResolvedValueOnce(cellFor(published, "candidate"))
      .mockResolvedValueOnce(cellFor(active));

    await expect(campaign([published, active], execute)).rejects.toThrow(
      /case-published-failed.*verdict=candidate/u,
    );
    expect(execute).toHaveBeenCalledOnce();
    expect(harness.reseed).not.toHaveBeenCalled();
  });

  it("reseeds between outer targets and restores frozen matrix order", async () => {
    const published = {
      ...matrixCase,
      caseId: "case-published",
      profile: "full",
      catalogRoute: "/reports/published",
      resolvedRoute: "/reports/published",
    } satisfies MatrixExecutableCase;
    const active = {
      ...matrixCase,
      caseId: "case-active",
      profile: "full",
    } satisfies MatrixExecutableCase;
    const publishedSecond = {
      ...published,
      caseId: "case-published-second",
    };
    const execute = passingExecutor();

    const cells = await campaign([published, active, publishedSecond], execute);

    expect(cells.map(({ cellId }) => cellId)).toEqual([
      published.caseId,
      active.caseId,
      publishedSecond.caseId,
    ]);
    expect(harness.reseed).toHaveBeenCalledOnce();
    expect(harness.reseed).toHaveBeenCalledWith({
      databaseUrl: runtime.databaseUrl,
      profile: active.profile,
      repoRoot: runtime.repoRoot,
    });
    expect(harness.drain).toHaveBeenCalledTimes(4);
    expect(harness.drain.mock.invocationCallOrder[2]).toBeLessThan(
      harness.reseed.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
  });
});
