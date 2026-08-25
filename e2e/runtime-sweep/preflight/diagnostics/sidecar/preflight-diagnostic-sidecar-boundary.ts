import * as path from "node:path";

export class DiagnosticSidecarContractError extends Error {
  override readonly name = "DiagnosticSidecarContractError";
}

const DIAGNOSTIC_OUTPUT_SEGMENTS = new Set([
  "PREFLIGHT.json",
  "PREFLIGHT_CANARY.json",
  "PREFLIGHT-CANARY.json",
  "PREFLIGHT_ASSIGNMENT.json",
  "PREFLIGHT.journal.jsonl",
  "PREFLIGHT_SEGMENT.json",
  "MATRIX.json",
  "RESULT.json",
  "segments",
  "PREFLIGHT-CANARY",
  "PREFLIGHT_CANARY",
  "preflight-journal",
  "matrix",
]);

export function assertDiagnosticOutputPath(input: {
  readonly archiveRoot: string;
  readonly outputRoot: string;
}): void {
  const archiveRoot = path.resolve(input.archiveRoot);
  const outputRoot = path.resolve(input.outputRoot);
  const relative = path.relative(archiveRoot, outputRoot);
  if (
    relative === "" ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  )
    throw new DiagnosticSidecarContractError(
      "Diagnostic output root must be a child of the archive root",
    );
  const segments = relative.split(path.sep);
  if (segments.some((segment) => DIAGNOSTIC_OUTPUT_SEGMENTS.has(segment)))
    throw new DiagnosticSidecarContractError(
      "Diagnostic output root collides with an acceptance artifact path",
    );
}
