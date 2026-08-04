import { describe, expect, it, vi } from "vitest";

import type { CoverageCell } from "./contracts.ts";
import {
  assertPlaywrightMcpConnected,
  OpenCodeDriveError,
  OpenCodeDriveInterruptedError,
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
    execution: {
      kind: "control",
      action: {
        controlKey: "save",
        operation: "click",
        safety: "reversible",
        transition: "none",
      },
    },
    faultId: null,
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
          actionKey: "save",
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

  it("resumes one session until the driver emits a final answer", async () => {
    const execute = vi
      .fn<OpenCodeExecutor>()
      .mockResolvedValueOnce({
        stdout: `${event("final_answer", "DRIVER_BOOTSTRAP_READY")}\n`,
      })
      .mockResolvedValueOnce({ stdout: `${event("tool", "working")}\n` })
      .mockResolvedValueOnce({ stdout: `${event("final_answer", "{}")}\n` });

    await expect(
      runOpenCodeDrive(
        { maxTurns: 3, prompt: "drive", repoRoot: "/repo" },
        execute,
      ),
    ).resolves.toMatchObject({ finalText: "{}", sessionId: "session-1" });
    for (const [args] of execute.mock.calls) {
      const agentIndex = args.indexOf("--agent");
      expect(agentIndex).toBeGreaterThanOrEqual(0);
      expect(args[agentIndex + 1]).toBe("flash-browser-driver");
      expect(args).not.toContain("--pure");
      expect(args).toEqual(
        expect.arrayContaining([
          "--model",
          "opencode-go/deepseek-v4-flash",
          "--variant",
          "max",
        ]),
      );
    }
    expect(
      execute.mock.calls[1]?.[0].some((arg) => /prompt\.md/u.test(arg)),
    ).toBe(true);
    expect(execute.mock.calls[1]?.[0]).not.toContain("--file");
    expect(execute).toHaveBeenNthCalledWith(
      3,
      expect.arrayContaining(["--session", "session-1"]),
    );
  });

  it("fails a blind MCP preflight", async () => {
    const execute = vi.fn<OpenCodeExecutor>().mockResolvedValue({ stdout: "" });
    await expect(assertPlaywrightMcpConnected(execute)).rejects.toThrow(
      OpenCodeDriveError,
    );
  });

  it("fails MCP preflight when a required browser tool is missing", async () => {
    const execute = vi
      .fn<OpenCodeExecutor>()
      .mockResolvedValue({ stdout: "playwright connected" });
    await expect(
      assertPlaywrightMcpConnected(execute, ["browser_navigate"]),
    ).rejects.toThrow(/missing tools/iu);
  });

  it("preserves transcripts when a session is interrupted", async () => {
    const execute = vi
      .fn<OpenCodeExecutor>()
      .mockResolvedValueOnce({
        stdout: `${event("final_answer", "DRIVER_BOOTSTRAP_READY")}\n`,
      })
      .mockResolvedValue({ stdout: `${event("tool", "working")}\n` });
    try {
      await runOpenCodeDrive(
        { maxTurns: 1, prompt: "drive", repoRoot: "/repo" },
        execute,
      );
      throw new Error("expected an interrupted session");
    } catch (error) {
      expect(error).toBeInstanceOf(OpenCodeDriveInterruptedError);
      if (error instanceof OpenCodeDriveInterruptedError)
        expect(error.transcripts).toHaveLength(1);
    }
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
    expect(() => parseOpenCodeDriverReport("{", expected)).toThrow(
      "not valid JSON",
    );
    expect(() =>
      parseOpenCodeDriverReport(
        report().replace('"detected":true', '"detected":false'),
        expected,
      ),
    ).toThrow(/canary/iu);
  });
});
