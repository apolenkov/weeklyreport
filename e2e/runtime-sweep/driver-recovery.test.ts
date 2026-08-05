import { readFile, rm } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { persistDriverAttempt } from "./driver-recovery.ts";

describe("runtime-sweep driver recovery", () => {
  it("persists malformed final output before report parsing can fail", async () => {
    const directory = await mkdtemp(join(tmpdir(), "runtime-driver-recovery-"));
    try {
      const artifacts = await persistDriverAttempt({
        directory,
        reportText: "{ malformed",
        sessionId: "session-1",
        transcripts: ["partial transcript"],
        status: "completed",
      });

      await expect(readFile(artifacts.reportPath, "utf8")).resolves.toBe(
        "{ malformed",
      );
      await expect(readFile(artifacts.sessionPath, "utf8")).resolves.toContain(
        '"status": "completed"',
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("retains transcripts for an interrupted session", async () => {
    const directory = await mkdtemp(join(tmpdir(), "runtime-driver-recovery-"));
    try {
      const artifacts = await persistDriverAttempt({
        directory,
        reportText: "",
        sessionId: "session-2",
        transcripts: ["turn one", "turn two"],
        status: "interrupted",
        failure: {
          kind: "timeout",
          message: "Native Codex Luna report capture timed out after 900000ms",
        },
      });

      const session = JSON.parse(
        await readFile(artifacts.sessionPath, "utf8"),
      ) as {
        readonly status: string;
        readonly transcripts: readonly string[];
        readonly failure?: {
          readonly kind: string;
          readonly message: string;
        };
      };
      expect(session.status).toBe("interrupted");
      expect(session.transcripts).toEqual(["turn one", "turn two"]);
      expect(session.failure).toEqual({
        kind: "timeout",
        message: "Native Codex Luna report capture timed out after 900000ms",
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
