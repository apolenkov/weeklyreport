import type { EnvironmentObserverConfig } from "../preflight/observability/environment-observer.ts";
import type { CoverageCell } from "../source/contracts.ts";
import {
  prepareReport,
  readApiLogSnapshot,
  type ReportDocument,
  writeInputSnapshots,
} from "./import-ai-driver-environment.ts";
import type {
  ImportOptions,
  TranscriptInput,
} from "./import-ai-driver-options.ts";

export const prepareStagedReports = async (
  input: Readonly<{
    readonly reports: readonly ReportDocument[];
    readonly allCells: readonly CoverageCell[];
    readonly options: ImportOptions;
    readonly transcripts: readonly TranscriptInput[];
    readonly observerConfig: EnvironmentObserverConfig;
    readonly stagingRoot: string;
    readonly outputPath: string;
  }>,
): Promise<readonly ReportDocument[]> => {
  const apiLog = await readApiLogSnapshot(input.observerConfig.apiLogPath);
  const snapshots = await writeInputSnapshots(
    input.transcripts,
    apiLog,
    input.stagingRoot,
    input.outputPath,
  );
  const initial: readonly ReportDocument[] = [];
  return input.reports.reduce<Promise<readonly ReportDocument[]>>(
    async (pending, report, index) => {
      const prepared = await pending;
      const snapshot = snapshots.transcriptBindings[index];
      if (!snapshot)
        throw new Error(
          `missing transcript snapshot for report ${report.path}`,
        );
      const next = await prepareReport(
        report,
        input.allCells,
        input.options,
        snapshot.input,
        {
          transcriptEvidenceRef: snapshot.evidenceRef,
          ...(snapshots.apiLogText !== undefined
            ? { apiLogText: snapshots.apiLogText }
            : {}),
          ...(snapshots.apiLogEvidenceRef
            ? { apiLogEvidenceRef: snapshots.apiLogEvidenceRef }
            : {}),
        },
        input.observerConfig,
      );
      return [...prepared, next];
    },
    Promise.resolve(initial),
  );
};
