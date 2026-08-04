import { describe, expect, it, vi } from "vitest";

import type { CoverageCell } from "./contracts.ts";
import {
  assertPlaywrightMcpConnected,
  OpenCodeDriveError,
  type OpenCodeExecutor,
  parseOpenCodeDriverReport,
  parseOpenCodeEvents,
  runOpenCodeDrive,
} from "./opencode-runner.js";

const event = (phase: string, text: string): string =>
  JSON.stringify({
    sessionID: "session-1",
    type: "text",
    part: { metadata: { phase }, text },
  });

describe("OpenCode runtime-sweep runner", () => {
  const sourceSha = "a".repeat(40);
  const expectedCell: CoverageCell = {
    cellId: "cell-a",
    sourceSha,
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
      controlKey: "save",
      operation: "click",
      safety: "reversible",
      transition: "none",
    },
    oracle: {
      domainSpecRefs: ["exhaustive-runtime-sweep"],
      function: { required: true, expectation: "save works" },
      accessibility: { required: true, expectation: "status is announced" },
      visual: { required: true, expectation: "layout is stable" },
    },
    controls: [
      {
        controlKey: "save",
        cellId: "cell-a",
        ariaRole: "button",
        accessibleName: "Save",
        enabled: true,
        order: 0,
        actionResult: {
          kind: "not-exercised",
          policy: "unavailable",
          reason: "pending",
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
  const report = (reportedSha = sourceSha): string =>
    JSON.stringify({
      roleDriven: "lead",
      profile: "minimal",
      sourceSha: reportedSha,
      assignedCells: [
        {
          cellId: "cell-a",
          catalogRoute: "/lead/report",
          resolvedRoute: "/lead/report",
          controlKeys: ["save"],
        },
      ],
      routesVisited: 1,
      routesPlanned: 1,
      canary: { injected: true, detected: true },
      timeline: {
        startedAt: "start",
        endedAt: "end",
        routes: [{ route: "/lead/report", enteredAt: "start", leftAt: "end" }],
      },
      controlResults: [
        {
          cellId: "cell-a",
          controlKey: "save",
          status: "covered",
          result: "pass",
          evidenceRefs: ["save-evidence"],
        },
      ],
      candidates: [],
    });

  it("parses JSONL and ignores unrelated event shapes", () => {
    expect(
      parseOpenCodeEvents(`${event("tool", "working")}\n{}\n`),
    ).toHaveLength(1);
  });

  it("resumes one session until Luna emits a final answer", async () => {
    const execute = vi
      .fn<OpenCodeExecutor>()
      .mockResolvedValueOnce({ stdout: `${event("tool", "working")}\n` })
      .mockResolvedValueOnce({ stdout: `${event("final_answer", "{}")}\n` });

    await expect(
      runOpenCodeDrive(
        { maxTurns: 3, prompt: "drive", repoRoot: "/repo" },
        execute,
      ),
    ).resolves.toMatchObject({ finalText: "{}", sessionId: "session-1" });
    expect(execute).toHaveBeenNthCalledWith(
      2,
      expect.arrayContaining(["--session", "session-1"]),
    );
  });

  it("fails a blind MCP preflight", async () => {
    const execute = vi.fn<OpenCodeExecutor>().mockResolvedValue({ stdout: "" });
    await expect(assertPlaywrightMcpConnected(execute)).rejects.toThrow(
      OpenCodeDriveError,
    );
  });

  it("rejects stale and malformed driver reports", () => {
    const expected = {
      sourceSha,
      profile: "minimal" as const,
      role: "lead" as const,
      cells: [expectedCell],
    };
    expect(() =>
      parseOpenCodeDriverReport(report("b".repeat(40)), expected),
    ).toThrow("source SHA is stale");
    expect(() => parseOpenCodeDriverReport("{}", expected)).toThrow(
      "driver result rejected",
    );
  });
});
