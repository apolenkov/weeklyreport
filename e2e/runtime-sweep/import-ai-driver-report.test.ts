import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { CoverageCell } from "./contracts.ts";
import {
  importAiDriverReports,
  type ImportOptions,
} from "./import-ai-driver-report.ts";

const SOURCE_SHA = "a".repeat(40);
const action = {
  controlKey: "save",
  operation: "click" as const,
  safety: "reversible" as const,
  transition: "none" as const,
};
const cell = (cellId = "cell-a"): CoverageCell => ({
  cellId,
  sourceSha: SOURCE_SHA,
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
  action,
  execution: { kind: "control", action },
  faultId: null,
  oracle: {
    domainSpecRefs: ["exhaustive-runtime-sweep"],
    function: { required: true, expectation: "the action succeeds" },
    accessibility: { required: true, expectation: "the control is named" },
    visual: { required: true, expectation: "the layout is stable" },
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

const report = (
  candidate = false,
  cellId = "cell-a",
  candidateId = `candidate-${cellId}`,
) => ({
  provider: "native-codex",
  model: "gpt-5.6-luna",
  reasoning: "max",
  attemptId: `attempt-${cellId}`,
  transcriptEvidence: {
    status: "captured" as const,
    evidenceRefs: [`transcript:${cellId}`],
  },
  roleDriven: "lead",
  profile: "minimal",
  sourceSha: SOURCE_SHA,
  assignedCells: [
    {
      cellId,
      catalogRoute: "/lead/report",
      resolvedRoute: "/lead/report",
      actionKey: "save",
    },
  ],
  routesVisited: 1,
  routesPlanned: 1,
  canary: { injected: true, detected: true },
  timeline: {
    startedAt: "2026-08-05T00:00:00.000Z",
    endedAt: "2026-08-05T00:01:00.000Z",
    routes: [
      {
        route: "/lead/report",
        enteredAt: "2026-08-05T00:00:01.000Z",
        leftAt: "2026-08-05T00:00:59.000Z",
      },
    ],
  },
  controlResults: [
    {
      cellId,
      controlKey: "save",
      status: "covered" as const,
      result: "pass" as const,
      evidenceRefs: ["control-evidence"],
    },
  ],
  candidates: candidate
    ? [
        {
          candidateId,
          cellId,
          controlKey: "save",
          kind: "functional" as const,
          summary: "candidate finding",
          evidenceRefs: ["candidate-evidence"],
        },
      ]
    : [],
});

const options = (
  reportPaths: readonly string[],
  cellsPath: string,
  outputPath: string,
  verificationPath?: string,
): ImportOptions => ({
  reportPaths,
  cellsPath,
  outputPath,
  ...(verificationPath ? { verificationPath } : {}),
  sourceSha: SOURCE_SHA,
  profile: "minimal",
  role: "lead",
});

const writeJson = (filePath: string, value: unknown): Promise<void> =>
  writeFile(filePath, `${JSON.stringify(value)}\n`, "utf8");

describe("native AI driver report import", () => {
  it("accepts a single cell file and writes merged output", async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "runtime-ai-import-"),
    );
    try {
      const reportPath = path.join(directory, "report.json");
      const cellPath = path.join(directory, "cell-a.json");
      const outputPath = path.join(directory, "output");
      await writeJson(reportPath, report());
      await writeJson(cellPath, cell());
      await expect(
        importAiDriverReports(options([reportPath], cellPath, outputPath)),
      ).resolves.toHaveLength(1);
      await expect(
        readFile(path.join(outputPath, "cell-a.json"), "utf8"),
      ).resolves.toContain('"verdict": "pass"');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("accepts a directory of cells and rejects a missing verifier", async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "runtime-ai-import-"),
    );
    try {
      const cellsPath = path.join(directory, "cells");
      await mkdir(cellsPath);
      const reportPath = path.join(directory, "report.json");
      const cellPath = path.join(cellsPath, "cell-a.json");
      const outputPath = path.join(directory, "output");
      await writeJson(reportPath, report(true));
      await writeJson(cellPath, cell());
      await expect(
        importAiDriverReports(options([reportPath], cellsPath, outputPath)),
      ).rejects.toThrow(/explicit --verification/iu);
      await expect(
        readFile(path.join(outputPath, "cell-a.json"), "utf8"),
      ).rejects.toThrow();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects an existing or overlapping output before importing", async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "runtime-ai-import-"),
    );
    try {
      const reportPath = path.join(directory, "report.json");
      const cellPath = path.join(directory, "cell-a.json");
      await writeJson(reportPath, report());
      await writeJson(cellPath, cell());
      const existingOutput = path.join(directory, "existing");
      await mkdir(existingOutput);
      await expect(
        importAiDriverReports(options([reportPath], cellPath, existingOutput)),
      ).rejects.toThrow(/already exists/iu);
      await expect(
        importAiDriverReports(options([reportPath], cellPath, directory)),
      ).rejects.toThrow(/overlap/iu);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects extra, duplicate, and stale verification records", async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "runtime-ai-import-"),
    );
    try {
      const reportPath = path.join(directory, "report.json");
      const cellPath = path.join(directory, "cell-a.json");
      await writeJson(reportPath, report(true));
      await writeJson(cellPath, cell());
      const base = {
        candidateId: "candidate-cell-a",
        cellId: "cell-a",
        sourceSha: SOURCE_SHA,
        status: "confirmed" as const,
        verifierRef: "verifier-1",
        rationale: "source confirms the candidate",
      };
      const run = async (values: readonly unknown[], name: string) => {
        const verificationPath = path.join(directory, `${name}.json`);
        const outputPath = path.join(directory, name);
        await writeJson(verificationPath, values);
        await expect(
          importAiDriverReports(
            options([reportPath], cellPath, outputPath, verificationPath),
          ),
        ).rejects.toThrow();
        await expect(
          readFile(path.join(outputPath, "cell-a.json"), "utf8"),
        ).rejects.toThrow();
      };
      await run([base, { ...base, candidateId: "unused" }], "extra");
      await run([base, base], "duplicate");
      await run([{ ...base, sourceSha: "b".repeat(40) }], "stale");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects duplicate cells across multiple reports before writing output", async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "runtime-ai-import-"),
    );
    try {
      const first = path.join(directory, "first.json");
      const second = path.join(directory, "second.json");
      const cellPath = path.join(directory, "cell-a.json");
      const outputPath = path.join(directory, "output");
      await writeJson(first, report());
      await writeJson(second, report());
      await writeJson(cellPath, cell());
      await expect(
        importAiDriverReports(options([first, second], cellPath, outputPath)),
      ).rejects.toThrow(/more than one report/iu);
      await expect(
        readFile(path.join(outputPath, "cell-a.json"), "utf8"),
      ).rejects.toThrow();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects duplicate candidate identities across reports", async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "runtime-ai-import-"),
    );
    try {
      const cellsPath = path.join(directory, "cells");
      const first = path.join(directory, "first.json");
      const second = path.join(directory, "second.json");
      const verification = path.join(directory, "verification.json");
      await mkdir(cellsPath);
      await writeJson(first, report(true, "cell-a", "candidate-shared"));
      await writeJson(second, report(true, "cell-b", "candidate-shared"));
      await writeJson(path.join(cellsPath, "cell-a.json"), cell("cell-a"));
      await writeJson(path.join(cellsPath, "cell-b.json"), cell("cell-b"));
      await writeJson(verification, []);

      await expect(
        importAiDriverReports(
          options(
            [first, second],
            cellsPath,
            path.join(directory, "output"),
            verification,
          ),
        ),
      ).rejects.toThrow(
        /duplicate candidate across reports candidate-shared/iu,
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
