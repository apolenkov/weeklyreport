import { EventEmitter } from "node:events";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { expect, test } from "vitest";

import {
  type CoverageCell,
  NO_ROUTE_CACHE_CONTRACT_POLICY,
} from "../source/contracts.ts";
import type { MatrixExecutableCase } from "./matrix-finalizer.ts";
import {
  assertSpecializedCaseBinding,
  captureSpecializedEventWindow,
  SpecializedCaseEmissionError,
  specializedCoveragePath,
  writeSpecializedCoverageCell,
} from "./specialized-case-emission.ts";

test("preserves an initial-navigation console error and detaches listeners", async () => {
  const emitter = new EventEmitter();
  const page = emitter as unknown as import("@playwright/test").Page;
  const captured = await captureSpecializedEventWindow(page, () => {
    emitter.emit("console", {
      type: () => "error",
      text: () => "initial navigation console error",
    });
    emitter.emit("response", {
      url: () => "http://127.0.0.1:3102/trpc/report.get",
      status: () => 503,
      ok: () => false,
      headers: () => ({ "x-request-id": "request-1" }),
      request: () => ({
        method: () => "GET",
        resourceType: () => "fetch",
      }),
    });
    return Promise.resolve("navigated");
  });
  expect(captured.result).toBe("navigated");
  expect(captured.events.consoleMessages).toEqual([
    { type: "error", text: "initial navigation console error" },
  ]);
  expect(captured.events.responses).toEqual([
    {
      requestId: expect.any(String) as string,
      url: "http://127.0.0.1:3102/trpc/report.get",
      method: "GET",
      resourceType: "fetch",
      status: 503,
      ok: false,
      correlationId: "request-1",
      startedAt: expect.any(String) as string,
      endedAt: expect.any(String) as string,
      durationMs: 0,
    },
  ]);
  expect(emitter.listenerCount("request")).toBe(0);
  expect(emitter.listenerCount("console")).toBe(0);
  expect(emitter.listenerCount("pageerror")).toBe(0);
  expect(emitter.listenerCount("requestfailed")).toBe(0);
  expect(emitter.listenerCount("response")).toBe(0);
});

const SOURCE_SHA = "a".repeat(40);

const faultExecution = {
  kind: "fault",
  faultId: "publish-http-5xx",
  action: {
    controlKey: "declaration:publish-http-5xx",
    operation: "publish",
    safety: "irreversible",
    transition: "publish",
  },
} satisfies Extract<MatrixExecutableCase["execution"], { kind: "fault" }>;

const matrixCase: MatrixExecutableCase = {
  caseId: "case-specialized-publish",
  stateId: "state-specialized-publish",
  sourceSha: SOURCE_SHA,
  profile: "full",
  role: "head",
  catalogRoute: "/head/report/[reportId]",
  resolvedRoute: "/head/report/active",
  networkPolicy: NO_ROUTE_CACHE_CONTRACT_POLICY,
  state: {
    profileCapability: "publish-flow",
    lifecycle: "open",
    submission: "draft",
    ownershipDensity: "single",
    permission: "head",
    fault: "http-5xx",
    controlTransition: "publish",
  },
  kind: "executable",
  execution: faultExecution,
};

const cell = (): CoverageCell => ({
  cellId: matrixCase.caseId,
  sourceSha: SOURCE_SHA,
  profile: matrixCase.profile,
  role: matrixCase.role,
  catalogRoute: matrixCase.catalogRoute,
  resolvedRoute: matrixCase.resolvedRoute,
  viewport: { browser: "chromium", width: 1440, height: 900 },
  state: matrixCase.state,
  action: faultExecution.action,
  execution: faultExecution,
  faultId: faultExecution.faultId,
  oracle: {
    domainSpecRefs: ["openspec/spec.md"],
    function: { required: true, expectation: "publish is rejected" },
    accessibility: { required: true, expectation: "feedback is announced" },
    visual: { required: true, expectation: "desktop is stable" },
    runtime: { required: true, expectation: "runtime telemetry is clean" },
  },
  controls: [],
  evidence: {
    before: [],
    action: [],
    after: [],
    observations: [],
    inapplicable: [],
  },
  verdict: "pending",
});

test("accepts only specialized execution rows", () => {
  expect(() => assertSpecializedCaseBinding(matrixCase)).not.toThrow();
  expect(() =>
    assertSpecializedCaseBinding({
      ...matrixCase,
      execution: {
        kind: "control",
        action: faultExecution.action,
      },
    }),
  ).toThrow(SpecializedCaseEmissionError);
});

test("writes one case-scoped coverage artifact with canonical identity", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "specialized-cell-"));
  const result = await writeSpecializedCoverageCell({
    archiveRoot: root,
    matrixCase,
    result: { cell: cell(), issues: [] },
  });
  expect(result).toBe(specializedCoveragePath(root, matrixCase));
  expect(JSON.parse(await readFile(result, "utf8"))).toMatchObject({
    cellId: matrixCase.caseId,
    execution: faultExecution,
    faultId: faultExecution.faultId,
  });
  await expect(
    writeSpecializedCoverageCell({
      archiveRoot: root,
      matrixCase,
      result: { cell: cell(), issues: [] },
    }),
  ).rejects.toMatchObject({ code: "EEXIST" });
});

test("rejects a result that uses a legacy navigation cell id", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "specialized-cell-"));
  await expect(
    writeSpecializedCoverageCell({
      archiveRoot: root,
      matrixCase,
      result: {
        cell: { ...cell(), cellId: "legacy-navigation-cell" },
        issues: [],
      },
    }),
  ).rejects.toThrow("does not equal case");
});
