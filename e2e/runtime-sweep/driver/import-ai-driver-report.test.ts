import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { importAiDriverReports } from "./import-ai-driver-report.ts";
import {
  cell,
  clearLiveEnvironment,
  liveTranscript,
  options,
  report,
  setLiveEnvironment,
  SOURCE_SHA,
  transcriptForCell,
  writeJson,
} from "./import-ai-driver-test-fixtures.ts";

afterEach(clearLiveEnvironment);

describe("native AI driver report import", () => {
  it("accepts a single cell file and writes merged output", async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "runtime-ai-import-"),
    );
    try {
      const transcriptPath = await setLiveEnvironment(directory);
      const reportPath = path.join(directory, "report.json");
      const cellPath = path.join(directory, "cell-a.json");
      const outputPath = path.join(directory, "output");
      await writeJson(reportPath, report());
      await writeJson(cellPath, cell());
      await expect(
        importAiDriverReports(
          options([reportPath], cellPath, outputPath, transcriptPath),
        ),
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
      const transcriptPath = await setLiveEnvironment(directory);
      const cellsPath = path.join(directory, "cells");
      await mkdir(cellsPath);
      const reportPath = path.join(directory, "report.json");
      const cellPath = path.join(cellsPath, "cell-a.json");
      const outputPath = path.join(directory, "output");
      await writeJson(reportPath, report(true));
      await writeJson(cellPath, cell());
      await expect(
        importAiDriverReports(
          options([reportPath], cellsPath, outputPath, transcriptPath),
        ),
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
      const transcriptPath = await setLiveEnvironment(directory);
      const reportPath = path.join(directory, "report.json");
      const cellPath = path.join(directory, "cell-a.json");
      await writeJson(reportPath, report());
      await writeJson(cellPath, cell());
      const existingOutput = path.join(directory, "existing");
      await mkdir(existingOutput);
      await expect(
        importAiDriverReports(
          options([reportPath], cellPath, existingOutput, transcriptPath),
        ),
      ).rejects.toThrow(/already exists/iu);
      await expect(
        importAiDriverReports(
          options([reportPath], cellPath, directory, transcriptPath),
        ),
      ).rejects.toThrow(/overlap/iu);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("does not let a legacy sibling report directory block atomic output", async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "runtime-ai-import-legacy-sibling-"),
    );
    try {
      const transcriptPath = await setLiveEnvironment(directory);
      const reportPath = path.join(directory, "report.json");
      const cellPath = path.join(directory, "cell-a.json");
      const outputPath = path.join(directory, "output");
      const legacyPath = `${outputPath}.reports`;
      await mkdir(legacyPath);
      await writeFile(path.join(legacyPath, "sentinel"), "keep", "utf8");
      await writeJson(reportPath, report());
      await writeJson(cellPath, cell());

      await expect(
        importAiDriverReports(
          options([reportPath], cellPath, outputPath, transcriptPath),
        ),
      ).resolves.toHaveLength(1);
      await expect(
        readFile(path.join(legacyPath, "sentinel"), "utf8"),
      ).resolves.toBe("keep");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("creates a missing output parent before the atomic rename", async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "runtime-ai-import-parent-"),
    );
    try {
      const transcriptPath = await setLiveEnvironment(directory);
      const reportPath = path.join(directory, "report.json");
      const cellPath = path.join(directory, "cell-a.json");
      const outputPath = path.join(directory, "nested", "missing", "output");
      await writeJson(reportPath, report());
      await writeJson(cellPath, cell());

      await expect(
        importAiDriverReports(
          options([reportPath], cellPath, outputPath, transcriptPath),
        ),
      ).resolves.toHaveLength(1);
      await expect(
        readFile(path.join(outputPath, "cell-a.json"), "utf8"),
      ).resolves.toContain('"verdict": "pass"');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects extra, duplicate, and stale verification records", async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "runtime-ai-import-"),
    );
    try {
      const transcriptPath = await setLiveEnvironment(directory);
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
            options(
              [reportPath],
              cellPath,
              outputPath,
              transcriptPath,
              verificationPath,
            ),
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
      const firstTranscript = await setLiveEnvironment(directory);
      const secondTranscript = path.join(directory, "second.transcript.jsonl");
      await writeFile(secondTranscript, `${liveTranscript}\n`, "utf8");
      const first = path.join(directory, "first.json");
      const second = path.join(directory, "second.json");
      const cellPath = path.join(directory, "cell-a.json");
      const outputPath = path.join(directory, "output");
      await writeJson(first, report());
      await writeJson(second, report());
      await writeJson(cellPath, cell());
      await expect(
        importAiDriverReports({
          ...options([first], cellPath, outputPath, firstTranscript),
          reportPaths: [first, second],
          transcriptPaths: [firstTranscript, secondTranscript],
        }),
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
      const firstTranscript = await setLiveEnvironment(directory);
      const secondTranscript = path.join(directory, "second.transcript.jsonl");
      await writeFile(
        secondTranscript,
        `${transcriptForCell("cell-b")}\n`,
        "utf8",
      );
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
        importAiDriverReports({
          ...options(
            [first],
            cellsPath,
            path.join(directory, "output"),
            firstTranscript,
            verification,
          ),
          reportPaths: [first, second],
          transcriptPaths: [firstTranscript, secondTranscript],
        }),
      ).rejects.toThrow(
        /duplicate candidate across reports candidate-shared/iu,
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
