import { isExpectedObservabilityAbort } from "../../evidence/expected-observability-abort.ts";
import { eventCounts } from "../../evidence/runtime-event-summary.ts";
import type { MatrixExecutableCase } from "../../matrix/matrix-finalizer.ts";
import type { RuntimeEventRecords } from "../../matrix/runtime-matrix-evidence.ts";
import {
  type EvidenceBundle,
  evidenceBundleSchema,
} from "../../source/contracts.ts";
import type { FrozenCaseLiveRuntime } from "../frozen-case/live/frozen-case-live-actions.ts";
import { writeFrozenCaseArtifact } from "./frozen-case-artifacts.ts";

type TailFailures = Readonly<{
  console: boolean;
  expectedObservabilityAbortCount: number;
  pageError: boolean;
  network: boolean;
}>;

const recordCount = (records: RuntimeEventRecords): number =>
  records.consoleMessages.length +
  records.pageErrors.length +
  records.requestFailures.length +
  records.responses.length;

const failuresFor = (
  records: RuntimeEventRecords,
  bugsinkDsn: string,
): TailFailures => ({
  console: records.consoleMessages.length > 0,
  expectedObservabilityAbortCount: records.requestFailures.filter((failure) =>
    isExpectedObservabilityAbort(failure, records.responses, bugsinkDsn),
  ).length,
  pageError: records.pageErrors.length > 0,
  network:
    records.requestFailures.some(
      (failure) =>
        !isExpectedObservabilityAbort(failure, records.responses, bugsinkDsn),
    ) || eventCounts(records).httpErrorResponses > 0,
});

const observationAffected = (
  observationId: string,
  records: RuntimeEventRecords,
): boolean =>
  (observationId === "console" && records.consoleMessages.length > 0) ||
  (observationId === "page-error" && records.pageErrors.length > 0) ||
  (observationId === "network" &&
    (records.requestFailures.length > 0 || records.responses.length > 0));

const observationFailed = (
  observationId: string,
  failures: TailFailures,
): boolean =>
  (observationId === "console" && failures.console) ||
  (observationId === "page-error" && failures.pageError) ||
  (observationId === "network" && failures.network);

const passingMessage = (
  observationId: string,
  message: string,
  failures: TailFailures,
): string =>
  observationId === "network" && failures.expectedObservabilityAbortCount > 0
    ? `${message}; ${failures.expectedObservabilityAbortCount} late expected observability abort(s) ignored`
    : message;

export const attachLateRuntimeEvents = async (
  input: Readonly<{
    matrixCase: MatrixExecutableCase;
    runtime: FrozenCaseLiveRuntime;
    bundle: EvidenceBundle;
    records: RuntimeEventRecords;
  }>,
): Promise<EvidenceBundle> => {
  const count = recordCount(input.records);
  if (count === 0) return input.bundle;
  const capturedAt = new Date().toISOString();
  const ref = await writeFrozenCaseArtifact({
    archiveRoot: input.runtime.archiveRoot,
    sourceSha: input.matrixCase.sourceSha,
    profile: input.matrixCase.profile,
    role: input.matrixCase.role,
    catalogRoute: input.matrixCase.catalogRoute,
    resolvedRoute: input.matrixCase.resolvedRoute,
    cellId: input.matrixCase.caseId,
    phase: "after",
    fileName: "late-runtime-events.json",
    kind: "log",
    dimension: "runtime",
    capturedAt,
    value: input.records,
  });
  const failures = failuresFor(input.records, input.runtime.bugsinkDsn);
  const observations = input.bundle.observations.map((observation) => {
    if (!observationAffected(observation.observationId, input.records))
      return observation;
    const failed = observationFailed(observation.observationId, failures);
    return {
      ...observation,
      outcome: failed ? ("fail" as const) : observation.outcome,
      message: failed
        ? `Late ${observation.observationId} event detected after the after-phase snapshot`
        : passingMessage(
            observation.observationId,
            observation.message,
            failures,
          ),
      evidenceIds: [...observation.evidenceIds, ref.artifactId],
    };
  });
  return evidenceBundleSchema.parse({
    ...input.bundle,
    after: [...input.bundle.after, ref],
    observations,
  });
};
