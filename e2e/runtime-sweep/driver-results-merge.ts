import { createHash } from "node:crypto";
import {
  access,
  mkdir,
  mkdtemp,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";

import {
  type CoverageCell,
  type EvidenceRef,
  evidenceRefSchema,
} from "./contracts.ts";
import {
  type AiDriverReport,
  type DriverMergeOptions,
  DriverResultValidationError,
  parseAiDriverReport,
  validateDriverReport,
} from "./driver-results-contract.ts";
import { makeArtifactId } from "./ids.ts";

const reportDigest = (text: string): string =>
  createHash("sha256").update(text, "utf8").digest("hex");

function makeDriverReportEvidenceRef(
  cell: CoverageCell,
  reportText: string,
  archivePath: string,
  capturedAt: string,
): EvidenceRef {
  const digest = reportDigest(reportText);
  return evidenceRefSchema.parse({
    artifactId: makeArtifactId({
      cellId: cell.cellId,
      sourceSha: cell.sourceSha,
      archivePath,
      content: digest,
    }),
    kind: "driver-report",
    dimension: "runtime",
    archivePath,
    digest,
    capturedAt,
    cellId: cell.cellId,
    sourceSha: cell.sourceSha,
    profile: cell.profile,
    role: cell.role,
    catalogRoute: cell.catalogRoute,
    resolvedRoute: cell.resolvedRoute,
  });
}

function mergeVerdict(
  current: CoverageCell["verdict"],
  desired: CoverageCell["verdict"],
): CoverageCell["verdict"] {
  if (current === "pending" || current === "pass") return desired;
  if (desired === "fail" || desired === "blocked") return desired;
  return current;
}

function mergeCell(
  cell: CoverageCell,
  report: AiDriverReport,
  reportText: string,
  archivePath: string,
): CoverageCell {
  const reportRef = makeDriverReportEvidenceRef(
    cell,
    reportText,
    archivePath,
    report.timeline.endedAt,
  );
  const result = report.controlResults.find(
    (entry) =>
      entry.cellId === cell.cellId &&
      entry.controlKey === cell.action.controlKey,
  );
  if (!result)
    throw new DriverResultValidationError([
      `missing action result ${cell.cellId}:${cell.action.controlKey}`,
    ]);
  const blocked = result.status === "blocked";
  const failed = result.status === "covered" && result.result === "fail";
  const candidate = report.candidates.some(
    (entry) => entry.cellId === cell.cellId,
  );
  const desired: CoverageCell["verdict"] = blocked
    ? "blocked"
    : failed
      ? "fail"
      : candidate
        ? "candidate"
        : "pass";
  return {
    ...cell,
    controls: cell.controls,
    evidence: {
      ...cell.evidence,
      action: [...cell.evidence.action, reportRef],
    },
    verdict: mergeVerdict(cell.verdict, desired),
  };
}

export function mergeDriverReport(
  cells: readonly CoverageCell[],
  report: AiDriverReport,
  options: DriverMergeOptions,
): readonly CoverageCell[] {
  validateDriverReport(report, options);
  return cells.map((cell) =>
    mergeCell(cell, report, options.reportText, options.reportArchivePath),
  );
}

export function mergeDriverResults(
  cells: readonly CoverageCell[],
  reportText: string,
  options: DriverMergeOptions,
): readonly CoverageCell[] {
  const report = parseAiDriverReport(reportText, options);
  return mergeDriverReport(cells, report, options);
}

export async function writeMergedDriverCells(
  directory: string,
  cells: readonly CoverageCell[],
): Promise<void> {
  await mkdir(dirname(directory), { recursive: true });
  try {
    await access(directory);
    throw new Error(`output directory already exists: ${directory}`);
  } catch (error: unknown) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
      throw error;
  }
  const staging = await mkdtemp(join(dirname(directory), ".runtime-driver-"));
  try {
    await Promise.all(
      cells.map((cell) =>
        writeFile(
          join(staging, `${cell.cellId}.json`),
          `${JSON.stringify(cell, null, 2)}\n`,
          { encoding: "utf8", flag: "wx" },
        ),
      ),
    );
    await rename(staging, directory);
  } catch (error: unknown) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
}
