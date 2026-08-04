import { describe, expect, it, vi } from "vitest";

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
  const report = (detected: boolean, reportedSha = sourceSha): string =>
    JSON.stringify({
      roleDriven: "lead",
      sourceSha: reportedSha,
      routesVisited: 1,
      routesPlanned: 1,
      canary: { injected: true, detected },
      timeline: { startedAt: "start", endedAt: "end" },
      candidates: [],
      coverageNotes: [],
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

  it("rejects stale, blind, and malformed driver reports", () => {
    expect(() => parseOpenCodeDriverReport(report(false), sourceSha)).toThrow(
      "canary was blind",
    );
    expect(() =>
      parseOpenCodeDriverReport(report(true, "b".repeat(40)), sourceSha),
    ).toThrow("source SHA is stale");
    expect(() => parseOpenCodeDriverReport("{}", sourceSha)).toThrow(
      "malformed driver report",
    );
  });
});
