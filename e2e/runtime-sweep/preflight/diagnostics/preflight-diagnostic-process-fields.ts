import os from "node:os";

import type { DiagnosticProcessSnapshot } from "./preflight-diagnostic-processes.ts";

export function diagnosticSampleFieldsFor(
  snapshot: DiagnosticProcessSnapshot,
): Readonly<{
  readonly pid: number;
  readonly processRole: DiagnosticProcessSnapshot["processRole"];
  readonly processStartWall: number;
  readonly parentPid: number | null;
  readonly ownerRootPid: number;
  readonly processRssBytes: number | null;
  readonly processVsizeBytes: number | null;
  readonly cpuPercent: number | null;
  readonly hostTotalBytes: number;
  readonly hostFreeBytes: number;
}> {
  return {
    ...snapshot,
    hostTotalBytes: os.totalmem(),
    hostFreeBytes: os.freemem(),
  };
}
