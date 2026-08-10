import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { CoverageCell } from "../source/contracts.ts";
import { importAiDriverReports } from "./import-ai-driver-report.ts";
import {
  cell,
  clearLiveEnvironment,
  options,
  report,
  setLiveEnvironment,
  transcriptForCell,
  writeJson,
} from "./import-ai-driver-test-fixtures.ts";

afterEach(clearLiveEnvironment);

describe("native AI driver environment evidence", () => {
  it("verifies generated environment candidates and binds prepared evidence", async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "runtime-ai-import-environment-"),
    );
    try {
      const transcriptPath = await setLiveEnvironment(
        directory,
        `${JSON.stringify({
          timestamp: "2026-08-05T00:00:30.000Z",
          level: "warn",
          message: "server warning",
          correlationId: "runtime-sweep",
        })}\n`,
      );
      const reportPath = path.join(directory, "report.json");
      const cellPath = path.join(directory, "cell-a.json");
      await writeJson(reportPath, report());
      await writeJson(cellPath, cell());
      const verificationPath = path.join(directory, "verification.json");
      await writeJson(verificationPath, [
        {
          candidateId: "environment-api-log-0",
          cellId: "cell-a",
          sourceSha: "a".repeat(40),
          status: "confirmed" as const,
          verifierRef: "verifier-environment",
          rationale: "server warning is confirmed",
        },
      ]);
      await expect(
        importAiDriverReports(
          options(
            [reportPath],
            cellPath,
            path.join(directory, "missing-verification"),
            transcriptPath,
          ),
        ),
      ).rejects.toThrow(/explicit --verification/iu);

      const outputPath = path.join(directory, "verified-output");
      const merged = await importAiDriverReports(
        options(
          [reportPath],
          cellPath,
          outputPath,
          transcriptPath,
          verificationPath,
        ),
      );
      expect(merged[0]?.verdict).toBe("candidate");
      const outputCell = JSON.parse(
        await readFile(path.join(outputPath, "cell-a.json"), "utf8"),
      ) as CoverageCell;
      const reportEvidence = outputCell.evidence.action[0];
      if (!reportEvidence) throw new Error("prepared report evidence missing");
      const digest = createHash("sha256")
        .update(await readFile(reportEvidence.archivePath, "utf8"), "utf8")
        .digest("hex");
      expect(reportEvidence.digest).toBe(digest);
      const archivedReport = JSON.parse(
        await readFile(reportEvidence.archivePath, "utf8"),
      ) as {
        readonly candidates: readonly { readonly candidateId: string }[];
        readonly transcriptEvidence: Readonly<{
          readonly evidenceRefs: readonly string[];
        }>;
      };
      expect(archivedReport).toMatchObject({
        candidates: [{ candidateId: "environment-api-log-0" }],
      });
      expect(archivedReport.transcriptEvidence.evidenceRefs).toHaveLength(1);
      expect(archivedReport.transcriptEvidence.evidenceRefs[0]).toContain(
        "#sha256=",
      );
      expect(archivedReport.transcriptEvidence.evidenceRefs).not.toContain(
        "transcript:cell-a",
      );
      const transcriptMode =
        (
          await stat(
            path.join(
              outputPath,
              "inputs",
              "transcripts",
              "transcript-0000.jsonl",
            ),
          )
        ).mode & 0o777;
      const apiLogMode =
        (await stat(path.join(outputPath, "inputs", "api-log", "app.log")))
          .mode & 0o777;
      expect(transcriptMode).toBe(0o600);
      expect(apiLogMode).toBe(0o600);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects an unreadable transcript before writing output", async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "runtime-ai-import-blind-"),
    );
    try {
      await setLiveEnvironment(directory);
      const reportPath = path.join(directory, "report.json");
      const cellPath = path.join(directory, "cell-a.json");
      const outputPath = path.join(directory, "output");
      await writeJson(reportPath, report());
      await writeJson(cellPath, cell());
      await expect(
        importAiDriverReports(
          options(
            [reportPath],
            cellPath,
            outputPath,
            path.join(directory, "missing.transcript.jsonl"),
          ),
        ),
      ).rejects.toThrow(/transcript is unreadable/iu);
      await expect(
        readFile(path.join(outputPath, "cell-a.json"), "utf8"),
      ).rejects.toThrow();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("fails closed when the configured API log disappears before snapshotting", async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "runtime-ai-import-api-log-race-"),
    );
    try {
      await setLiveEnvironment(directory);
      await rm(path.join(directory, "api-log", "app.log"), { force: true });
      const reportPath = path.join(directory, "report.json");
      const cellPath = path.join(directory, "cell-a.json");
      const outputPath = path.join(directory, "output");
      await writeJson(reportPath, report());
      await writeJson(cellPath, cell());

      await expect(
        importAiDriverReports(
          options(
            [reportPath],
            cellPath,
            outputPath,
            path.join(directory, "transcript.jsonl"),
          ),
        ),
      ).rejects.toThrow(/app-log/iu);
      await expect(
        readFile(path.join(outputPath, "cell-a.json")),
      ).rejects.toThrow();
      await expect(stat(`${outputPath}.reports`)).rejects.toMatchObject({
        code: "ENOENT",
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("prepares reports sequentially for the dedicated Bugsink project", async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "runtime-ai-import-bugsink-order-"),
    );
    try {
      const firstTranscript = await setLiveEnvironment(directory);
      const secondTranscript = path.join(directory, "second.transcript.jsonl");
      await writeFile(
        secondTranscript,
        `${transcriptForCell("cell-b")}\n`,
        "utf8",
      );
      const reportsPath = path.join(directory, "reports");
      const firstReport = path.join(reportsPath, "first.json");
      const secondReport = path.join(reportsPath, "second.json");
      const cellsPath = path.join(directory, "cells");
      await mkdir(reportsPath, { recursive: true });
      await mkdir(cellsPath, { recursive: true });
      await writeJson(firstReport, report(false, "cell-a"));
      await writeJson(secondReport, report(false, "cell-b"));
      await writeJson(path.join(cellsPath, "cell-a.json"), cell("cell-a"));
      await writeJson(path.join(cellsPath, "cell-b.json"), cell("cell-b"));
      const baseFetch = globalThis.fetch;
      const fetchSpy = vi.fn<typeof fetch>((input, init) =>
        baseFetch(input, init),
      );
      vi.stubGlobal("fetch", fetchSpy);

      await expect(
        importAiDriverReports({
          ...options(
            [firstReport, secondReport],
            cellsPath,
            path.join(directory, "output"),
            firstTranscript,
          ),
          transcriptPaths: [firstTranscript, secondTranscript],
        }),
      ).resolves.toHaveLength(2);

      const bugsinkPaths = fetchSpy.mock.calls
        .map(
          ([input]) =>
            new URL(
              typeof input === "string"
                ? input
                : input instanceof URL
                  ? input.href
                  : input.url,
            ).pathname,
        )
        .filter(
          (pathname) =>
            pathname.includes("/canonical/0/projects/") ||
            pathname.endsWith("/store/"),
        );
      expect(bugsinkPaths).toEqual([
        "/api/canonical/0/projects/1/",
        "/api/1/store/",
        "/api/canonical/0/projects/1/",
        "/api/canonical/0/projects/1/",
        "/api/1/store/",
        "/api/canonical/0/projects/1/",
      ]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
