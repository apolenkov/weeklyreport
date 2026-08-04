import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  type CoverageCell,
  type DOMControl,
  type EvidenceRef,
  evidenceRefSchema,
} from "./contracts.ts";
import {
  type DriverMergeOptions,
  DriverResultValidationError,
  type OpenCodeDriverReport,
  parseDriverReport,
  validateDriverReport,
} from "./driver-results-contract.ts";
import { makeArtifactId } from "./ids.ts";

const reportDigest = (text: string): string =>
  createHash("sha256").update(text, "utf8").digest("hex");
const controlPair = (cellId: string, controlKey: string): string =>
  `${cellId}\u0000${controlKey}`;

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

function mergeControl(
  control: DOMControl,
  cellId: string,
  report: OpenCodeDriverReport,
  reportRef: EvidenceRef,
): DOMControl {
  const result = report.controlResults.find(
    (entry) =>
      entry.cellId === cellId && entry.controlKey === control.controlKey,
  );
  if (!result)
    throw new DriverResultValidationError([
      `missing control result ${controlPair(cellId, control.controlKey)}`,
    ]);
  switch (result.status) {
    case "covered":
      return {
        ...control,
        actionResult: {
          kind: "exercised",
          result: result.result,
          evidenceIds: [
            ...new Set([...result.evidenceRefs, reportRef.artifactId]),
          ],
        },
      };
    case "blocked":
      return {
        ...control,
        actionResult: {
          kind: "not-exercised",
          policy: "unavailable",
          reason: result.reason,
        },
      };
    default:
      throw new DriverResultValidationError(["unexpected driver result"]);
  }
}

function mergeCell(
  cell: CoverageCell,
  report: OpenCodeDriverReport,
  reportText: string,
  archivePath: string,
): CoverageCell {
  const reportRef = makeDriverReportEvidenceRef(
    cell,
    reportText,
    archivePath,
    report.timeline.endedAt,
  );
  const controls = cell.controls.map((control) =>
    mergeControl(control, cell.cellId, report, reportRef),
  );
  const blocked = report.controlResults.some(
    (result) => result.cellId === cell.cellId && result.status === "blocked",
  );
  const failed = report.controlResults.some(
    (result) =>
      result.cellId === cell.cellId &&
      result.status === "covered" &&
      result.result === "fail",
  );
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
    controls,
    evidence: {
      ...cell.evidence,
      action: [...cell.evidence.action, reportRef],
    },
    verdict: mergeVerdict(cell.verdict, desired),
  };
}

export function mergeDriverReport(
  cells: readonly CoverageCell[],
  report: OpenCodeDriverReport,
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
  const report = parseDriverReport(reportText, options);
  return mergeDriverReport(cells, report, options);
}

export async function writeMergedDriverCells(
  directory: string,
  cells: readonly CoverageCell[],
): Promise<void> {
  await mkdir(directory, { recursive: true });
  await Promise.all(
    cells.map((cell) =>
      writeFile(
        join(directory, `${cell.cellId}.json`),
        `${JSON.stringify(cell, null, 2)}\n`,
        "utf8",
      ),
    ),
  );
}
